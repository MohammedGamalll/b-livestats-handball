const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Database = require("better-sqlite3");
const { classifyShotZoneOrOverride } = require("./court.cjs");
const { attributeGoalkeepers, keeperByNo } = require("./gk.cjs");

const nkey = (s) => (s || "").trim().toLowerCase();
const uuid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const emptyMA = () => ({ g: 0, a: 0 });
const asBool = (v) => v === 1 || v === true;
const asFastBreak = (v) => (v == null ? null : asBool(v));

let db;
let dbFilePath = null;

function applySchema(database) {
  const schemaPath = path.join(__dirname, "schema.sql");
  database.exec(fs.readFileSync(schemaPath, "utf8"));
}

function initDatabase(dbPath) {
  dbFilePath = dbPath;
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  return db;
}

function getDb() {
  if (!db) throw new Error("SQLite is not initialized");
  return db;
}

function getDatabasePath() {
  if (!dbFilePath) throw new Error("SQLite is not initialized");
  return dbFilePath;
}

function checkpoint() {
  if (!db) return;
  db.pragma("wal_checkpoint(TRUNCATE)");
}

function closeDatabase() {
  if (!db) return;
  try {
    db.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    /* still close */
  }
  db.close();
  db = null;
}

function getDatabaseStatus() {
  const matchCount = Number(getDb().prepare("SELECT COUNT(*) AS n FROM matches").get().n) || 0;
  const playerCount = Number(getDb().prepare("SELECT COUNT(*) AS n FROM team_players").get().n) || 0;
  const teamCount = Number(getDb().prepare("SELECT COUNT(*) AS n FROM teams").get().n) || 0;
  return {
    matchCount,
    playerCount,
    teamCount,
    empty: matchCount === 0 && playerCount === 0,
    onboardingComplete: getSetting("onboarding_complete") === "1",
  };
}

function markOnboardingComplete() {
  setSetting("onboarding_complete", "1");
  return { ok: true };
}

function validateBackupFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("Backup file was not found.");
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size < 100) {
    throw new Error("Selected file is not a valid LiveStats backup.");
  }
  const fd = fs.openSync(filePath, "r");
  const header = Buffer.alloc(16);
  try {
    fs.readSync(fd, header, 0, 16, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (header.toString("utf8", 0, 15) !== "SQLite format 3") {
    throw new Error("Selected file is not a valid SQLite database.");
  }
  let probe;
  try {
    probe = new Database(filePath, { readonly: true, fileMustExist: true });
    const names = probe.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name);
    const required = ["teams", "team_players", "matches", "match_events"];
    const missing = required.filter((t) => !names.includes(t));
    if (missing.length) {
      throw new Error("Backup is missing required tables and cannot be restored.");
    }
  } finally {
    if (probe) probe.close();
  }
}

function getSetting(key) {
  const row = getDb().prepare("SELECT value FROM app_settings WHERE key = ?").get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  getDb()
    .prepare("INSERT INTO app_settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

function mapPlayer(p) {
  return {
    id: p.id,
    no: p.no || "",
    name: p.name || "",
    surname: p.surname || "",
    height: p.height || "",
    position: p.position || "",
    addInfo: p.add_info || "",
    captain: asBool(p.captain),
    playing: asBool(p.playing),
  };
}

function listTeams() {
  const teams = getDb()
    .prepare("SELECT id, name, short_name, color, updated_at FROM teams ORDER BY updated_at DESC")
    .all();
  const playersStmt = getDb().prepare(
    "SELECT id, no, name, surname, position, captain, playing, height, add_info FROM team_players WHERE team_id = ?",
  );
  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    shortName: t.short_name || "",
    color: t.color || "#00a040",
    updatedAt: new Date(t.updated_at).getTime(),
    players: playersStmt.all(t.id).map(mapPlayer),
  }));
}

function upsertTeam(team) {
  const name = (team.name || "").trim();
  if (!name) throw new Error("Team name required");
  const key = nkey(name);
  const existing = getDb().prepare("SELECT id FROM teams WHERE name_key = ?").get(key);
  const conn = getDb();
  let teamId;
  if (existing?.id) {
    teamId = existing.id;
    conn
      .prepare("UPDATE teams SET name = ?, short_name = ?, color = ?, updated_at = ? WHERE id = ?")
      .run(name, team.shortName || null, team.color || null, nowIso(), teamId);
    conn.prepare("DELETE FROM team_players WHERE team_id = ?").run(teamId);
  } else {
    teamId = uuid();
    conn
      .prepare(
        "INSERT INTO teams (id, name, name_key, short_name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(teamId, name, key, team.shortName || null, team.color || null, nowIso(), nowIso());
  }
  const players = Array.isArray(team.players) ? team.players : [];
  if (players.length) {
    const ins = conn.prepare(
      "INSERT INTO team_players (id, team_id, no, name, surname, position, captain, playing, height, add_info) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const insertMany = conn.transaction((rows) => {
      for (const p of rows) {
        ins.run(
          uuid(),
          teamId,
          p.no || "",
          p.name || "",
          p.surname || "",
          p.position || "",
          p.captain ? 1 : 0,
          p.playing ? 1 : 0,
          p.height || "",
          p.addInfo || "",
        );
      }
    });
    insertMany(players);
  }
  return teamId;
}

