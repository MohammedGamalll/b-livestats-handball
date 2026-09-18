import type { LogEntry, TeamSetup } from "@/lib/gameStore";
import { applyTeamSub, eventElapsedSec } from "@/lib/gkAttribution";

// Robust goalkeeper predicate — mirrors the one in stats.tsx.
export function buildIsGK(team: TeamSetup): (no: string) => boolean {
  const norm = (s?: string) => String(s ?? "").trim().toUpperCase();
  const anyPositionSet = team.players.some((p) => norm(p.position) !== "");
  const gkNos = new Set(
    team.players
      .filter((p) => {
        const r = norm(p.position);
        return r === "GK" || r === "GOALKEEPER" || r.startsWith("GK");
      })
      .map((p) => p.no),
  );
  return (no: string): boolean => {
    if (gkNos.has(no)) return true;
    if (!anyPositionSet && (no === "1" || no === "12" || no === "16")) return true;
    return false;
  };
}

export interface DetectedStrength {
  attack: number;       // field players on the acting team
  defend: number;       // field players on the opposing team
  emptyDefend: boolean; // defending team has no GK on court
  emptyAttack: boolean; // acting team has no GK on court (7v6 attack)
}

// Detects the current strength situation from the LIVE team state (Player.onCourt/excluded).
// Used at the moment a scorable action is logged.
export function detectCurrentStrength(
  team1: TeamSetup,
  team2: TeamSetup,
  actingTeam: 1 | 2,
): DetectedStrength {
  const isGK1 = buildIsGK(team1);
  const isGK2 = buildIsGK(team2);

  const countOn = (t: TeamSetup) =>
    t.players.filter((p) => p.onCourt === true && !p.excluded).length;
  const hasGKOn = (t: TeamSetup, pred: (no: string) => boolean) =>
    t.players.some((p) => p.onCourt === true && !p.excluded && pred(p.no));

  const on1 = countOn(team1);
  const on2 = countOn(team2);
  const gk1 = hasGKOn(team1, isGK1);
  const gk2 = hasGKOn(team2, isGK2);

  const field1 = gk1 ? Math.max(0, on1 - 1) : on1;
  const field2 = gk2 ? Math.max(0, on2 - 1) : on2;

  const attackTeam = actingTeam;
  const opp: 1 | 2 = actingTeam === 1 ? 2 : 1;
  return {
    attack: attackTeam === 1 ? field1 : field2,
    defend: opp === 1 ? field1 : field2,
    emptyDefend: opp === 1 ? !gk1 : !gk2,
    emptyAttack: attackTeam === 1 ? !gk1 : !gk2,
  };
}

