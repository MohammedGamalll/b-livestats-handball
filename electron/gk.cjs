function parseSubNos(raw) {
  if (!raw) return [];
  if (String(raw).includes("↔")) return String(raw).split("↔").map((s) => s.trim()).filter(Boolean);
  return [String(raw).trim()].filter(Boolean);
}

function parseSubPair(raw) {
  const parts = parseSubNos(raw);
  if (parts.length >= 2) return { inNo: parts[0], outNo: parts[1] };
  if (parts.length === 1) return { inNo: parts[0] };
  return {};
}

function eventHalf(e) {
  const h = Number(e?.half);
  return Number.isFinite(h) && h >= 1 ? h : undefined;
}

function isGkPosition(pos) {
  const r = String(pos || "").trim().toUpperCase();
  return r === "GK" || r === "GOALKEEPER" || r.startsWith("GK");
}

function isPostMiss(e) {
  if (e.action !== "SHOT MISSED") return false;
  const z = String(e.missZone || e.subtype || "").toUpperCase();
  return z === "POST" || z === "LEFT_CROSSBAR" || z === "RIGHT_CROSSBAR";
}

function isOffFrameMiss(e) {
  if (e.action !== "SHOT MISSED") return false;
  if (e.subtype === "SAVE" || e.subtype === "BLOCK") return false;
  return !isPostMiss(e);
}

function classifyGkShot(e) {
  if (e.subtype === "EMPTY GOAL") return null;
  if (e.action === "SHOT SAVED" || (e.action === "SHOT MISSED" && e.subtype === "SAVE")) return "save";
  if (e.action === "GOAL" || e.action === "7M") return "goal";
  if (isPostMiss(e)) return "post";
  return null;
}

function eventElapsedSec(e, halfLength, otLength, halves) {
  const [mm, ss] = String(e.clock || "00:00").split(":").map((v) => parseInt(v, 10) || 0);
  const clockSec = mm * 60 + ss;
  const half = eventHalf(e);
  if (half == null) return clockSec;
  let elapsedBefore = 0;
  for (let h = 1; h < half; h++) elapsedBefore += (h > halves ? otLength : halfLength) * 60;
  const thisLen = (half > halves ? otLength : halfLength) * 60;
  return elapsedBefore + Math.max(0, thisLen - clockSec);
}

function emptyKeeper(p) {
  return {
    no: String(p.no).trim(),
    name: `${p.name || ""} ${p.surname || ""}`.trim(),
    saves: 0,
    conceded: 0,
    posts: 0,
    faced: 0,
    savePct: 0,
    seconds: 0,
    minutes: 0,
    periodsPlayed: [],
    shareOfTeamSaves: 0,
    shareOfTeamFaced: 0,
    shotEvents: [],
  };
}

function rosterGks(team) {
  const players = Array.isArray(team?.players) ? team.players : [];
  const named = players.filter((p) => p.no && isGkPosition(p.position));
  if (named.length) return named;
  return players.filter((p) => p.no && (p.no === "1" || p.no === "12" || p.no === "16"));
}

function endOnCourt(team) {
  const players = Array.isArray(team?.players) ? team.players : [];
  return new Set(
    players.filter((p) => p.onCourt === true && !p.excluded).map((p) => String(p.no).trim()).filter(Boolean),
  );
}

function sortEvents(log, halfLength, otLength, halves) {
  return [...(log || [])]
    .map((e) => ({ e, t: eventElapsedSec(e, halfLength, otLength, halves), ts: e.ts || 0, half: eventHalf(e) ?? 0 }))
    .sort((a, b) => a.half - b.half || a.t - b.t || a.ts - b.ts);
}

function applyDirectedSub(onCourt, raw, reverse) {
  const { inNo, outNo } = parseSubPair(raw);
  if (inNo && outNo) {
    const enter = reverse ? outNo : inNo;
    const leave = reverse ? inNo : outNo;
    onCourt.delete(leave);
    onCourt.add(enter);
    return;
  }
  const only = inNo || outNo;
  if (!only) return;
  if (onCourt.has(only)) onCourt.delete(only);
  else onCourt.add(only);
}

