import type { LogEntry, TeamSetup } from "./gameStore";
import { attributeGoalkeepers, type GkAttrOpts } from "./gkAttribution";

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function logToCsv(log: LogEntry[], team1: TeamSetup, team2: TeamSetup) {
  const rows: (string | number)[][] = [
    ["#", "Half", "Clock", "Team", "Player#", "PlayerName", "Action", "Subtype", "X", "Y"],
  ];
  // chronological order
  const ordered = [...log].reverse();
  ordered.forEach((e, i) => {
    const team = e.team === 1 ? team1 : e.team === 2 ? team2 : null;
    const pl = team?.players.find((p) => p.no === e.playerNo);
    rows.push([
      i + 1,
      e.half,
      e.clock,
      team?.name ?? "",
      e.playerNo ?? "",
      pl ? `${pl.name} ${pl.surname}`.trim() : "",
      e.action,
      e.subtype ?? "",
      e.x ?? "",
      e.y ?? "",
    ]);
  });
  return rows;
}


export interface PlayerStat {
  no: string;
  name: string;
  goals: number;
  shots: number;
  missed: number;
  saved: number;
  pen: number;     // 7m made
  penAtt: number;  // 7m attempts (made + missed + saved)
  assists: number;
  steals: number;
  turnovers: number;
  blocks: number;
  yellow: number;
  twoMin: number;
  red: number;
  blue: number;
  inTarget: number;
  outTarget: number;
  fouls: number;
}

export function buildBoxScore(log: LogEntry[], team: TeamSetup, teamN: 1 | 2): PlayerStat[] {
  const map = new Map<string, PlayerStat>();
  team.players.forEach((p) => {
    map.set(p.no, {
      no: p.no,
      name: `${p.name} ${p.surname}`.trim(),
      goals: 0, shots: 0, missed: 0, saved: 0, pen: 0, penAtt: 0,
      assists: 0, steals: 0, turnovers: 0, blocks: 0,
      yellow: 0, twoMin: 0, red: 0, blue: 0, inTarget: 0, outTarget: 0,
      fouls: 0,
    });
  });
  log.forEach((e) => {
    // own-player events
    if (e.team === teamN && e.playerNo) {
      const s = map.get(e.playerNo);
      if (s) {
        const isPenSub = e.subtype === "PENALTY";
        switch (e.action) {
          case "GOAL": s.goals++; s.shots++; s.inTarget++; break;
          case "SHOT MISSED":
            s.missed++; s.shots++;
            if (e.subtype === "SAVE") s.inTarget++;
            else s.outTarget++;
            if (isPenSub) s.penAtt++;
            break;
          case "SHOT SAVED":
            s.saved++; s.shots++; s.inTarget++;
            if (isPenSub) s.penAtt++;
            break;
          case "7M": s.goals++; s.shots++; s.pen++; s.penAtt++; s.inTarget++; break;
          case "ASSIST": s.assists++; break;
          case "STEAL": s.steals++; break;
          case "TURNOVER": s.turnovers++; break;
          case "BLOCK": /* legacy entries only — no credit to shooter */ break;
          case "YELLOW": s.yellow++; s.fouls++; break;
          case "2-MIN": s.twoMin++; s.fouls++; break;
          case "RED": s.red++; /* ejection is not a foul */ break;
          case "BLUE": s.blue++; s.fouls++; break;
          case "FOUL": s.fouls++; break;
        }
      }
    }
    // opponent events with involver referring to our player
    if (e.team && e.team !== teamN && e.involverNo) {
      const s = map.get(e.involverNo);
      if (s) {
        // opponent turnover caused by our player → credit a steal
        if (e.action === "TURNOVER") s.steals++;
      }
    }
    // opponent missed via BLOCK → defender (our team) credited with the block.
    // Prefer the explicit blocker (involverNo, new flow); fall back to reboundNo (legacy flow).
    if (e.team && e.team !== teamN && e.action === "SHOT MISSED" && e.subtype === "BLOCK") {
      if (e.involverNo) {
        const s = map.get(e.involverNo);
        if (s) s.blocks++;
      } else if (e.reboundTeam === teamN && e.reboundNo) {
        const s = map.get(e.reboundNo);
        if (s) s.blocks++;
      }
    }
  });
  return Array.from(map.values()).filter((s) => s.no);
}


