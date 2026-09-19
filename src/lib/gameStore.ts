import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createLiveStateStorage } from "./liveStorage";
import type { ActionType } from "./handball";

export interface Official { name: string; surname: string; role: string; country: string; shirtNo: string; }
export interface Coach { name: string; surname: string; role: string; country: string; }
export interface Player {
  id: string;
  no: string;
  name: string;
  surname: string;
  height: string;
  position: string;
  addInfo: string;
  captain: boolean;
  playing: boolean;
  onCourt?: boolean;
  excluded?: boolean;
}

export interface TeamSetup {
  name: string;
  shortName: string;
  shortCode: string;
  longCode: string;
  color: string;
  coaches: Coach[];
  players: Player[];
}

export type MissZone = "LEFT_CORNER" | "RIGHT_CORNER" | "LEFT_CROSSBAR" | "RIGHT_CROSSBAR" | "POST";

export interface LogEntry {
  id: string;
  ts: number;
  team: 1 | 2 | null;
  playerNo?: string;
  action: ActionType | string;
  half: number;
  clock: string;
  /** true = clock is elapsed (00:00 → 30:00). omitted/false = legacy remaining countdown. */
  clockElapsed?: boolean;
  x?: number; // 0..1 court coord (shot origin)
  y?: number; // 0..1 court coord (shot origin)
  goalX?: number; // 0..1 placement inside goal mouth
  goalY?: number; // 0..1 placement inside goal mouth
  missZone?: MissZone; // for SHOT MISSED
  subtype?: string; // shot style / foul type / turnover reason
  assistNo?: string; // player # who assisted (own team) on a MADE shot
  reboundNo?: string; // player # who got the rebound on a MISSED shot
  reboundTeam?: 1 | 2; // team of the rebounding player (used for BLOCK where both teams can recover)
  involverNo?: string; // opposing player # involved (e.g. fouled, caused turnover)
  fastBreak?: boolean; // FB flag — counted as Fast Break in reports
  zone?: "6m" | "9m" | "7m" | "Wing"; // user-confirmed shot zone (overrides geometry in reports)
  defense?: "6/0" | "5/1" | "4/2" | "3/3" | "M2M" | "5/0" | "4/1" | "EMPTY"; // defensive formation of the DEFENDING team at the moment of this action
  // Strength situation override (user-confirmed at the moment of the action).
  // When present, these take precedence over the auto-derived timeline strength in reports.
  strengthAttack?: number;        // field players count for the acting team (3..7)
  strengthDefend?: number;        // field players count for the opposing team (3..7)
  strengthAttackEmpty?: boolean;  // acting team pulled GK (7v6 case)
  strengthDefendEmpty?: boolean;  // defending team has no GK on court → "Empty Goal" tag
}


export interface Suspension {
  id: string;
  team: 1 | 2;
  playerNo: string;
  startedAtClockSec: number; // clock value when issued
  startedHalf: number;
  remainingSec: number; // counts down with clock
}

interface GameInfo {
  gameNumber: string;
  competition: string;
  season: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  country: string;
  court: string;
  spectators: string;
  gameType: string;
  halves: number;
  halfLength: number;
  otLength: number;
  officials: Official[];
}

export interface FormationPos { x: number; y: number }
export type Formation = Record<string, FormationPos>;
export type TeamDirection = "left" | "right";

interface State {
  info: GameInfo;
  team1: TeamSetup;
  team2: TeamSetup;
  homeIsTeam1: boolean;
  team1Direction: TeamDirection;
  /** Attack-own side for team 1 at the start/use of each half — used to place 7m spots on historical courts. */
  halfDirections: Record<number, TeamDirection>;
  setupComplete: boolean;

  // live
  score1: number;
  score2: number;
  possession: 1 | 2 | null;
  half: number;
  clockSec: number;
  clockCountUp: boolean;
  clockRunning: boolean;
  clockOriginMs: number | null;
  clockOriginSec: number;
  timeouts1: number;
  timeouts2: number;
  suspensions1: number;
  suspensions2: number;
  activeSuspensions: Suspension[];
  log: LogEntry[];
  persistRev: number;
  formation1: Formation;
  formation2: Formation;
  lineupTemplates: { left: Record<string, { x: number; y: number }>; right: Record<string, { x: number; y: number }> };
  shootoutRounds: { t1: ("G" | "M" | null); t2: ("G" | "M" | null); t1Player?: string; t2Player?: string }[];

