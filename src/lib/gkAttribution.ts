import type { LogEntry, Player, TeamSetup } from "@/lib/gameStore";
import { periodTitle } from "@/lib/periods";

export function parseSubNos(raw?: string): string[] {
  if (!raw) return [];
  if (raw.includes("↔")) return raw.split("↔").map((s) => s.trim()).filter(Boolean);
  return [raw.trim()].filter(Boolean);
}

export function parseSubPair(raw?: string): { inNo?: string; outNo?: string } {
  const parts = parseSubNos(raw);
  if (parts.length >= 2) return { inNo: parts[0], outNo: parts[1] };
  if (parts.length === 1) return { inNo: parts[0] };
  return {};
}

export function eventHalf(e: { half?: number }): number | undefined {
  const h = Number(e.half);
  return Number.isFinite(h) && h >= 1 ? h : undefined;
}

export function isGkPosition(pos?: string): boolean {
  const r = String(pos || "").trim().toUpperCase();
  return r === "GK" || r === "GOALKEEPER" || r.startsWith("GK");
}

export function isPostMiss(e: { action?: string; missZone?: string; subtype?: string }): boolean {
  if (e.action !== "SHOT MISSED") return false;
  const z = String(e.missZone || e.subtype || "").toUpperCase();
  return z === "POST" || z === "LEFT_CROSSBAR" || z === "RIGHT_CROSSBAR";
}

export function isOffFrameMiss(e: { action?: string; missZone?: string; subtype?: string }): boolean {
  if (e.action !== "SHOT MISSED") return false;
  if (e.subtype === "SAVE" || e.subtype === "BLOCK") return false;
  return !isPostMiss(e);
}

export function classifyGkShot(e: { action?: string; subtype?: string; missZone?: string }): "save" | "goal" | "post" | null {
  if (e.subtype === "EMPTY GOAL") return null;
  if (e.action === "SHOT SAVED" || (e.action === "SHOT MISSED" && e.subtype === "SAVE")) return "save";
  if (e.action === "GOAL" || e.action === "7M") return "goal";
  if (isPostMiss(e)) return "post";
  return null;
}

export function eventElapsedSec(
  e: { clock?: string; half?: number },
  halfLength: number,
  otLength: number,
  halves: number,
): number {
  const [mm, ss] = String(e.clock || "00:00").split(":").map((v) => parseInt(v, 10) || 0);
  const clockSec = mm * 60 + ss;
  const half = eventHalf(e);
  if (half == null) return clockSec;
  let elapsedBefore = 0;
  for (let h = 1; h < half; h++) elapsedBefore += (h > halves ? otLength : halfLength) * 60;
  const thisLen = (half > halves ? otLength : halfLength) * 60;
  return elapsedBefore + Math.max(0, thisLen - clockSec);
}

export interface GkShotMark {
  eventId: string;
  half: number;
  action: string;
  kind: "save" | "goal" | "post";
  goalX?: number;
  goalY?: number;
  missZone?: string;
}

export interface GkKeeperStats {
  no: string;
  name: string;
  saves: number;
  conceded: number;
  posts: number;
  faced: number;
  savePct: number;
  seconds: number;
  minutes: number;
  periodsPlayed: number[];
  shareOfTeamSaves: number;
  shareOfTeamFaced: number;
  shotEvents: GkShotMark[];
}

export interface GkTeamReport {
  teamName: string;
  teamColor: string;
  teamSaves: number;
  teamConceded: number;
  teamPosts: number;
  teamFaced: number;
  teamSavePct: number;
  keepers: GkKeeperStats[];
}

export interface GkAttrOpts {
  halves?: number;
  halfLength?: number;
  otLength?: number;
}