function saveTeam(team) {
  return { id: upsertTeam(team) };
}

function deleteTeam({ id }) {
  getDb().prepare("DELETE FROM teams WHERE id = ?").run(id);
  return { ok: true };
}

function listMatches() {
  const rows = getDb()
    .prepare(
      `SELECT id, date, competition, team1_name, team2_name, team1_color, team2_color,
              score1, score2, shootout1, shootout2, finished_at
       FROM matches ORDER BY finished_at DESC`,
    )
    .all();
  return rows.map((m) => ({
    id: m.id,
    date: m.date || "",
    competition: m.competition || "",
    team1Name: m.team1_name,
    team2Name: m.team2_name,
    team1Color: m.team1_color || "#00a040",
    team2Color: m.team2_color || "#0055aa",
    score1: m.score1 || 0,
    score2: m.score2 || 0,
    shootout1: m.shootout1 ?? null,
    shootout2: m.shootout2 ?? null,
    finishedAt: new Date(m.finished_at).getTime(),
  }));
}

function saveMatch(data) {
  const t1Id = upsertTeam({
    name: data.team1.name || "Team 1",
    shortName: data.team1.shortName,
    color: data.team1.color,
    players: data.team1.players,
  });
  const t2Id = upsertTeam({
    name: data.team2.name || "Team 2",
    shortName: data.team2.shortName,
    color: data.team2.color,
    players: data.team2.players,
  });
  const matchId = uuid();
  const info = data.info || {};
  getDb()
    .prepare(
      `INSERT INTO matches (
        id, competition, season, date, venue, city, country, halves, half_length,
        team1_id, team2_id, team1_name, team2_name, team1_color, team2_color,
        team1_snapshot, team2_snapshot, score1, score2, shootout1, shootout2, finished_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      matchId,
      info.competition || null,
      info.season || null,
      info.date || null,
      info.venue || null,
      info.city || null,
      info.country || null,
      info.halves || null,
      info.halfLength || null,
      t1Id,
      t2Id,
      data.team1.name || "Team 1",
      data.team2.name || "Team 2",
      data.team1.color || null,
      data.team2.color || null,
      JSON.stringify(data.team1 || {}),
      JSON.stringify(data.team2 || {}),
      data.score1 || 0,
      data.score2 || 0,
      data.shootout1 ?? null,
      data.shootout2 ?? null,
      nowIso(),
      nowIso(),
    );

  const log = Array.isArray(data.log) ? data.log : [];
  if (log.length) {
    const ins = getDb().prepare(
      `INSERT INTO match_events (
        id, match_id, ts, team, player_no, action, half, clock, x, y, goal_x, goal_y,
        miss_zone, subtype, assist_no, rebound_no, rebound_team, involver_no, fast_break, zone, defense
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertMany = getDb().transaction((rows) => {
      for (const e of rows) {
        ins.run(
          uuid(),
          matchId,
          e.ts,
          e.team ?? null,
          e.playerNo || null,
          e.action,
          e.half,
          e.clock,
          e.x ?? null,
          e.y ?? null,
          e.goalX ?? null,
          e.goalY ?? null,
          e.missZone || null,
          e.subtype || null,
          e.assistNo || null,
          e.reboundNo || null,
          e.reboundTeam ?? null,
          e.involverNo || null,
          e.fastBreak == null ? null : e.fastBreak ? 1 : 0,
          e.zone || null,
          e.defense || null,
        );
      }
    });
    insertMany(log);
  }
  return { id: matchId };
}

function deleteMatch({ id }) {
  getDb().prepare("DELETE FROM matches WHERE id = ?").run(id);
  return { ok: true };
}

function listPlayers() {
  const teams = getDb().prepare("SELECT id, name, color FROM teams ORDER BY name").all();
  const playersStmt = getDb().prepare("SELECT no, name, surname, position FROM team_players WHERE team_id = ?");
  const out = [];
  for (const t of teams) {
    for (const p of playersStmt.all(t.id)) {
      if (!p.no) continue;
      out.push({
        teamName: t.name,
        teamColor: t.color || "#00a040",
        no: p.no,
        name: p.name || "",
        surname: p.surname || "",
        position: p.position || "",
      });
    }
  }
  return out;
}

function mapEvent(e) {
  return {
    team: e.team,
    player_no: e.player_no,
    action: e.action,
    subtype: e.subtype,
    x: e.x,
    y: e.y,
    goal_x: e.goal_x,
    goal_y: e.goal_y,
    involver_no: e.involver_no,
    rebound_team: e.rebound_team,
    rebound_no: e.rebound_no,
    fast_break: asFastBreak(e.fast_break),
    miss_zone: e.miss_zone,
    zone: e.zone,
    half: e.half,
  };
}

function snapshotPlayers(raw) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed?.players) ? parsed.players : [];
  } catch {
    return [];
  }
}