  // setters
  setInfo: (p: Partial<GameInfo>) => void;
  setOfficial: (i: number, p: Partial<Official>) => void;
  setTeam: (n: 1 | 2, p: Partial<TeamSetup>) => void;
  setCoach: (n: 1 | 2, i: number, p: Partial<Coach>) => void;
  addPlayer: (n: 1 | 2) => void;
  setPlayer: (n: 1 | 2, id: string, p: Partial<Player>) => void;
  removePlayer: (n: 1 | 2, id: string) => void;
  switchSides: () => void;
  switchHomeAway: () => void;
  swapTeams: () => void;
  setSetupComplete: (b: boolean) => void;

  startClock: () => void;
  stopClock: () => void;
  tick: () => void;
  setClockSec: (s: number) => void;
  setHalf: (h: number) => void;
  setPossession: (t: 1 | 2 | null) => void;
  logAction: (e: Omit<LogEntry, "id" | "ts" | "half" | "clock">) => void;
  updateLogEntry: (id: string, patch: Partial<LogEntry>) => void;
  deleteLogEntry: (id: string) => void;
  undoLast: () => void;
  reset: () => void;
  // demo removed
  setFormationPos: (n: 1 | 2, playerId: string, pos: FormationPos | null) => void;
  clearFormation: (n: 1 | 2) => void;
  autoArrangeFormation: (n: 1 | 2) => void;
  saveLineupTemplate: (n: 1 | 2) => void;
  clearLineupTemplate: (side?: "left" | "right") => void;
  setShootoutRound: (i: number, team: "t1" | "t2", v: "G" | "M" | null) => void;
  setShootoutPlayer: (i: number, team: "t1" | "t2", playerNo: string) => void;
  addShootoutRound: () => void;
  removeShootoutRound: (i: number) => void;
  clearShootout: () => void;
}