function reconstructKickoffOnCourt(team, log, teamN, halfLength, otLength, halves) {
  const onCourt = endOnCourt(team);
  const reverse = [...sortEvents(log, halfLength, otLength, halves)].reverse();
  for (const { e } of reverse) {
    if (e.team !== teamN || e.action !== "SUBSTITUTION") continue;
    applyDirectedSub(onCourt, e.playerNo, true);
  }
  if (onCourt.size === 0) {
    const gks = rosterGks(team).sort((a, b) => (Number(a.no) || 0) - (Number(b.no) || 0));
    if (gks[0]?.no) onCourt.add(String(gks[0].no).trim());
    for (const p of team.players || []) {
      if (onCourt.size >= 7) break;
      const n = String(p.no || "").trim();
      if (n && !onCourt.has(n)) onCourt.add(n);
    }
  }
  return onCourt;
}

function currentGkNos(onCourt, gkNos) {
  return [...onCourt].filter((no) => gkNos.has(no)).sort((a, b) => (Number(a) || 0) - (Number(b) || 0));
}

function isGkSub(e, teamN, gkNos) {
  if (e.team !== teamN || e.action !== "SUBSTITUTION") return false;
  return parseSubNos(e.playerNo).some((n) => gkNos.has(n));
}

function gkSubInHalf(log, teamN, gkNos, half) {
  return (log || []).some((e) => isGkSub(e, teamN, gkNos) && eventHalf(e) === half);
}

function setCourtGk(onCourt, gkNos, next) {
  if (!next) return;
  for (const no of [...onCourt]) {
    if (gkNos.has(no) && no !== next) onCourt.delete(no);
  }
  onCourt.add(next);
}

function periodAtSec(sec, halfLength, otLength, halves) {
  let t = 0;
  let h = 1;
  for (;;) {
    const len = (h > halves ? otLength : halfLength) * 60;
    if (sec < t + len || h > halves + 8) return h;
    t += len;
    h++;
  }
}

function addPlayTime(keepers, gkNow, from, until, cfg) {
  const dt = Math.max(0, until - from);
  if (!dt || !gkNow.length) return;
  for (const no of gkNow) {
    const row = keepers.get(no);
    if (!row) continue;
    row.seconds += dt;
    const startP = periodAtSec(from, cfg.halfLength, cfg.otLength, cfg.halves);
    const endP = periodAtSec(Math.max(from, until - 1), cfg.halfLength, cfg.otLength, cfg.halves);
    for (let p = startP; p <= endP; p++) {
      if (!row.periodsPlayed.includes(p)) row.periodsPlayed.push(p);
    }
  }
}

function creditShot(row, e, kind, half) {
  if (!row) return;
  if (kind === "save") row.saves++;
  else if (kind === "goal") row.conceded++;
  else row.posts++;
  if (half >= 1 && !row.periodsPlayed.includes(half)) row.periodsPlayed.push(half);
  row.shotEvents.push({
    eventId: e.id,
    half,
    action: kind === "post" ? "SHOT MISSED" : kind === "save" ? "SHOT SAVED" : e.action,
    kind,
    goalX: e.goalX,
    goalY: e.goalY,
    missZone: e.missZone,
  });
}

function finalize(team, keepers) {
  const list = [...keepers.values()].sort((a, b) => (Number(a.no) || 0) - (Number(b.no) || 0));
  const teamSaves = list.reduce((a, k) => a + k.saves, 0);
  const teamConceded = list.reduce((a, k) => a + k.conceded, 0);
  const teamPosts = list.reduce((a, k) => a + k.posts, 0);
  const teamFaced = teamSaves + teamConceded;
  for (const k of list) {
    k.faced = k.saves + k.conceded;
    k.savePct = k.faced > 0 ? (k.saves / k.faced) * 100 : 0;
    k.minutes = Math.round(k.seconds / 60);
    k.periodsPlayed.sort((a, b) => a - b);
    k.shareOfTeamSaves = teamSaves > 0 ? (k.saves / teamSaves) * 100 : 0;
    k.shareOfTeamFaced = teamFaced > 0 ? (k.faced / teamFaced) * 100 : 0;
  }
  return {
    teamName: team.name || "",
    teamColor: team.color || "#111",
    teamSaves,
    teamConceded,
    teamPosts,
    teamFaced,
    teamSavePct: teamFaced > 0 ? (teamSaves / teamFaced) * 100 : 0,
    keepers: list,
  };
}