function parseTeamSnapshot(raw, fallbackName, fallbackColor) {
  let parsed = {};
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw || {};
  } catch {
    parsed = {};
  }
  return {
    name: parsed.name || fallbackName || "Team",
    shortName: parsed.shortName || "",
    shortCode: parsed.shortCode || "",
    longCode: parsed.longCode || "",
    color: parsed.color || fallbackColor || "#00a040",
    coaches: Array.isArray(parsed.coaches) ? parsed.coaches : [],
    players: Array.isArray(parsed.players) ? parsed.players : [],
  };
}

function eventToLogEntry(e) {
  const team = e.team === 1 || e.team === 2 ? e.team : null;
  return {
    id: e.id,
    ts: e.ts,
    team,
    playerNo: e.player_no || undefined,
    action: e.action,
    half: e.half == null || e.half === "" ? undefined : Number(e.half),
    clock: e.clock || "",
    x: e.x ?? undefined,
    y: e.y ?? undefined,
    goalX: e.goal_x ?? undefined,
    goalY: e.goal_y ?? undefined,
    missZone: e.miss_zone || undefined,
    subtype: e.subtype || undefined,
    assistNo: e.assist_no || undefined,
    reboundNo: e.rebound_no || undefined,
    reboundTeam: e.rebound_team === 1 || e.rebound_team === 2 ? e.rebound_team : undefined,
    involverNo: e.involver_no || undefined,
    fastBreak: asFastBreak(e.fast_break) ?? undefined,
    zone: e.zone || undefined,
    defense: e.defense || undefined,
  };
}

function isGoalkeeperPos(pos) {
  const r = String(pos || "").trim().toUpperCase();
  return r === "GK" || r === "GOALKEEPER" || r.startsWith("GK");
}

function seedNamedPlayer(rowByNo, p) {
  const k = String(p.no || "").trim();
  if (!k) return;
  const name = (p.name || "").trim();
  const surname = (p.surname || "").trim();
  if (!name && !surname) return;
  if (rowByNo.has(k)) {
    const existing = rowByNo.get(k);
    if (!existing.name && name) existing.name = name;
    if (!existing.surname && surname) existing.surname = surname;
    if (!existing.position && p.position) existing.position = p.position;
    return;
  }
  rowByNo.set(k, makeEmptyRow(k, name, surname, p.position || ""));
}

function getMatchDetail({ id }) {
  const m = getDb()
    .prepare(
      `SELECT id, competition, season, date, venue, city, country, halves, half_length,
              team1_name, team2_name, team1_color, team2_color, team1_snapshot, team2_snapshot,
              score1, score2, shootout1, shootout2, finished_at
       FROM matches WHERE id = ?`,
    )
    .get(id);
  if (!m) return null;
  const events = getDb()
    .prepare("SELECT * FROM match_events WHERE match_id = ? ORDER BY ts ASC, rowid ASC")
    .all(id);
  return {
    id: m.id,
    info: {
      gameNumber: "",
      competition: m.competition || "",
      season: m.season || "",
      date: m.date || "",
      time: "",
      venue: m.venue || "",
      city: m.city || "",
      country: m.country || "",
      court: "",
      spectators: "",
      gameType: "",
      halves: m.halves || 2,
      halfLength: m.half_length || 30,
      otLength: 5,
      officials: [],
    },
    team1: parseTeamSnapshot(m.team1_snapshot, m.team1_name, m.team1_color || "#00a040"),
    team2: parseTeamSnapshot(m.team2_snapshot, m.team2_name, m.team2_color || "#0055aa"),
    score1: m.score1 || 0,
    score2: m.score2 || 0,
    shootout1: m.shootout1 ?? null,
    shootout2: m.shootout2 ?? null,
    log: events.map(eventToLogEntry),
  };
}