function emptyKeeper(p: { no: string; name?: string; surname?: string }): GkKeeperStats {
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

function rosterGks(team: TeamSetup): Player[] {
  const named = team.players.filter((p) => p.no && isGkPosition(p.position));
  if (named.length) return named;
  return team.players.filter((p) => p.no && (p.no === "1" || p.no === "12" || p.no === "16"));
}

function endOnCourt(team: TeamSetup): Set<string> {
  const explicit = team.players.filter((p) => p.onCourt === true && !p.excluded).map((p) => String(p.no).trim()).filter(Boolean);
  return new Set(explicit);
}

function sortEvents(log: LogEntry[], halfLength: number, otLength: number, halves: number) {
  return log
    .map((e) => ({ e, t: eventElapsedSec(e, halfLength, otLength, halves), ts: e.ts || 0, half: eventHalf(e) ?? 0 }))
    .sort((a, b) => a.half - b.half || a.t - b.t || a.ts - b.ts);
}

function applyDirectedSub(onCourt: Set<string>, raw: string | undefined, reverse: boolean) {
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

function reconstructKickoffOnCourt(
  team: TeamSetup,
  log: LogEntry[],
  teamN: 1 | 2,
  halfLength: number,
  otLength: number,
  halves: number,
): Set<string> {
  const onCourt = endOnCourt(team);
  const reverse = [...sortEvents(log, halfLength, otLength, halves)].reverse();
  for (const { e } of reverse) {
    if (e.team !== teamN || e.action !== "SUBSTITUTION") continue;
    applyDirectedSub(onCourt, e.playerNo, true);
  }
  if (onCourt.size === 0) {
    const gks = rosterGks(team).sort((a, b) => (Number(a.no) || 0) - (Number(b.no) || 0));
    if (gks[0]?.no) onCourt.add(String(gks[0].no).trim());
    for (const p of team.players) {
      if (onCourt.size >= 7) break;
      const no = String(p.no || "").trim();
      if (no && !onCourt.has(no)) onCourt.add(no);
    }
  }
  return onCourt;
}

function currentGkNos(onCourt: Set<string>, gkNos: Set<string>): string[] {
  return [...onCourt].filter((no) => gkNos.has(no)).sort((a, b) => (Number(a) || 0) - (Number(b) || 0));
}

function isGkSub(e: LogEntry, teamN: 1 | 2, gkNos: Set<string>): boolean {
  if (e.team !== teamN || e.action !== "SUBSTITUTION") return false;
  return parseSubNos(e.playerNo).some((n) => gkNos.has(n));
}

function gkSubInHalf(log: LogEntry[], teamN: 1 | 2, gkNos: Set<string>, half: number): boolean {
  return log.some((e) => isGkSub(e, teamN, gkNos) && eventHalf(e) === half);
}

function setCourtGk(onCourt: Set<string>, gkNos: Set<string>, next: string) {
  if (!next) return;
  for (const no of [...onCourt]) {
    if (gkNos.has(no) && no !== next) onCourt.delete(no);
  }
  onCourt.add(next);
}

function periodAtSec(sec: number, halfLength: number, otLength: number, halves: number): number {
  let t = 0;
  let h = 1;
  while (true) {
    const len = (h > halves ? otLength : halfLength) * 60;
    if (sec < t + len || h > halves + 8) return h;
    t += len;
    h++;
  }
}

function addPlayTime(keepers: Map<string, GkKeeperStats>, gkNow: string[], from: number, until: number, opts: Required<GkAttrOpts>) {
  const dt = Math.max(0, until - from);
  if (!dt || !gkNow.length) return;
  for (const no of gkNow) {
    const row = keepers.get(no);
    if (!row) continue;
    row.seconds += dt;
    const startP = periodAtSec(from, opts.halfLength, opts.otLength, opts.halves);
    const endP = periodAtSec(Math.max(from, until - 1), opts.halfLength, opts.otLength, opts.halves);
    for (let p = startP; p <= endP; p++) {
      if (!row.periodsPlayed.includes(p)) row.periodsPlayed.push(p);
    }
  }
}

function creditShot(row: GkKeeperStats | undefined, e: LogEntry, kind: "save" | "goal" | "post", half: number) {
  if (!row) return;
  if (kind === "save") row.saves++;
  else if (kind === "goal") row.conceded++;
  else row.posts++;
  if (half >= 1 && !row.periodsPlayed.includes(half)) row.periodsPlayed.push(half);
  const action = kind === "post" ? "SHOT MISSED" : kind === "save" ? "SHOT SAVED" : e.action;
  row.shotEvents.push({
    eventId: e.id,
    half,
    action,
    kind,
    goalX: e.goalX,
    goalY: e.goalY,
    missZone: e.missZone,
  });
}

function finalize(team: TeamSetup, keepers: Map<string, GkKeeperStats>): GkTeamReport {
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

export function attributeGoalkeepers(
  team: TeamSetup,
  log: LogEntry[],
  teamN: 1 | 2,
  opts: GkAttrOpts = {},
): GkTeamReport {
  const halves = opts.halves || 2;
  const halfLength = opts.halfLength || 30;
  const otLength = opts.otLength || 5;
  const cfg = { halves, halfLength, otLength };
  const gks = rosterGks(team);
  const gkNos = new Set(gks.map((g) => String(g.no).trim()));
  const keepers = new Map<string, GkKeeperStats>();
  for (const g of gks) keepers.set(String(g.no).trim(), emptyKeeper(g));

  const opp = (teamN === 1 ? 2 : 1) as 1 | 2;
  const timed = sortEvents(log, halfLength, otLength, halves);
  let maxHalf = halves;
  for (const e of log) {
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

  const gkForHalf = (h: number) => (h <= 1 ? starterGk : secondGk);

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
    } else if (e.team === teamN && (e.action === "2-MIN" || e.action === "RED" || e.action === "BLUE") && e.playerNo && gkNos.has(e.playerNo)) {
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

export function keeperByNo(report: GkTeamReport, no: string): GkKeeperStats | undefined {
  const k = String(no || "").trim();
  return report.keepers.find((g) => g.no === k);
}

export function formatGkPlayed(
  k: { minutes: number; periodsPlayed: number[] },
  halves = 2,
): string {
  if (k.periodsPlayed.length) {
    return k.periodsPlayed.map((p) => periodTitle(p, halves)).join(" / ");
  }
  if (k.minutes > 0) return `${k.minutes} min`;
  return "—";
}

export function summarizeTeamShots(log: LogEntry[], shootingTeam: 1 | 2) {
  let goals = 0;
  let saves = 0;
  let posts = 0;
  let off = 0;
  for (const e of log) {
    if (e.team !== shootingTeam) continue;
    if (e.action === "GOAL" || e.action === "7M") goals++;
    else if (e.action === "SHOT SAVED" || (e.action === "SHOT MISSED" && e.subtype === "SAVE")) saves++;
    else if (isPostMiss(e)) posts++;
    else if (isOffFrameMiss(e)) off++;
  }
  return { goals, saves, posts, off, total: goals + saves + posts + off };
}