export interface TeamTotals {
  goals: number; shots: number; missed: number; saved: number; pen: number; penAtt: number;
  assists: number; steals: number; turnovers: number; blocks: number;
  yellow: number; twoMin: number; red: number; blue: number;
  timeouts: number;
  shotPct: number;
  inTarget: number;
  outTarget: number;
  fouls: number;
}

export function buildTeamTotals(log: LogEntry[], teamN: 1 | 2, timeouts: number): TeamTotals {
  const t: TeamTotals = {
    goals: 0, shots: 0, missed: 0, saved: 0, pen: 0, penAtt: 0,
    assists: 0, steals: 0, turnovers: 0, blocks: 0,
    yellow: 0, twoMin: 0, red: 0, blue: 0, timeouts, shotPct: 0,
    inTarget: 0, outTarget: 0,
    fouls: 0,
  };
  log.forEach((e) => {
    if (e.team === teamN) {
      const isPenSub = e.subtype === "PENALTY";
      switch (e.action) {
        case "GOAL": t.goals++; t.shots++; t.inTarget++; break;
        case "SHOT MISSED":
          t.missed++; t.shots++;
          if (e.subtype === "SAVE") t.inTarget++;
          else t.outTarget++;
          if (isPenSub) t.penAtt++;
          break;
        case "SHOT SAVED":
          t.saved++; t.shots++; t.inTarget++;
          if (isPenSub) t.penAtt++;
          break;
        case "7M": t.goals++; t.shots++; t.pen++; t.penAtt++; t.inTarget++; break;
        case "ASSIST": t.assists++; break;
        case "STEAL": t.steals++; break;
        case "TURNOVER": t.turnovers++; break;
        case "BLOCK": /* legacy only */ break;
        case "YELLOW": t.yellow++; t.fouls++; break;
        case "2-MIN": t.twoMin++; t.fouls++; break;
        case "RED": t.red++; /* ejection is not a foul */ break;
        case "BLUE": t.blue++; t.fouls++; break;
        case "FOUL": t.fouls++; break;
      }
    } else if (e.team && e.involverNo && e.action === "TURNOVER") {
      // opponent turnover with our player as involver → team steal
      t.steals++;
    }
    // opponent missed via BLOCK → team block credit (prefer new involverNo flow; fall back to rebound-based legacy)
    if (e.team && e.team !== teamN && e.action === "SHOT MISSED" && e.subtype === "BLOCK") {
      if (e.involverNo || e.reboundTeam === teamN) t.blocks++;
    }
  });
  t.shotPct = t.shots ? (t.goals / t.shots) * 100 : 0;
  return t;
}



export interface GoalkeeperStat {
  no: string;
  name: string;
  saves: number;
  goalsConceded: number;
  posts?: number;
  minutes?: number;
  periodsPlayed?: number[];
  shareOfTeamSaves?: number;
}

export function buildGoalkeeperStats(
  log: LogEntry[],
  team: TeamSetup,
  teamN: 1 | 2,
  opts: GkAttrOpts = {},
): GoalkeeperStat[] {
  const report = attributeGoalkeepers(team, log, teamN, opts);
  return report.keepers.map((g) => ({
    no: g.no,
    name: g.name,
    saves: g.saves,
    goalsConceded: g.conceded,
    posts: g.posts,
    minutes: g.minutes,
    periodsPlayed: g.periodsPlayed,
    shareOfTeamSaves: g.shareOfTeamSaves,
  }));
}

export function gkSavePct(s: GoalkeeperStat) {
  const faced = s.saves + s.goalsConceded;
  return faced ? Math.round((s.saves / faced) * 100) : 0;
}