function getPlayerReport({ teamName, playerNo }) {
  const name = String(teamName || "").trim();
  const no = String(playerNo || "").trim();
  const key = nkey(name);
  const team = getDb().prepare("SELECT id, name, color FROM teams WHERE name_key = ?").get(key);
  if (!team) return null;
  const player = getDb()
    .prepare("SELECT no, name, surname, position FROM team_players WHERE team_id = ? AND trim(no) = ?")
    .get(team.id, no);
  if (!player) return null;

  const matches = getDb()
    .prepare(
      `SELECT id, date, competition, halves, half_length, team1_id, team2_id, team1_name, team2_name,
              team1_snapshot, team2_snapshot,
              score1, score2, shootout1, shootout2, finished_at
       FROM matches WHERE team1_id = ? OR team2_id = ? ORDER BY finished_at DESC`,
    )
    .all(team.id, team.id);

  const eventsStmt = getDb().prepare("SELECT * FROM match_events WHERE match_id = ?");

  const isGK = isGoalkeeperPos(player.position);
  const career = {
    no: player.no,
    name: player.name || "",
    surname: player.surname || "",
    position: player.position || "",
    teamName: team.name,
    teamColor: team.color || "#00a040",
    isGK,
    matches: [],
    gk: { saves: 0, conceded: 0, posts: 0, faced: 0, minutes: 0, savePct: 0, shotEvents: [] },
    totals: {
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals: 0,
      shots: 0,
      missed: 0,
      saved: 0,
      pen: 0,
      penAtt: 0,
      assists: 0,
      steals: 0,
      turnovers: 0,
      blocks: 0,
      yellow: 0,
      twoMin: 0,
      red: 0,
      shootingPct: 0,
    },
    shotEvents: [],
  };

  for (const m of matches) {
    const ownSide = m.team1_id === team.id ? 1 : 2;
    const rawEvents = eventsStmt.all(m.id);
    const events = rawEvents.map(mapEvent);
    const ms = {
      matchId: m.id,
      date: m.date || new Date(m.finished_at).toISOString().slice(0, 10),
      competition: m.competition || "",
      ownTeam: ownSide === 1 ? m.team1_name : m.team2_name,
      opponent: ownSide === 1 ? m.team2_name : m.team1_name,
      ownScore: ownSide === 1 ? m.score1 : m.score2,
      oppScore: ownSide === 1 ? m.score2 : m.score1,
      ownShootout: m.shootout1 != null && m.shootout2 != null ? (ownSide === 1 ? m.shootout1 : m.shootout2) : null,
      oppShootout: m.shootout1 != null && m.shootout2 != null ? (ownSide === 1 ? m.shootout2 : m.shootout1) : null,
      result: "D",
      goals: 0,
      shots: 0,
      assists: 0,
      twoMin: 0,
      yellow: 0,
      red: 0,
      blue: 0,
      turnovers: 0,
      steals: 0,
      blocks: 0,
      z6m: emptyMA(),
      z9m: emptyMA(),
      zWing: emptyMA(),
      zFB: emptyMA(),
      bt: emptyMA(),
      eg: emptyMA(),
      pen: 0,
      penAtt: 0,
      r7m: 0,
      p7m: 0,
      rf: 0,
      halves: m.halves || 2,
      gkSaves: 0,
      gkConceded: 0,
      gkPosts: 0,
      gkFaced: 0,
      gkMinutes: 0,
      gkShareSaves: 0,
      gkShareFaced: 0,
      gkPeriods: [],
    };
    if (ms.ownScore > ms.oppScore) ms.result = "W";
    else if (ms.ownScore < ms.oppScore) ms.result = "L";
    else if (ms.ownShootout != null && ms.oppShootout != null && ms.ownShootout !== ms.oppShootout) {
      ms.result = ms.ownShootout > ms.oppShootout ? "W" : "L";
    } else ms.result = "D";

    let appeared = false;
    for (const e of events) {
      const isShot = e.action === "GOAL" || e.action === "SHOT MISSED" || e.action === "SHOT SAVED" || e.action === "7M";
      const made = e.action === "GOAL" || e.action === "7M";

      if (e.team === ownSide && String(e.player_no || "").trim() === no) {
        appeared = true;
        if (isShot) {
          const isBtEg = e.subtype === "BREAK THROUGH" || e.subtype === "EMPTY GOAL";
          if (!isBtEg) {
            const z = classifyShotZoneOrOverride(e);
            if (z === "6m") {
              ms.z6m.a++;
              if (made) ms.z6m.g++;
            } else if (z === "9m") {
              ms.z9m.a++;
              if (made) ms.z9m.g++;
            } else if (z === "Wing") {
              ms.zWing.a++;
              if (made) ms.zWing.g++;
            }
            if (e.fast_break === true) {
              ms.zFB.a++;
              if (made) ms.zFB.g++;
            }
          }
          if (e.subtype === "BREAK THROUGH") {
            ms.bt.a++;
            if (made) ms.bt.g++;
          }
          if (e.subtype === "EMPTY GOAL") {
            ms.eg.a++;
            if (made) ms.eg.g++;
          }
          if (e.action === "7M" || e.subtype === "PENALTY") {
            ms.penAtt++;
            if (made) ms.pen++;
          }
        }
        switch (e.action) {
          case "GOAL":
            ms.goals++;
            ms.shots++;
            career.totals.goals++;
            career.totals.shots++;
            if (e.subtype === "PENALTY") {
              career.totals.pen++;
              career.totals.penAtt++;
            }
            career.shotEvents.push({
              team: ownSide,
              x: e.x,
              y: e.y,
              goalX: e.goal_x,
              goalY: e.goal_y,
              action: e.action,
              subtype: e.subtype,
              matchId: m.id,
            });
            break;
          case "7M":
            ms.goals++;
            ms.shots++;
            career.totals.goals++;
            career.totals.shots++;
            career.totals.pen++;
            career.totals.penAtt++;
            career.shotEvents.push({
              team: ownSide,
              x: e.x,
              y: e.y,
              goalX: e.goal_x,
              goalY: e.goal_y,
              action: e.action,
              subtype: e.subtype,
              matchId: m.id,
            });
            break;
          case "SHOT MISSED":
            ms.shots++;
            career.totals.shots++;
            career.totals.missed++;
            if (e.subtype === "PENALTY") career.totals.penAtt++;
            career.shotEvents.push({
              team: ownSide,
              x: e.x,
              y: e.y,
              goalX: e.goal_x,
              goalY: e.goal_y,
              action: e.action,
              subtype: e.subtype,
              matchId: m.id,
            });
            break;
          case "SHOT SAVED":
            ms.shots++;
            career.totals.shots++;
            career.totals.saved++;
            if (e.subtype === "PENALTY") career.totals.penAtt++;
            career.shotEvents.push({
              team: ownSide,
              x: e.x,
              y: e.y,
              goalX: e.goal_x,
              goalY: e.goal_y,
              action: e.action,
              subtype: e.subtype,
              matchId: m.id,
            });
            break;
          case "ASSIST":
            ms.assists++;
            career.totals.assists++;
            break;
          case "STEAL":
            ms.steals++;
            career.totals.steals++;
            break;
          case "TURNOVER":
            ms.turnovers++;
            career.totals.turnovers++;
            break;
          case "YELLOW":
            ms.yellow++;
            career.totals.yellow++;
            break;
          case "2-MIN":
            ms.twoMin++;
            career.totals.twoMin++;
            break;
          case "RED":
            ms.red++;
            career.totals.red++;
            break;
          case "BLUE":
            ms.blue++;
            break;
          case "FOUL":
            if (e.subtype === "7M") {
              ms.p7m++;
              appeared = true;
            }
            break;
        }
      }

      if (e.team && e.team !== ownSide && String(e.involver_no || "").trim() === no) {
        if (
          e.action === "FOUL" ||
          e.action === "7M" ||
          e.action === "2-MIN" ||
          e.action === "YELLOW" ||
          e.action === "RED" ||
          e.action === "BLUE"
        ) {
          appeared = true;
          ms.rf++;
        }
        if (e.action === "FOUL" && e.subtype === "7M") ms.r7m++;
      }
      if (e.team && e.team !== ownSide && String(e.involver_no || "").trim() === no && e.action === "TURNOVER") {
        appeared = true;
        ms.steals++;
        career.totals.steals++;
      }
      if (e.team && e.team !== ownSide && e.action === "SHOT MISSED" && e.subtype === "BLOCK") {
        if (
          String(e.involver_no || "").trim() === no ||
          (e.rebound_team === ownSide && String(e.rebound_no || "").trim() === no)
        ) {
          appeared = true;
          ms.blocks++;
          career.totals.blocks++;
        }
      }
    }

    if (isGK) {
      const ownTeam = parseTeamSnapshot(
        ownSide === 1 ? m.team1_snapshot : m.team2_snapshot,
        ownSide === 1 ? m.team1_name : m.team2_name,
        "#00a040",
      );
      const log = rawEvents.map(eventToLogEntry);
      const report = attributeGoalkeepers(ownTeam, log, ownSide, {
        halves: m.halves || 2,
        halfLength: m.half_length || 30,
        otLength: 5,
      });
      const mine = keeperByNo(report, no);
      if (mine && (mine.faced > 0 || mine.seconds > 0 || (mine.periodsPlayed || []).length)) {
        appeared = true;
        ms.gkSaves = mine.saves;
        ms.gkConceded = mine.conceded;
        ms.gkPosts = mine.posts;
        ms.gkFaced = mine.faced;
        ms.gkMinutes = mine.minutes;
        ms.gkShareSaves = mine.shareOfTeamSaves;
        ms.gkShareFaced = mine.shareOfTeamFaced;
        ms.gkPeriods = mine.periodsPlayed || [];
        career.gk.saves += mine.saves;
        career.gk.conceded += mine.conceded;
        career.gk.posts += mine.posts;
        career.gk.faced += mine.faced;
        career.gk.minutes += mine.minutes;
        for (const ev of mine.shotEvents || []) {
          career.gk.shotEvents.push({
            matchId: m.id,
            date: ms.date,
            opponent: ms.opponent,
            half: ev.half,
            action: ev.action,
            kind: ev.kind,
            goalX: ev.goalX,
            goalY: ev.goalY,
            missZone: ev.missZone,
          });
        }
      }
    }

    if (appeared) {
      career.matches.push(ms);
      career.totals.played++;
      if (ms.result === "W") career.totals.wins++;
      else if (ms.result === "L") career.totals.losses++;
      else career.totals.draws++;
    }
  }

  career.totals.shootingPct = career.totals.shots > 0 ? (career.totals.goals / career.totals.shots) * 100 : 0;
  const faced = career.gk.saves + career.gk.conceded;
  career.gk.savePct = faced > 0 ? (career.gk.saves / faced) * 100 : 0;
  return career;
}