const makeId = (prefix: string) => {
  const globalCrypto = globalThis.crypto;
  if (globalCrypto && typeof globalCrypto.randomUUID === "function") {
    return globalCrypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${String(makeIdCounter++).padStart(4, "0")}`;
};

let makeIdCounter = 0;

const bump = (s: { persistRev?: number }, patch: Partial<State>): Partial<State> => ({
  ...patch,
  persistRev: Math.max(Date.now(), (s.persistRev ?? 0) + 1),
});

const blankTeam = (name: string, color: string): TeamSetup => ({
  name,
  shortName: "",
  shortCode: "",
  longCode: "",
  color,
  coaches: [
    { name: "", surname: "", role: "Head Coach", country: "" },
    { name: "", surname: "", role: "Assistant Coach", country: "" },
    { name: "", surname: "", role: "Assistant Coach", country: "" },
  ],
  players: Array.from({ length: 5 }).map((_, i) => ({
    id: `blank-${color}-${i}`,
    no: "",
    name: "",
    surname: "",
    height: "",
    position: "",
    addInfo: "",
    captain: false,
    playing: false,
    _i: i,
  } as Player)),
});

const blankInfo = (): GameInfo => ({
  gameNumber: "",
  competition: "",
  season: "",
  date: "",
  time: "",
  venue: "",
  city: "",
  country: "",
  court: "",
  spectators: "",
  gameType: "Handball",
  halves: 2,
  halfLength: 30,
  otLength: 5,
  officials: [
    { name: "", surname: "", role: "Referee 1", country: "", shirtNo: "" },
    { name: "", surname: "", role: "Referee 2", country: "", shirtNo: "" },
    { name: "", surname: "", role: "Scorekeeper", country: "", shirtNo: "" },
    { name: "", surname: "", role: "Timekeeper", country: "", shirtNo: "" },
    { name: "", surname: "", role: "Delegate", country: "", shirtNo: "" },
  ],
});

const fmtClock = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

function parseClockToSec(clock?: string): number {
  const [mm, ss] = String(clock || "00:00").split(":").map((v) => parseInt(v, 10) || 0);
  return mm * 60 + ss;
}

export function periodLengthSec(half: number, halves: number, halfLength: number, otLength: number): number {
  return (half > halves ? otLength : halfLength) * 60;
}

function storePeriodLen(s: { half: number; info: GameInfo }): number {
  return periodLengthSec(s.half, s.info.halves, s.info.halfLength, s.info.otLength);
}

function wallElapsedSec(s: { clockRunning: boolean; clockSec: number; clockOriginMs: number | null; clockOriginSec: number; half: number; info: GameInfo }): number {
  const limit = storePeriodLen(s);
  if (!s.clockRunning || s.clockOriginMs == null) return Math.min(limit, Math.max(0, s.clockSec));
  return Math.min(limit, Math.max(0, s.clockOriginSec + Math.floor((Date.now() - s.clockOriginMs) / 1000)));
}

function applyClockTo(s: State, nextSec: number, running: boolean): Partial<State> {
  const limit = storePeriodLen(s);
  const next = Math.min(limit, Math.max(0, nextSec));
  const delta = Math.max(0, next - s.clockSec);
  let team1 = s.team1;
  let team2 = s.team2;
  let activeSuspensions = s.activeSuspensions;
  if (delta > 0 && activeSuspensions.length) {
    const ticked = activeSuspensions.map((su) => ({ ...su, remainingSec: Math.max(0, su.remainingSec - delta) }));
    const expired = ticked.filter((su) => su.remainingSec === 0);
    activeSuspensions = ticked.filter((su) => su.remainingSec > 0);
    if (expired.length) {
      const restore = (t: TeamSetup, team: 1 | 2): TeamSetup => {
        const nos = expired.filter((su) => su.team === team).map((su) => su.playerNo);
        if (!nos.length) return t;
        return { ...t, players: t.players.map((p) => (nos.includes(p.no) && !p.excluded ? { ...p, onCourt: true } : p)) };
      };
      team1 = restore(team1, 1);
      team2 = restore(team2, 2);
    }
  }
  const over = next >= limit;
  return {
    clockSec: next,
    clockRunning: over ? false : running,
    clockOriginMs: over || !running ? null : s.clockOriginMs,
    activeSuspensions,
    team1,
    team2,
  };
}

function migrateCountdownToElapsed<T extends Partial<State>>(p: T): T {
  if (p.clockCountUp === true) return p;
  const info = { ...blankInfo(), ...(p.info || {}) };
  const half = p.half ?? 1;
  const limit = periodLengthSec(half, info.halves, info.halfLength, info.otLength);
  const clockSec = typeof p.clockSec === "number" ? Math.max(0, Math.min(limit, limit - p.clockSec)) : 0;
  const log = (p.log || []).map((e) => {
    if (e.clockElapsed) return e;
    const h = Number(e.half) || half;
    const thisLen = periodLengthSec(h, info.halves, info.halfLength, info.otLength);
    const remaining = parseClockToSec(e.clock);
    return { ...e, clock: fmtClock(Math.max(0, Math.min(thisLen, thisLen - remaining))), clockElapsed: true };
  });
  return { ...p, clockSec, log, clockCountUp: true };
}

function mirrorFormation(f: Formation): Formation {
  const next: Formation = {};
  for (const [id, pos] of Object.entries(f)) {
    next[id] = { x: 1 - pos.x, y: pos.y };
  }
  return next;
}

// Recompute derived counters from the log (used after edit/delete).
function recomputeCounters(log: LogEntry[]) {
  let score1 = 0, score2 = 0, timeouts1 = 0, timeouts2 = 0, suspensions1 = 0, suspensions2 = 0;
  for (const e of log) {
    if (e.action === "GOAL" || e.action === "7M") {
      if (e.team === 1) score1++;
      else if (e.team === 2) score2++;
    } else if (e.action === "TIMEOUT") {
      if (e.team === 1) timeouts1++;
      else if (e.team === 2) timeouts2++;
    } else if (e.action === "2-MIN" || e.action === "RED") {
      if (e.team === 1) suspensions1++;
      else if (e.team === 2) suspensions2++;
    }
  }
  return { score1, score2, timeouts1, timeouts2, suspensions1, suspensions2 };
}

// Demo data intentionally removed.


export const useGameStore = create<State>()(
  persist(
    (set, get) => ({
      info: blankInfo(),
      team1: blankTeam("", "#d62828"),
      team2: blankTeam("", "#1565c0"),
      homeIsTeam1: true,
      team1Direction: "left",
      halfDirections: { 1: "left" },
      setupComplete: false,
      score1: 0,
      score2: 0,
      possession: null,
      half: 1,
      clockSec: 0,
      clockCountUp: true,
      clockRunning: false,
      clockOriginMs: null,
      clockOriginSec: 0,
      timeouts1: 0,
      timeouts2: 0,
      suspensions1: 0,
      suspensions2: 0,
      activeSuspensions: [],
      log: [],
      persistRev: 0,
      formation1: {},
      formation2: {},
      lineupTemplates: { left: {}, right: {} },
      shootoutRounds: [],

      setInfo: (p) => set((s) => ({ info: { ...s.info, ...p } })),
      setOfficial: (i, p) =>
        set((s) => ({
          info: {
            ...s.info,
            officials: s.info.officials.map((o, idx) => (idx === i ? { ...o, ...p } : o)),
          },
        })),
      setTeam: (n, p) =>
        set((s) => (n === 1 ? { team1: { ...s.team1, ...p } } : { team2: { ...s.team2, ...p } })),
      setCoach: (n, i, p) =>
        set((s) => {
          const t = n === 1 ? s.team1 : s.team2;
          const coaches = t.coaches.map((c, idx) => (idx === i ? { ...c, ...p } : c));
          return n === 1 ? { team1: { ...t, coaches } } : { team2: { ...t, coaches } };
        }),
      addPlayer: (n) =>
        set((s) => {
          const t = n === 1 ? s.team1 : s.team2;
          const players = [
            ...t.players,
            { id: makeId("player"), no: "", name: "", surname: "", height: "", position: "", addInfo: "", captain: false, playing: false },
          ];
          return n === 1 ? { team1: { ...t, players } } : { team2: { ...t, players } };
        }),
      setPlayer: (n, id, p) =>
        set((s) => {
          const t = n === 1 ? s.team1 : s.team2;
          let players = t.players.map((pl) => {
            if (pl.id !== id) return pl;
            const merged = { ...pl, ...p };
            // Toggling squad off also removes them from the court.
            if (p.playing === false) merged.onCourt = false;
            return merged;
          });
          // single captain
          if (p.captain) players = players.map((pl) => (pl.id === id ? pl : { ...pl, captain: false }));
          return n === 1 ? { team1: { ...t, players } } : { team2: { ...t, players } };
        }),
      removePlayer: (n, id) =>
        set((s) => {
          const t = n === 1 ? s.team1 : s.team2;
          const players = t.players.filter((pl) => pl.id !== id);
          return n === 1 ? { team1: { ...t, players } } : { team2: { ...t, players } };
        }),
      switchSides: () =>
        set((s) => {
          const team1Direction: TeamDirection = s.team1Direction === "left" ? "right" : "left";
          return {
            team1Direction,
            halfDirections: { ...(s.halfDirections ?? { 1: s.team1Direction }), [s.half]: team1Direction },
          };
        }),
      switchHomeAway: () => set((s) => ({ homeIsTeam1: !s.homeIsTeam1 })),
      swapTeams: () =>
        set((s) => ({
          team1: s.team2,
          team2: s.team1,
          score1: s.score2,
          score2: s.score1,
          timeouts1: s.timeouts2,
          timeouts2: s.timeouts1,
          suspensions1: s.suspensions2,
          suspensions2: s.suspensions1,
          // Left panel always defends left / attacks right after an in-game switch.
          formation1: mirrorFormation(s.formation2),
          formation2: mirrorFormation(s.formation1),
          team1Direction: "left" as TeamDirection,
          halfDirections: { ...(s.halfDirections ?? { 1: "left" }), [s.half]: "left" },
          possession: s.possession === 1 ? 2 : s.possession === 2 ? 1 : null,
          activeSuspensions: s.activeSuspensions.map((su) => ({ ...su, team: su.team === 1 ? 2 : 1 })),
          log: s.log.map((e) => e.team === 1 ? { ...e, team: 2 } : e.team === 2 ? { ...e, team: 1 } : e),
          shootoutRounds: s.shootoutRounds.map((r) => ({ t1: r.t2, t2: r.t1, t1Player: r.t2Player, t2Player: r.t1Player })),
        })),
      setSetupComplete: (b) =>
        set((s) => {
          if (b && !s.setupComplete) {
            return bump(s, { setupComplete: true, clockSec: 0, clockCountUp: true });
          }
          return bump(s, { setupComplete: b });
        }),

      startClock: () =>
        set((s) => ({
          clockRunning: true,
          clockOriginMs: Date.now(),
          clockOriginSec: s.clockSec,
        })),
      stopClock: () =>
        set((s) => applyClockTo(s, wallElapsedSec(s), false)),
      tick: () =>
        set((s) => {
          if (!s.clockRunning) return {};
          const originMs = s.clockOriginMs ?? Date.now();
          const originSec = s.clockOriginMs == null ? s.clockSec : s.clockOriginSec;
          const live = { ...s, clockOriginMs: originMs, clockOriginSec: originSec, clockRunning: true };
          const patch = applyClockTo(live, wallElapsedSec(live), true);
          if (s.clockOriginMs == null) {
            patch.clockOriginMs = originMs;
            patch.clockOriginSec = originSec;
          }
          return patch;
        }),
      setClockSec: (sec) =>
        set((s) => {
          const clamped = Math.max(0, Math.min(storePeriodLen(s), sec));
          if (s.clockRunning) {
            return { clockSec: clamped, clockOriginMs: Date.now(), clockOriginSec: clamped };
          }
          return { clockSec: clamped };
        }),
      setHalf: (h) =>
        set((s) => ({
          half: h,
          clockSec: 0,
          clockRunning: false,
          clockOriginMs: null,
          clockOriginSec: 0,
          halfDirections: {
            ...(s.halfDirections ?? { 1: s.team1Direction }),
            [h]: s.halfDirections?.[h] ?? s.team1Direction,
          },
        })),
      setPossession: (t) => set({ possession: t }),
      logAction: (e) =>
        set((s) => {
          // Handball timeout rule: 2 team timeouts per half.
          // After minute 25 of the half (<= 5 min remaining), only 1 timeout is allowed in that half.
          if (e.action === "TIMEOUT" && (e.team === 1 || e.team === 2)) {
            const elapsedSec = s.clockSec;
            const maxThisHalf = elapsedSec >= 25 * 60 ? 1 : 2;
            const usedThisHalf = s.log.filter(
              (l) => l.action === "TIMEOUT" && l.team === e.team && l.half === s.half,
            ).length;
            if (usedThisHalf >= maxThisHalf) {
              // Denied — play a short deny tone and no state change.
              try {
                // dynamic import to avoid ssr issues
                import("./audio").then(({ sfx }) => sfx.deny?.());
              } catch {}
              return {};
            }
          }

          const entry: LogEntry = {
            ...e,
             id: makeId("log"),
            ts: Date.now(),
            half: s.half,
            clock: fmtClock(s.clockSec),
            clockElapsed: true,
          };
          let score1 = s.score1, score2 = s.score2;
          let possession = s.possession;
          if (e.action === "GOAL" || e.action === "7M") {
            if (e.team === 1) { score1++; possession = 2; } // throw-off to opponent
            if (e.team === 2) { score2++; possession = 1; }
          } else if (e.action === "TURNOVER" || e.action === "STEAL") {
            if (e.team === 1) possession = e.action === "STEAL" ? 1 : 2;
            if (e.team === 2) possession = e.action === "STEAL" ? 2 : 1;
          }
          let timeouts1 = s.timeouts1, timeouts2 = s.timeouts2;
          if (e.action === "TIMEOUT") {
            if (e.team === 1) timeouts1++;
            if (e.team === 2) timeouts2++;
          }
          let suspensions1 = s.suspensions1, suspensions2 = s.suspensions2;
          let activeSuspensions = s.activeSuspensions;
          let team1 = s.team1, team2 = s.team2;
          if (e.action === "2-MIN" || e.action === "RED") {
            if (e.team === 1) suspensions1++;
            if (e.team === 2) suspensions2++;
            if (e.action === "2-MIN" && e.team && e.playerNo) {
              activeSuspensions = [
                ...activeSuspensions,
                {
                  id: entry.id,
                  team: e.team,
                  playerNo: e.playerNo,
                  startedAtClockSec: s.clockSec,
                  startedHalf: s.half,
                  remainingSec: 120,
                },
              ];
              // Auto-bench the suspended player
              const benchTeam = (t: TeamSetup): TeamSetup => ({
                ...t,
                players: t.players.map((p) => (p.no === e.playerNo ? { ...p, onCourt: false } : p)),
              });
              if (e.team === 1) team1 = benchTeam(team1);
              else if (e.team === 2) team2 = benchTeam(team2);
            }
          }
          // RED or BLUE card → remove the player from the roster entirely (excluded) + start 2-min suspension timer for the team.
          if ((e.action === "RED" || e.action === "BLUE") && e.team && e.playerNo) {
            const excludeTeam = (t: TeamSetup): TeamSetup => ({
              ...t,
              players: t.players.map((p) => (p.no === e.playerNo ? { ...p, onCourt: false, excluded: true } : p)),
            });
            if (e.team === 1) team1 = excludeTeam(team1);
            else if (e.team === 2) team2 = excludeTeam(team2);
            activeSuspensions = [
              ...activeSuspensions,
              {
                id: entry.id,
                team: e.team,
                playerNo: e.playerNo,
                startedAtClockSec: s.clockSec,
                startedHalf: s.half,
                remainingSec: 120,
              },
            ];
          }

          return bump(s, { log: [entry, ...s.log], score1, score2, timeouts1, timeouts2, suspensions1, suspensions2, possession, activeSuspensions, team1, team2 });
        }),
      updateLogEntry: (id, patch) =>
        set((s) => {
          const log = s.log.map((e) => (e.id === id ? { ...e, ...patch } : e));
          return bump(s, { log, ...recomputeCounters(log) });
        }),
      deleteLogEntry: (id) =>
        set((s) => {
          const entry = s.log.find((e) => e.id === id);
          const log = s.log.filter((e) => e.id !== id);
          const activeSuspensions = s.activeSuspensions.filter((su) => su.id !== id);
          let team1 = s.team1, team2 = s.team2;
          if (entry && entry.action === "2-MIN" && entry.playerNo) {
            const restore = (t: TeamSetup): TeamSetup => ({ ...t, players: t.players.map((p) => (p.no === entry.playerNo ? { ...p, onCourt: true } : p)) });
            if (entry.team === 1) team1 = restore(team1);
            else if (entry.team === 2) team2 = restore(team2);
          }
          if (entry && (entry.action === "RED" || entry.action === "BLUE") && entry.playerNo) {
            const clearExc = (t: TeamSetup): TeamSetup => ({ ...t, players: t.players.map((p) => (p.no === entry.playerNo ? { ...p, excluded: false } : p)) });
            if (entry.team === 1) team1 = clearExc(team1);
            else if (entry.team === 2) team2 = clearExc(team2);
          }
          return bump(s, { log, activeSuspensions, team1, team2, ...recomputeCounters(log) });

        }),
      undoLast: () =>
        set((s) => {
          const [last, ...rest] = s.log;
          if (!last) return {};
          let score1 = s.score1, score2 = s.score2;
          if (last.action === "GOAL" || last.action === "7M") {
            if (last.team === 1) score1--;
            if (last.team === 2) score2--;
          }
          let timeouts1 = s.timeouts1, timeouts2 = s.timeouts2;
          if (last.action === "TIMEOUT") {
            if (last.team === 1) timeouts1--;
            if (last.team === 2) timeouts2--;
          }
          let suspensions1 = s.suspensions1, suspensions2 = s.suspensions2;
          let activeSuspensions = s.activeSuspensions;
          let team1 = s.team1, team2 = s.team2;
          if (last.action === "2-MIN" || last.action === "RED") {
            if (last.team === 1) suspensions1--;
            if (last.team === 2) suspensions2--;
            if (last.action === "2-MIN") {
              activeSuspensions = activeSuspensions.filter((su) => su.id !== last.id);
              if (last.playerNo) {
                const restore = (t: TeamSetup): TeamSetup => ({ ...t, players: t.players.map((p) => (p.no === last.playerNo ? { ...p, onCourt: true } : p)) });
                if (last.team === 1) team1 = restore(team1);
                else if (last.team === 2) team2 = restore(team2);
              }
            }
          }
          if ((last.action === "RED" || last.action === "BLUE") && last.playerNo) {
            const clearExc = (t: TeamSetup): TeamSetup => ({ ...t, players: t.players.map((p) => (p.no === last.playerNo ? { ...p, excluded: false } : p)) });
            if (last.team === 1) team1 = clearExc(team1);
            else if (last.team === 2) team2 = clearExc(team2);
          }
          return bump(s, { log: rest, score1, score2, timeouts1, timeouts2, suspensions1, suspensions2, activeSuspensions, team1, team2 });

        }),
      reset: () =>
        set((s) =>
          bump(s, {
          info: blankInfo(),
          team1: blankTeam("", "#d62828"),
          team2: blankTeam("", "#1565c0"),
          homeIsTeam1: true,
          team1Direction: "left",
          halfDirections: { 1: "left" },
          setupComplete: false,
          score1: 0,
          score2: 0,
          possession: null,
          half: 1,
          clockSec: 0,
          clockCountUp: true,
          clockRunning: false,
          clockOriginMs: null,
          clockOriginSec: 0,
          timeouts1: 0,
          timeouts2: 0,
          suspensions1: 0,
          suspensions2: 0,
          activeSuspensions: [],
          log: [],
          formation1: {},
          formation2: {},
          shootoutRounds: [],
          }),
        ),
      
      setFormationPos: (n, playerId, pos) =>
        set((s) => {
          const key = n === 1 ? "formation1" : "formation2";
          const next = { ...(s as any)[key] } as Formation;
          if (pos === null) delete next[playerId];
          else next[playerId] = { x: Math.max(0, Math.min(1, pos.x)), y: Math.max(0, Math.min(1, pos.y)) };
          return { [key]: next } as any;
        }),
      clearFormation: (n) => set(n === 1 ? { formation1: {} } : { formation2: {} }),
      autoArrangeFormation: (n) =>
        set((s) => {
          const team = n === 1 ? s.team1 : s.team2;
          const dir = n === 1 ? s.team1Direction : (s.team1Direction === "left" ? "right" : "left");
          // own side (where GK stands): team on the left keeps its goal left, team on the right keeps its goal right.
          const ownSide = dir;
          // Default defensive 6-0 shape (used when no saved template exists for this side).
          const defaults: Record<string, { x: number; y: number }> = ownSide === "right"
            ? {
                GK: { x: 0.97, y: 0.50 },
                RW: { x: 0.92, y: 0.22 },
                RB: { x: 0.85, y: 0.32 },
                CB: { x: 0.78, y: 0.42 },
                P:  { x: 0.73, y: 0.50 },
                LB: { x: 0.85, y: 0.68 },
                LW: { x: 0.92, y: 0.78 },
              }
            : {
                GK: { x: 0.03, y: 0.50 },
                LW: { x: 0.08, y: 0.78 },
                LB: { x: 0.15, y: 0.68 },
                CB: { x: 0.22, y: 0.58 },
                P:  { x: 0.27, y: 0.50 },
                RB: { x: 0.15, y: 0.32 },
                RW: { x: 0.08, y: 0.22 },
              };
          // Prefer a user-saved template for this side when available.
          const saved = s.lineupTemplates?.[ownSide] || {};
          const slots: Record<string, { x: number; y: number }> = Object.keys(saved).length > 0
            ? { ...defaults, ...saved }
            : defaults;
          const order = ownSide === "right"
            ? (["GK", "RW", "RB", "CB", "LB", "LW", "P"] as const)
            : (["GK", "LW", "LB", "CB", "RB", "RW", "P"] as const);
          const formation: Formation = {};
          const onCourt = team.players.filter((p) => p.onCourt);
          const squad = team.players.filter((p) => p.playing && !p.excluded);
          const starters = (onCourt.length > 0 ? onCourt : squad).slice(0, 7);
          const used = new Set<string>();
          // First pass: honor explicit position when set
          starters.forEach((p) => {
            const slot = slots[p.position as keyof typeof slots];
            if (slot && !used.has(p.position)) {
              formation[p.id] = slot;
              used.add(p.position);
            }
          });
          // Second pass: fill remaining players into remaining slots
          starters.forEach((p) => {
            if (formation[p.id]) return;
            const nextKey = order.find((k) => !used.has(k));
            if (nextKey) {
              formation[p.id] = slots[nextKey];
              used.add(nextKey);
            }
          });
          // Mark the chosen 7 as onCourt (idempotent when already set).
          const starterIds = new Set(starters.map((p) => p.id));
          const players = team.players.map((p) => ({ ...p, onCourt: starterIds.has(p.id) }));
          const teamPatch = { ...team, players };
          if (n === 1) return { formation1: formation, team1: teamPatch };
          return { formation2: formation, team2: teamPatch };
        }),
      saveLineupTemplate: (n) =>
        set((s) => {
          const team = n === 1 ? s.team1 : s.team2;
          const formation = n === 1 ? s.formation1 : s.formation2;
          const dir = n === 1 ? s.team1Direction : (s.team1Direction === "left" ? "right" : "left");
          const ownSide: "left" | "right" = dir;
          const template: Record<string, { x: number; y: number }> = {};
          const order = ownSide === "right"
            ? ["GK", "RW", "RB", "CB", "LB", "LW", "P"]
            : ["GK", "LW", "LB", "CB", "RB", "RW", "P"];
          const takenRoles = new Set<string>();
          const unplaced: { id: string; pos: { x: number; y: number } }[] = [];
          // First pass: use player's assigned position when set and unique.
          Object.entries(formation).forEach(([pid, pos]) => {
            const player = team.players.find((p) => p.id === pid);
            const role = player?.position;
            if (role && !takenRoles.has(role) && order.includes(role)) {
              template[role] = { x: pos.x, y: pos.y };
              takenRoles.add(role);
            } else {
              unplaced.push({ id: pid, pos });
            }
          });
          // Second pass: assign remaining tokens to remaining default roles.
          unplaced.forEach((u) => {
            const role = order.find((r) => !takenRoles.has(r));
            if (role) {
              template[role] = { x: u.pos.x, y: u.pos.y };
              takenRoles.add(role);
            }
          });
          return { lineupTemplates: { ...s.lineupTemplates, [ownSide]: template } };
        }),
      clearLineupTemplate: (side) =>
        set((s) => {
          if (!side) return { lineupTemplates: { left: {}, right: {} } };
          return { lineupTemplates: { ...s.lineupTemplates, [side]: {} } };
        }),
      setShootoutRound: (i, team, v) =>
        set((s) => ({
          shootoutRounds: s.shootoutRounds.map((r, idx) => idx === i ? { ...r, [team]: r[team] === v ? null : v } : r),
        })),
      setShootoutPlayer: (i, team, playerNo) =>
        set((s) => ({
          shootoutRounds: s.shootoutRounds.map((r, idx) => idx === i ? { ...r, [team === "t1" ? "t1Player" : "t2Player"]: playerNo } : r),
        })),
      addShootoutRound: () =>
        set((s) => ({ shootoutRounds: [...s.shootoutRounds, { t1: null, t2: null }] })),
      removeShootoutRound: (i) =>
        set((s) => ({ shootoutRounds: s.shootoutRounds.filter((_, idx) => idx !== i) })),
      clearShootout: () => set({ shootoutRounds: [] }),
    }),
    {
      name: "b-livestats",
      storage: createJSONStorage(() => createLiveStateStorage()),
      merge: (persisted, current) => {
        const p = migrateCountdownToElapsed((persisted ?? {}) as Partial<State>);
        const pRev = p.persistRev ?? 0;
        const cRev = current.persistRev ?? 0;
        const team1Direction = p.team1Direction ?? current.team1Direction;
        const half = p.half ?? current.half;
        const next = {
          ...current,
          ...p,
          clockCountUp: true,
          clockRunning: false,
          clockOriginMs: null,
          clockOriginSec: typeof p.clockSec === "number" ? p.clockSec : current.clockSec,
          persistRev: Math.max(pRev, cRev),
          halfDirections: p.halfDirections ?? { 1: team1Direction, [half]: team1Direction },
        };
        // A newer in-memory edit must not be replaced by a stale disk snapshot.
        if (cRev > pRev) {
          next.log = current.log;
          next.score1 = current.score1;
          next.score2 = current.score2;
          next.timeouts1 = current.timeouts1;
          next.timeouts2 = current.timeouts2;
          next.persistRev = cRev;
        }
        return next;
      },
    },
  ),
);

export const formatClock = fmtClock;