export function strengthLabel(attack: number, defend: number, emptyAttack: boolean): string {
  let base: string;
  if (attack === 7 && defend === 6) base = "7v6";
  else base = `${attack}v${defend}`;
  return emptyAttack ? `${base} · Empty Goal` : base;
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline reconstruction — walks the chronological log and produces, per
// scorable entry, the (attack, defend, emptyAttack) situation that held at
// the moment the action was logged. Shared by stats.tsx and actions.tsx.
// ─────────────────────────────────────────────────────────────────────────────

export interface SituationRow {
  attackField: number;
  defendField: number;
  emptyAttack: boolean;
  emptyDefend: boolean;
}

const ACTION_GROUP_KEYS: Partial<Record<LogEntry["action"], true>> = {
  "GOAL": true, "7M": true,
  "SHOT MISSED": true, "SHOT SAVED": true,
  "FOUL": true, "YELLOW": true, "2-MIN": true, "BLUE": true,
  "TURNOVER": true,
};

export function buildSituationTimeline(
  team1: TeamSetup,
  team2: TeamSetup,
  log: LogEntry[],
  opts: { halfLength: number; otLength: number; halves: number },
): Map<string, SituationRow> {
  const { halfLength, otLength, halves } = opts;
  const withTime = log.map((e) => ({ e, t: eventElapsedSec(e, halfLength, otLength, halves) }));
  const chronological = [...withTime].sort((a, b) => a.t - b.t);

  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
  const isGK1 = buildIsGK(team1);
  const isGK2 = buildIsGK(team2);

  const kickoffOnCourt = (team: TeamSetup, isGK: (no: string) => boolean): Set<string> => {
    const explicit = team.players.filter((p) => p.onCourt === true);
    const pool = explicit.length > 0 ? explicit : team.players.filter((p) => p.playing !== false);
    const gk = pool
      .filter((p) => isGK(p.no))
      .sort((a, b) => (Number(a.no) || 0) - (Number(b.no) || 0))[0];
    const picked: string[] = [];
    if (gk) picked.push(gk.no);
    for (const p of pool) {
      if (picked.length >= 7) break;
      if (p.no && !picked.includes(p.no)) picked.push(p.no);
    }
    return new Set(picked);
  };

  type TeamState = {
    onCourt: Set<string>;
    suspendedCount: number;
    permanentlyOut: Set<string>;
    twoMinHistory: Map<string, number>;
    restorations: { endT: number; playerNo: string; readd: boolean }[];
  };
  const state: Record<1 | 2, TeamState> = {
    1: { onCourt: kickoffOnCourt(team1, isGK1), suspendedCount: 0, permanentlyOut: new Set(), twoMinHistory: new Map(), restorations: [] },
    2: { onCourt: kickoffOnCourt(team2, isGK2), suspendedCount: 0, permanentlyOut: new Set(), twoMinHistory: new Map(), restorations: [] },
  };

  const hasGKNow = (teamN: 1 | 2): boolean => {
    const isGK = teamN === 1 ? isGK1 : isGK2;
    for (const no of state[teamN].onCourt) if (isGK(no)) return true;
    return false;
  };
  const totalOnCourtNow = (teamN: 1 | 2) => clamp(7 - state[teamN].suspendedCount, 3, 7);
  const fieldPlayersNow = (teamN: 1 | 2) => {
    const total = totalOnCourtNow(teamN);
    return hasGKNow(teamN) ? total - 1 : total;
  };

  const sweep = (t: number) => {
    (["1", "2"] as const).forEach((k) => {
      const teamN = Number(k) as 1 | 2;
      const st = state[teamN];
      const stillPending: typeof st.restorations = [];
      for (const r of st.restorations) {
        if (r.endT <= t) {
          st.suspendedCount = Math.max(0, st.suspendedCount - 1);
          if (r.readd && !st.permanentlyOut.has(r.playerNo) && st.onCourt.size < 7) {
            st.onCourt.add(r.playerNo);
          }
        } else {
          stillPending.push(r);
        }
      }
      st.restorations = stillPending;
    });
  };

  const situationByEntryId = new Map<string, SituationRow>();

  chronological.forEach(({ e, t }) => {
    sweep(t);
    if (e.team && ACTION_GROUP_KEYS[e.action]) {
      const acting: 1 | 2 = e.team as 1 | 2;
      const opp: 1 | 2 = acting === 1 ? 2 : 1;
      situationByEntryId.set(e.id, {
        attackField: fieldPlayersNow(acting),
        defendField: fieldPlayersNow(opp),
        emptyAttack: !hasGKNow(acting),
        emptyDefend: !hasGKNow(opp),
      });
    }

    if (!e.team) return;
    const teamN = e.team as 1 | 2;
    const st = state[teamN];
    const p = e.playerNo;

    if (e.action === "SUBSTITUTION") {
      applyTeamSub(st.onCourt, e.playerNo, st.permanentlyOut);
    } else if (e.action === "2-MIN" && p) {
      st.onCourt.delete(p);
      st.suspendedCount += 1;
      const prior = st.twoMinHistory.get(p) || 0;
      const next = prior + 1;
      st.twoMinHistory.set(p, next);
      if (next >= 3) {
        st.permanentlyOut.add(p);
        st.restorations.push({ endT: t + 120, playerNo: p, readd: false });
      } else {
        st.restorations.push({ endT: t + 120, playerNo: p, readd: true });
      }
    } else if ((e.action === "RED" || e.action === "BLUE") && p) {
      st.onCourt.delete(p);
      st.permanentlyOut.add(p);
      st.suspendedCount += 1;
      st.restorations.push({ endT: t + 120, playerNo: p, readd: false });
    }
  });

  return situationByEntryId;
}