function listSeasonTeams() {
  const matches = getDb()
    .prepare("SELECT team1_id, team2_id, team1_name, team2_name, team1_color, team2_color FROM matches")
    .all();
  const map = new Map();
  for (const m of matches) {
    if (m.team1_id) map.set(m.team1_id, { id: m.team1_id, name: m.team1_name, color: m.team1_color || "#00a040" });
    if (m.team2_id) map.set(m.team2_id, { id: m.team2_id, name: m.team2_name, color: m.team2_color || "#0055aa" });
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function makeEmptyRow(no = "", name = "", surname = "", position = "") {
  return {
    no,
    name,
    surname,
    position,
    played: 0,
    goals: 0,
    shots: 0,
    missed: 0,
    saved: 0,
    z6m: emptyMA(),
    z9m: emptyMA(),
    zWing: emptyMA(),
    zFB: emptyMA(),
    bt: emptyMA(),
    eg: emptyMA(),
    pen: 0,
    penAtt: 0,
    assists: 0,
    steals: 0,
    turnovers: 0,
    blocks: 0,
    yellow: 0,
    twoMin: 0,
    red: 0,
    r7m: 0,
    p7m: 0,
    rf: 0,
  };
}

function getSeasonBoxScore({ teamName }) {
  const name = String(teamName || "").trim();
  const key = nkey(name);
  const team = getDb().prepare("SELECT id, name, color FROM teams WHERE name_key = ?").get(key);
  if (!team) return null;
  const roster = getDb()
    .prepare("SELECT no, name, surname, position FROM team_players WHERE team_id = ?")
    .all(team.id);
  const matches = getDb()
    .prepare(
      `SELECT id, date, competition, team1_id, team2_id, team1_name, team2_name,
              team1_snapshot, team2_snapshot,
              score1, score2, shootout1, shootout2, finished_at
       FROM matches WHERE team1_id = ? OR team2_id = ? ORDER BY finished_at DESC`,
    )
    .all(team.id, team.id);
  const eventsStmt = getDb().prepare(
    `SELECT team, player_no, action, subtype, x, y, goal_x, goal_y, involver_no,
            rebound_team, rebound_no, fast_break, zone
     FROM match_events WHERE match_id = ?`,
  );

  const season = {
    teamName: team.name,
    teamColor: team.color || "#00a040",
    matchesCount: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    totals: makeEmptyRow("", "TOTALS"),
    players: [],
    matches: [],
    shotEvents: [],
  };

  const rowByNo = new Map();
  for (const p of roster) {
    seedNamedPlayer(rowByNo, p);
  }
  for (const m of matches) {
    const ownSide = m.team1_id === team.id ? 1 : 2;
    const snap = snapshotPlayers(ownSide === 1 ? m.team1_snapshot : m.team2_snapshot);
    for (const p of snap) seedNamedPlayer(rowByNo, p);
  }
  const playedInMatch = new Map();

  for (const m of matches) {
    const ownSide = m.team1_id === team.id ? 1 : 2;
    const ownScore = ownSide === 1 ? m.score1 : m.score2;
    const oppScore = ownSide === 1 ? m.score2 : m.score1;
    const ownSo = m.shootout1 != null && m.shootout2 != null ? (ownSide === 1 ? m.shootout1 : m.shootout2) : null;
    const oppSo = m.shootout1 != null && m.shootout2 != null ? (ownSide === 1 ? m.shootout2 : m.shootout1) : null;
    const opponent = ownSide === 1 ? m.team2_name : m.team1_name;
    let result;
    if (ownScore > oppScore) result = "W";
    else if (ownScore < oppScore) result = "L";
    else if (ownSo != null && oppSo != null && ownSo !== oppSo) result = ownSo > oppSo ? "W" : "L";
    else result = "D";

    season.matchesCount++;
    if (result === "W") season.wins++;
    else if (result === "L") season.losses++;
    else season.draws++;
    season.goalsFor += ownScore || 0;
    season.goalsAgainst += oppScore || 0;
    season.matches.push({
      matchId: m.id,
      date: m.date || new Date(m.finished_at).toISOString().slice(0, 10),
      competition: m.competition || "",
      opponent,
      ownScore,
      oppScore,
      ownShootout: ownSo,
      oppShootout: oppSo,
      result,
    });

    const events = eventsStmt.all(m.id).map(mapEvent);
    for (const e of events) {
      if (e.team !== ownSide) {
        const invNo = e.involver_no ? String(e.involver_no).trim() : "";
        if (invNo) {
          const row = rowByNo.get(invNo);
          if (row) {
            if (
              e.action === "FOUL" ||
              e.action === "7M" ||
              e.action === "2-MIN" ||
              e.action === "YELLOW" ||
              e.action === "RED" ||
              e.action === "BLUE"
            ) {
              row.rf++;
              if (e.action === "FOUL" && e.subtype === "7M") row.r7m++;
              (playedInMatch.get(invNo) || playedInMatch.set(invNo, new Set()).get(invNo)).add(m.id);
            }
            if (e.action === "TURNOVER") {
              row.steals++;
              (playedInMatch.get(invNo) || playedInMatch.set(invNo, new Set()).get(invNo)).add(m.id);
            }
          }
        }
        if (e.action === "SHOT MISSED" && e.subtype === "BLOCK") {
          const blockerNo = e.involver_no
            ? String(e.involver_no).trim()
            : e.rebound_team === ownSide && e.rebound_no
              ? String(e.rebound_no).trim()
              : "";
          if (blockerNo) {
            const row = rowByNo.get(blockerNo);
            if (row) {
              row.blocks++;
              (playedInMatch.get(blockerNo) || playedInMatch.set(blockerNo, new Set()).get(blockerNo)).add(m.id);
            }
          }
        }
        continue;
      }

      const pno = e.player_no ? String(e.player_no).trim() : "";
      if (!pno) continue;
      const row = rowByNo.get(pno);
      if (!row) continue;
      (playedInMatch.get(pno) || playedInMatch.set(pno, new Set()).get(pno)).add(m.id);

      const isShot = e.action === "GOAL" || e.action === "SHOT MISSED" || e.action === "SHOT SAVED" || e.action === "7M";
      const made = e.action === "GOAL" || e.action === "7M";
      if (isShot) {
        const isBtEg = e.subtype === "BREAK THROUGH" || e.subtype === "EMPTY GOAL";
        if (!isBtEg) {
          const z = classifyShotZoneOrOverride(e);
          if (z === "6m") {
            row.z6m.a++;
            if (made) row.z6m.g++;
          } else if (z === "9m") {
            row.z9m.a++;
            if (made) row.z9m.g++;
          } else if (z === "Wing") {
            row.zWing.a++;
            if (made) row.zWing.g++;
          }
          if (e.fast_break === true) {
            row.zFB.a++;
            if (made) row.zFB.g++;
          }
        }
        if (e.subtype === "BREAK THROUGH") {
          row.bt.a++;
          if (made) row.bt.g++;
        }
        if (e.subtype === "EMPTY GOAL") {
          row.eg.a++;
          if (made) row.eg.g++;
        }
        if (e.action === "7M" || e.subtype === "PENALTY") {
          row.penAtt++;
          if (made) row.pen++;
        }
        season.shotEvents.push({
          x: e.x,
          y: e.y,
          goalX: e.goal_x,
          goalY: e.goal_y,
          action: e.action,
          subtype: e.subtype || undefined,
          playerNo: pno,
          matchId: m.id,
        });
      }
      switch (e.action) {
        case "GOAL":
          row.goals++;
          row.shots++;
          break;
        case "7M":
          row.goals++;
          row.shots++;
          break;
        case "SHOT MISSED":
          row.shots++;
          row.missed++;
          break;
        case "SHOT SAVED":
          row.shots++;
          row.saved++;
          break;
        case "ASSIST":
          row.assists++;
          break;
        case "STEAL":
          row.steals++;
          break;
        case "TURNOVER":
          row.turnovers++;
          break;
        case "YELLOW":
          row.yellow++;
          break;
        case "2-MIN":
          row.twoMin++;
          break;
        case "RED":
          row.red++;
          break;
        case "FOUL":
          if (e.subtype === "7M") row.p7m++;
          break;
      }
    }
  }

  rowByNo.forEach((row, pno) => {
    row.played = playedInMatch.get(pno)?.size || 0;
  });
  const players = Array.from(rowByNo.values())
    .filter((r) => Boolean((r.name || "").trim() || (r.surname || "").trim()))
    .filter(
      (r) =>
        r.played > 0 ||
        r.goals > 0 ||
        r.shots > 0 ||
        r.assists > 0 ||
        r.twoMin > 0 ||
        r.yellow > 0 ||
        r.red > 0,
    )
    .sort((a, b) => b.goals - a.goals || a.no.localeCompare(b.no));
  season.players = players;

  const totals = season.totals;
  players.forEach((r) => {
    totals.goals += r.goals;
    totals.shots += r.shots;
    totals.missed += r.missed;
    totals.saved += r.saved;
    totals.z6m.g += r.z6m.g;
    totals.z6m.a += r.z6m.a;
    totals.z9m.g += r.z9m.g;
    totals.z9m.a += r.z9m.a;
    totals.zWing.g += r.zWing.g;
    totals.zWing.a += r.zWing.a;
    totals.zFB.g += r.zFB.g;
    totals.zFB.a += r.zFB.a;
    totals.bt.g += r.bt.g;
    totals.bt.a += r.bt.a;
    totals.eg.g += r.eg.g;
    totals.eg.a += r.eg.a;
    totals.pen += r.pen;
    totals.penAtt += r.penAtt;
    totals.assists += r.assists;
    totals.steals += r.steals;
    totals.turnovers += r.turnovers;
    totals.blocks += r.blocks;
    totals.yellow += r.yellow;
    totals.twoMin += r.twoMin;
    totals.red += r.red;
    totals.r7m += r.r7m;
    totals.p7m += r.p7m;
    totals.rf += r.rf;
  });

  return season;
}

function getStandingsConfig() {
  const settings = getDb()
    .prepare("SELECT points_win, points_draw, points_loss FROM tournament_settings WHERE key = 'default'")
    .get();
  const bonuses = getDb().prepare("SELECT team_name, bonus_08, bonus_10 FROM team_bonuses").all();
  const map = {};
  for (const r of bonuses) {
    map[nkey(r.team_name)] = {
      bonus_08: Number(r.bonus_08) || 0,
      bonus_10: Number(r.bonus_10) || 0,
    };
  }
  return {
    pointsWin: Number(settings?.points_win ?? 1),
    pointsDraw: Number(settings?.points_draw ?? 0.5),
    pointsLoss: Number(settings?.points_loss ?? 0),
    bonuses: map,
  };
}

function toFiniteNumber(v, fallback = 0) {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

function updateStandingsPoints({ pointsWin, pointsDraw, pointsLoss }) {
  getDb()
    .prepare(
      `INSERT INTO tournament_settings (key, points_win, points_draw, points_loss, updated_at)
       VALUES ('default', ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         points_win = excluded.points_win,
         points_draw = excluded.points_draw,
         points_loss = excluded.points_loss,
         updated_at = excluded.updated_at`,
    )
    .run(toFiniteNumber(pointsWin, 0), toFiniteNumber(pointsDraw, 0), toFiniteNumber(pointsLoss, 0), nowIso());
  return { ok: true };
}

function updateTeamBonus({ teamName, bonus_08, bonus_10 }) {
  const key = nkey(teamName);
  if (!key) throw new Error("Team name required");
  getDb()
    .prepare(
      `INSERT INTO team_bonuses (team_name, bonus_08, bonus_10, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(team_name) DO UPDATE SET
         bonus_08 = excluded.bonus_08,
         bonus_10 = excluded.bonus_10,
         updated_at = excluded.updated_at`,
    )
    .run(key, toFiniteNumber(bonus_08, 0), toFiniteNumber(bonus_10, 0), nowIso());
  return { ok: true };
}

module.exports = {
  initDatabase,
  getDatabasePath,
  checkpoint,
  closeDatabase,
  getDatabaseStatus,
  markOnboardingComplete,
  validateBackupFile,
  getSetting,
  setSetting,
  listTeams,
  saveTeam,
  deleteTeam,
  listMatches,
  saveMatch,
  deleteMatch,
  getMatchDetail,
  listPlayers,
  getPlayerReport,
  listSeasonTeams,
  getSeasonBoxScore,
  getStandingsConfig,
  updateStandingsPoints,
  updateTeamBonus,
};