function attributeGoalkeepers(team, log, teamN, opts) {
  const halves = opts?.halves || 2;
  const halfLength = opts?.halfLength || 30;
  const otLength = opts?.otLength || 5;
  const cfg = { halves, halfLength, otLength };
  const gks = rosterGks(team);
  const gkNos = new Set(gks.map((g) => String(g.no).trim()));
  const keepers = new Map();
  for (const g of gks) keepers.set(String(g.no).trim(), emptyKeeper(g));
  const opp = teamN === 1 ? 2 : 1;
  const timed = sortEvents(log, halfLength, otLength, halves);
  let maxHalf = halves;
  for (const e of log || []) {
    const h = eventHalf(e);
    if (h != null && h > maxHalf) maxHalf = h;
  }
  let matchEnd = 0;
  for (let h = 1; h <= maxHalf; h++) matchEnd += (h > halves ? otLength : halfLength) * 60;

  const kickoff = reconstructKickoffOnCourt(team, log, teamN, halfLength, otLength, halves);
  const endGk = currentGkNos(endOnCourt(team), gkNos)[0] || currentGkNos(kickoff, gkNos)[0] || (gks[0] ? String(gks[0].no).trim() : "");
  const otherGk = [...gkNos].find((n) => n && n !== endGk) || "";
  const kickoffGk = currentGkNos(kickoff, gkNos)[0] || "";
  const starterGk = otherGk && endGk && otherGk !== endGk ? otherGk : kickoffGk || endGk;
  const secondGk = endGk || [...gkNos].find((n) => n !== starterGk) || starterGk;
  const gkForHalf = (h) => (h <= 1 ? starterGk : secondGk);

  let onCourt = new Set(kickoff);
  if (gks.length >= 2 && starterGk) setCourtGk(onCourt, gkNos, starterGk);
  let lastT = 0;
  let currentHalf = 1;
  let gkNow = currentGkNos(onCourt, gkNos);

  for (const { e, t } of timed) {
    const h = eventHalf(e);
    if (h != null && h > currentHalf) {
      addPlayTime(keepers, gkNow, lastT, t, cfg);
      lastT = t;
      if (!isGkSub(e, teamN, gkNos) && gks.length >= 2 && !gkSubInHalf(log, teamN, gkNos, h)) {
        setCourtGk(onCourt, gkNos, gkForHalf(h));
        gkNow = currentGkNos(onCourt, gkNos);
      }
      currentHalf = h;
    }

    addPlayTime(keepers, gkNow, lastT, t, cfg);
    lastT = t;

    if (e.team === teamN && e.action === "SUBSTITUTION") {
      applyDirectedSub(onCourt, e.playerNo, false);
      gkNow = currentGkNos(onCourt, gkNos);
    } else if (
      e.team === teamN &&
      (e.action === "2-MIN" || e.action === "RED" || e.action === "BLUE") &&
      e.playerNo &&
      gkNos.has(e.playerNo)
    ) {
      onCourt.delete(e.playerNo);
      gkNow = currentGkNos(onCourt, gkNos);
    }

    if (e.team === opp) {
      const kind = classifyGkShot(e);
      if (kind && gkNow.length >= 1) creditShot(keepers.get(gkNow[0]), e, kind, h ?? currentHalf);
    }
  }
  addPlayTime(keepers, gkNow, lastT, matchEnd, cfg);
  return finalize(team, keepers);
}

function keeperByNo(report, no) {
  const k = String(no || "").trim();
  return (report.keepers || []).find((g) => g.no === k);
}

function summarizeTeamShots(log, shootingTeam) {
  let goals = 0;
  let saves = 0;
  let posts = 0;
  let off = 0;
  for (const e of log || []) {
    if (e.team !== shootingTeam) continue;
    if (e.action === "GOAL" || e.action === "7M") goals++;
    else if (e.action === "SHOT SAVED" || (e.action === "SHOT MISSED" && e.subtype === "SAVE")) saves++;
    else if (isPostMiss(e)) posts++;
    else if (isOffFrameMiss(e)) off++;
  }
  return { goals, saves, posts, off, total: goals + saves + posts + off };
}

module.exports = {
  attributeGoalkeepers,
  keeperByNo,
  isGkPosition,
  classifyGkShot,
  eventHalf,
  summarizeTeamShots,
  isOffFrameMiss,
  isPostMiss,
};
