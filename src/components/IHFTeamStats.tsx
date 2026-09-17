import type { LogEntry, TeamSetup } from "@/lib/gameStore";
import { buildBoxScore } from "@/lib/exportCsv";
import { classifyZone, type Zone } from "@/components/TeamStatsTable";
import { isFastBreak } from "@/lib/court";
import { attributeGoalkeepers } from "@/lib/gkAttribution";

type Bucket = { g: number; a: number };
const emptyB = (): Bucket => ({ g: 0, a: 0 });
const fmtMA = (b: Bucket) => (b.a ? `${b.g}/${b.a}` : "");
const fmtPct = (g: number, a: number) => (a ? `${Math.round((g / a) * 100)}` : "");

type ShotCat = "9m" | "6m" | "Wing" | "7m" | "FB" | "Brk" | "LD";
const SHOT_CATS: ShotCat[] = ["9m", "6m", "Wing", "7m", "FB", "Brk", "LD"];

function catsFor(e: LogEntry): ShotCat[] {
  const isShot =
    e.action === "GOAL" ||
    e.action === "SHOT MISSED" ||
    e.action === "SHOT SAVED" ||
    e.action === "7M";
  if (!isShot) return [];
  const z = classifyZone(e);
  const cats: ShotCat[] = [];
  if (z === "6m" || z === "9m" || z === "Wing" || z === "7m") cats.push(z as ShotCat);
  // FB is a parallel counter — a fast-break shot ALSO counts as FB on top of its geographic zone.
  if (isFastBreak(e)) cats.push("FB");
  if (e.subtype === "BREAK THROUGH") cats.push("Brk");
  if (e.subtype === "EMPTY GOAL" || e.subtype === "LONG DISTANCE") cats.push("LD");
  return cats;
}

function isMade(e: LogEntry) {
  return e.action === "GOAL" || e.action === "7M";
}

function eventTotalSec(e: LogEntry, halfLength: number, otLength: number, halves: number) {
  const [mm, ss] = (e.clock || "00:00").split(":").map((v) => parseInt(v, 10) || 0);
  const clockSec = mm * 60 + ss;
  let elapsedBefore = 0;
  for (let h = 1; h < e.half; h++) elapsedBefore += (h > halves ? otLength : halfLength) * 60;
  const thisLen = (e.half > halves ? otLength : halfLength) * 60;
  return elapsedBefore + (thisLen - clockSec);
}

function buildStrengthLookup(log: LogEntry[], halfLength: number, otLength: number, halves: number) {
  const susp = log
    .filter((e) => e.team && (e.action === "2-MIN" || e.action === "RED"))
    .map((e) => ({
      team: e.team as 1 | 2,
      start: eventTotalSec(e, halfLength, otLength, halves),
      end: eventTotalSec(e, halfLength, otLength, halves) + 120,
    }));
  return (e: LogEntry, teamN: 1 | 2) => {
    const t = eventTotalSec(e, halfLength, otLength, halves);
    const ownOut = susp.filter((s) => s.team === teamN && s.start <= t && s.end > t).length;
    const oppOut = susp.filter((s) => s.team !== teamN && s.start <= t && s.end > t).length;
    return { own: Math.max(3, 6 - ownOut), opp: Math.max(3, 6 - oppOut) };
  };
}

export function IHFTeamStats({
  team,
  otherTeam,
  log,
  teamN,
  halfLength,
  otLength,
  halves,
}: {
  team: TeamSetup;
  otherTeam: TeamSetup;
  log: LogEntry[];
  teamN: 1 | 2;
  halfLength: number;
  otLength: number;
  halves: number;
}) {
  const oppN = (teamN === 1 ? 2 : 1) as 1 | 2;
  const stats = buildBoxScore(log, team, teamN);
  const strengthAt = buildStrengthLookup(log, halfLength, otLength, halves);

  // -------- per-player shots per category
  const perPlayerCat = new Map<string, Record<ShotCat, Bucket>>();
  const ensurePP = (no: string) => {
    let m = perPlayerCat.get(no);
    if (!m) {
      m = { "9m": emptyB(), "6m": emptyB(), Wing: emptyB(), "7m": emptyB(), FB: emptyB(), Brk: emptyB(), LD: emptyB() };
      perPlayerCat.set(no, m);
    }
    return m;
  };
  // per-player attack: earned 7m, earned 2m, tech faults
  const perPlayerAtk = new Map<string, { e7: number; e2: number; tf: number; pc: number }>();
  const ensureAtk = (no: string) => {
    let m = perPlayerAtk.get(no);
    if (!m) { m = { e7: 0, e2: 0, tf: 0, pc: 0 }; perPlayerAtk.set(no, m); }
    return m;
  };
  // per-player defense: committed 7m
  const perPlayerDef = new Map<string, { c7: number }>();
  const ensureDef = (no: string) => {
    let m = perPlayerDef.get(no);
    if (!m) { m = { c7: 0 }; perPlayerDef.set(no, m); }
    return m;
  };

  log.forEach((e) => {
    if (e.team === teamN && e.playerNo) {
      const cats = catsFor(e);
      if (cats.length) {
        const rec = ensurePP(e.playerNo);
        cats.forEach((c) => { rec[c].a++; if (isMade(e)) rec[c].g++; });
      }
      if (e.action === "TURNOVER") ensureAtk(e.playerNo).tf++;
      if (e.action === "FOUL" && e.subtype === "7M") ensureDef(e.playerNo).c7++;
    }
    // earned 7m: opponent FOUL with subtype 7M, involverNo = our player
    if (e.team === oppN && e.involverNo && e.action === "FOUL" && e.subtype === "7M") {
      ensureAtk(e.involverNo).e7++;
    }
    // earned 2m: opponent 2-MIN with involverNo = our player
    if (e.team === oppN && e.involverNo && e.action === "2-MIN") {
      ensureAtk(e.involverNo).e2++;
    }
  });

  // -------- team totals per cat
  const teamCat: Record<ShotCat, Bucket> = {
    "9m": emptyB(), "6m": emptyB(), Wing: emptyB(), "7m": emptyB(), FB: emptyB(), Brk: emptyB(), LD: emptyB(),
  };
  perPlayerCat.forEach((rec) => { SHOT_CATS.forEach((c) => { teamCat[c].g += rec[c].g; teamCat[c].a += rec[c].a; }); });

  const totalG = stats.reduce((a, s) => a + s.goals, 0);
  const totalA = stats.reduce((a, s) => a + s.shots, 0);
  const totAs = stats.reduce((a, s) => a + s.assists, 0);
  const totSt = stats.reduce((a, s) => a + s.steals, 0);
  const totBl = stats.reduce((a, s) => a + s.blocks, 0);
  const totYC = stats.reduce((a, s) => a + s.yellow, 0);
  const totRC = stats.reduce((a, s) => a + s.red, 0);
  const totBC = stats.reduce((a, s) => a + s.blue, 0);
  const tot2m = stats.reduce((a, s) => a + s.twoMin, 0);
  const totTF = Array.from(perPlayerAtk.values()).reduce((a, v) => a + v.tf, 0);
  const totE7 = Array.from(perPlayerAtk.values()).reduce((a, v) => a + v.e7, 0);
  const totE2 = Array.from(perPlayerAtk.values()).reduce((a, v) => a + v.e2, 0);
  const totC7 = Array.from(perPlayerDef.values()).reduce((a, v) => a + v.c7, 0);

  // -------- goalkeepers (attributed by who was in net)
  const gks = team.players.filter((p) => p.position === "GK");
  const gkPer = new Map<string, Record<ShotCat, Bucket>>();
  gks.forEach((g) => {
    gkPer.set(g.no, { "9m": emptyB(), "6m": emptyB(), Wing: emptyB(), "7m": emptyB(), FB: emptyB(), Brk: emptyB(), LD: emptyB() });
  });
  const gkTot: Record<ShotCat, Bucket> = { "9m": emptyB(), "6m": emptyB(), Wing: emptyB(), "7m": emptyB(), FB: emptyB(), Brk: emptyB(), LD: emptyB() };
  const byId = new Map(log.map((e) => [e.id, e]));
  const gkReport = attributeGoalkeepers(team, log, teamN, { halves, halfLength, otLength });
  for (const k of gkReport.keepers) {
    if (!gkPer.has(k.no)) {
      gkPer.set(k.no, { "9m": emptyB(), "6m": emptyB(), Wing: emptyB(), "7m": emptyB(), FB: emptyB(), Brk: emptyB(), LD: emptyB() });
    }
    const rec = gkPer.get(k.no)!;
    for (const mark of k.shotEvents) {
      if (mark.kind === "post") continue;
      const e = byId.get(mark.eventId);
      if (!e) continue;
      const cats = catsFor(e);
      const isSave = mark.kind === "save";
      cats.forEach((c) => {
        gkTot[c].a++;
        if (isSave) gkTot[c].g++;
        rec[c].a++;
        if (isSave) rec[c].g++;
      });
    }
  }
  const gkTotSaves = SHOT_CATS.reduce((a, c) => a + gkTot[c].g, 0);
  const gkTotFaced = SHOT_CATS.reduce((a, c) => a + gkTot[c].a, 0);

  // -------- Attack by type of defense: On def 6-0 vs Fastbreak
  const attackByDef = { normal: emptyB(), fb: emptyB() };
  const attackByDefZones: Record<"normal" | "fb", { "9m": Bucket; "6m": Bucket; Wing: Bucket; tf: number; e7: number; e2: number }> = {
    normal: { "9m": emptyB(), "6m": emptyB(), Wing: emptyB(), tf: 0, e7: 0, e2: 0 },
    fb: { "9m": emptyB(), "6m": emptyB(), Wing: emptyB(), tf: 0, e7: 0, e2: 0 },
  };
  log.forEach((e) => {
    if (e.team !== teamN) return;
    const bucket = e.fastBreak ? "fb" : "normal";
    if (e.action === "GOAL" || e.action === "SHOT MISSED" || e.action === "SHOT SAVED" || e.action === "7M") {
      attackByDef[bucket].a++;
      if (isMade(e)) attackByDef[bucket].g++;
      const z = classifyZone(e);
      if (z === "9m" || z === "6m" || z === "Wing") {
        attackByDefZones[bucket][z].a++;
        if (isMade(e)) attackByDefZones[bucket][z].g++;
      }
    }
    if (e.action === "TURNOVER") attackByDefZones[bucket].tf++;
  });
  // earned 7m/2m in normal bucket
  log.forEach((e) => {
    if (e.team === oppN && e.involverNo && e.action === "FOUL" && e.subtype === "7M") attackByDefZones.normal.e7++;
    if (e.team === oppN && e.involverNo && e.action === "2-MIN") attackByDefZones.normal.e2++;
  });

  // -------- Defense by type: shots opponent took vs us (6-0 / Fastbreak)
  const defByType = {
    total: { normal: emptyB(), fb: emptyB() },
    zones: {
      normal: { "9m": emptyB(), "6m": emptyB(), Wing: emptyB(), stl: 0, c7: 0, twoMin: 0 },
      fb: { "9m": emptyB(), "6m": emptyB(), Wing: emptyB(), stl: 0, c7: 0, twoMin: 0 },
    } as Record<"normal" | "fb", { "9m": Bucket; "6m": Bucket; Wing: Bucket; stl: number; c7: number; twoMin: number }>,
  };
  log.forEach((e) => {
    if (e.team !== oppN) return;
    const bucket = e.fastBreak ? "fb" : "normal";
    if (e.action === "GOAL" || e.action === "SHOT MISSED" || e.action === "SHOT SAVED" || e.action === "7M") {
      defByType.total[bucket].a++;
      if (isMade(e)) defByType.total[bucket].g++;
      const z = classifyZone(e);
      if (z === "9m" || z === "6m" || z === "Wing") {
        defByType.zones[bucket][z].a++;
        if (isMade(e)) defByType.zones[bucket][z].g++;
      }
    }
  });
  defByType.zones.normal.stl = totSt;
  defByType.zones.normal.c7 = totC7;
  defByType.zones.normal.twoMin = tot2m;

  // -------- Attack/Defense with superiority
  type Str = "6v6" | "6v5" | "5v6" | "6v4" | "4v6";
  const strAttack = new Map<Str, { att: number; g: number; a: number; tf: number }>();
  const strDefense = new Map<Str, { att: number; g: number; a: number; tf: number }>();
  const strKey = (o: number, p: number): Str | null => {
    const k = `${o}v${p}` as Str;
    if (k === "6v6" || k === "6v5" || k === "5v6" || k === "6v4" || k === "4v6") return k;
    return null;
  };
  log.forEach((e) => {
    if (!e.team) return;
    const isShotOrTF = e.action === "GOAL" || e.action === "7M" || e.action === "SHOT MISSED" || e.action === "SHOT SAVED" || e.action === "TURNOVER";
    if (!isShotOrTF) return;
    const s = strengthAt(e, e.team as 1 | 2);
    const key = strKey(s.own, s.opp);
    if (!key) return;
    const target = e.team === teamN ? strAttack : strDefense;
    if (!target.has(key)) target.set(key, { att: 0, g: 0, a: 0, tf: 0 });
    const row = target.get(key)!;
    row.att++;
    if (e.action === "TURNOVER") row.tf++;
    else {
      row.a++;
      if (isMade(e)) row.g++;
    }
  });

  const superRows: Str[] = ["6v6", "6v5", "5v6", "6v4", "4v6"];
  const superLabel: Record<Str, string> = {
    "6v6": "6 on 6",
    "6v5": "6 on 5",
    "5v6": "5 on 6",
    "6v4": "6 on 4",
    "4v6": "4 on 6",
  };

  const playerByNo = new Map(team.players.map((p) => [p.no, p]));
  const coach = team.coaches?.[0];
  const attacks = totalA + totTF;
  const efficiency = attacks ? Math.round((totalG / attacks) * 100) : 0;

  return (
    <div className="mt-4">
      <div className="text-lg font-extrabold mb-1">{team.name || (teamN === 1 ? "Team 1" : "Team 2")}</div>

      {/* Players */}
      <div className="border border-black overflow-x-auto">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="bg-neutral-100">
              <th colSpan={5} className="text-left px-1 py-0.5 border-b border-black font-bold">Players</th>
              <th colSpan={9} className="text-center px-1 py-0.5 border-b border-l border-black font-bold">Goals / shots</th>
              <th colSpan={5} className="text-center px-1 py-0.5 border-b border-l border-black font-bold">Attack</th>
              <th colSpan={3} className="text-center px-1 py-0.5 border-b border-l border-black font-bold">Def.</th>
              <th colSpan={4} className="text-center px-1 py-0.5 border-b border-l border-black font-bold">Penalties</th>
              <th className="text-center px-1 py-0.5 border-b border-l border-black font-bold">TP</th>
            </tr>
            <tr className="bg-neutral-50">
              {["#", "Surname and name", "S", "Tot.", "%", "9m", "6m", "Wing", "7m", "FB", "Brk.", "LD", "As.", "PC", "E7", "E2", "TF", "St.", "C7", "Blk", "YC", "2m", "R", "B", ""].map((h, i) => (
                <th key={i} className={`px-1 py-0.5 border-b border-black text-left font-semibold ${i === 5 || i === 12 || i === 17 || i === 20 || i === 24 ? "border-l" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => {
              const p = playerByNo.get(s.no);
              const c = perPlayerCat.get(s.no) ?? { "9m": emptyB(), "6m": emptyB(), Wing: emptyB(), "7m": emptyB(), FB: emptyB(), Brk: emptyB(), LD: emptyB() };
              const atk = perPlayerAtk.get(s.no) ?? { e7: 0, e2: 0, tf: 0, pc: 0 };
              const def = perPlayerDef.get(s.no) ?? { c7: 0 };
              const isStarter = p?.onCourt ? "S" : "";
              return (
                <tr key={s.no} className="border-t border-neutral-300">
                  <td className="px-1 py-0.5 tabular-nums">{s.no}</td>
                  <td className="px-1 py-0.5 whitespace-nowrap">{s.name}</td>
                  <td className="px-1 py-0.5">{isStarter}</td>
                  <td className="px-1 py-0.5 tabular-nums">{s.shots ? `${s.goals}/${s.shots}` : "0/0"}</td>
                  <td className="px-1 py-0.5 tabular-nums border-r border-neutral-300">{s.shots ? Math.round((s.goals / s.shots) * 100) : 0}</td>
                  <td className="px-1 py-0.5 tabular-nums border-l">{fmtMA(c["9m"])}</td>
                  <td className="px-1 py-0.5 tabular-nums">{fmtMA(c["6m"])}</td>
                  <td className="px-1 py-0.5 tabular-nums">{fmtMA(c.Wing)}</td>
                  <td className="px-1 py-0.5 tabular-nums">{fmtMA(c["7m"])}</td>
                  <td className="px-1 py-0.5 tabular-nums">{fmtMA(c.FB)}</td>
                  <td className="px-1 py-0.5 tabular-nums">{fmtMA(c.Brk)}</td>
                  <td className="px-1 py-0.5 tabular-nums">{fmtMA(c.LD)}</td>
                  <td className="px-1 py-0.5 tabular-nums border-l">{s.assists || ""}</td>
                  <td className="px-1 py-0.5 tabular-nums">{atk.pc || ""}</td>
                  <td className="px-1 py-0.5 tabular-nums">{atk.e7 || ""}</td>
                  <td className="px-1 py-0.5 tabular-nums">{atk.e2 || ""}</td>
                  <td className="px-1 py-0.5 tabular-nums">{atk.tf || ""}</td>
                  <td className="px-1 py-0.5 tabular-nums border-l">{s.steals || ""}</td>
                  <td className="px-1 py-0.5 tabular-nums">{def.c7 || ""}</td>
                  <td className="px-1 py-0.5 tabular-nums">{s.blocks || ""}</td>
                  <td className="px-1 py-0.5 tabular-nums border-l">{s.yellow || ""}</td>
                  <td className="px-1 py-0.5 tabular-nums">{s.twoMin || ""}</td>
                  <td className="px-1 py-0.5 tabular-nums">{s.red || ""}</td>
                  <td className="px-1 py-0.5 tabular-nums">{s.blue || ""}</td>
                  <td className="px-1 py-0.5 tabular-nums border-l"></td>
                </tr>
              );
            })}
            <tr className="border-t border-black bg-neutral-100 font-bold">
              <td className="px-1 py-0.5" />
              <td className="px-1 py-0.5">TOTAL</td>
              <td />
              <td className="px-1 py-0.5 tabular-nums">{totalA ? `${totalG}/${totalA}` : "0/0"}</td>
              <td className="px-1 py-0.5 tabular-nums border-r">{totalA ? Math.round((totalG / totalA) * 100) : 0}</td>
              <td className="px-1 py-0.5 tabular-nums border-l">{fmtMA(teamCat["9m"])}</td>
              <td className="px-1 py-0.5 tabular-nums">{fmtMA(teamCat["6m"])}</td>
              <td className="px-1 py-0.5 tabular-nums">{fmtMA(teamCat.Wing)}</td>
              <td className="px-1 py-0.5 tabular-nums">{fmtMA(teamCat["7m"])}</td>
              <td className="px-1 py-0.5 tabular-nums">{fmtMA(teamCat.FB)}</td>
              <td className="px-1 py-0.5 tabular-nums">{fmtMA(teamCat.Brk)}</td>
              <td className="px-1 py-0.5 tabular-nums">{fmtMA(teamCat.LD)}</td>
              <td className="px-1 py-0.5 tabular-nums border-l">{totAs || ""}</td>
              <td className="px-1 py-0.5" />
              <td className="px-1 py-0.5 tabular-nums">{totE7 || ""}</td>
              <td className="px-1 py-0.5 tabular-nums">{totE2 || ""}</td>
              <td className="px-1 py-0.5 tabular-nums">{totTF || ""}</td>
              <td className="px-1 py-0.5 tabular-nums border-l">{totSt || ""}</td>
              <td className="px-1 py-0.5 tabular-nums">{totC7 || ""}</td>
              <td className="px-1 py-0.5 tabular-nums">{totBl || ""}</td>
              <td className="px-1 py-0.5 tabular-nums border-l">{totYC || ""}</td>
              <td className="px-1 py-0.5 tabular-nums">{tot2m || ""}</td>
              <td className="px-1 py-0.5 tabular-nums">{totRC || ""}</td>
              <td className="px-1 py-0.5 tabular-nums">{totBC || ""}</td>
              <td className="px-1 py-0.5 border-l" />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Goalkeepers */}
      <div className="mt-2 border border-black overflow-x-auto">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="bg-neutral-100">
              <th colSpan={2} className="text-left px-1 py-0.5 border-b border-black font-bold">Goalkeepers</th>
              <th colSpan={9} className="text-center px-1 py-0.5 border-b border-l border-black font-bold">Saves / shots</th>
            </tr>
            <tr className="bg-neutral-50">
              {["#.", "Surname and name", "Tot.", "%", "9m", "6m", "Wing", "7m", "FB", "Brk.", "LD"].map((h, i) => (
                <th key={i} className="px-1 py-0.5 border-b border-black text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gkReport.keepers.map((g) => {
              const rec = gkPer.get(g.no) || { "9m": emptyB(), "6m": emptyB(), Wing: emptyB(), "7m": emptyB(), FB: emptyB(), Brk: emptyB(), LD: emptyB() };
              const s = SHOT_CATS.reduce((a, c) => a + rec[c].g, 0);
              const f = SHOT_CATS.reduce((a, c) => a + rec[c].a, 0);
              return (
                <tr key={g.no} className="border-t border-neutral-300">
                  <td className="px-1 py-0.5 tabular-nums">{g.no}</td>
                  <td className="px-1 py-0.5 whitespace-nowrap">{g.name || "—"}</td>
                  <td className="px-1 py-0.5 tabular-nums">{f ? `${s}/${f}` : "0/0"}</td>
                  <td className="px-1 py-0.5 tabular-nums">{fmtPct(s, f)}</td>
                  {SHOT_CATS.map((c) => (
                    <td key={c} className="px-1 py-0.5 tabular-nums">{fmtMA(rec[c])}</td>
                  ))}
                </tr>
              );
            })}
            <tr className="border-t border-black bg-neutral-100 font-bold">
              <td />
              <td className="px-1 py-0.5">TOTAL</td>
              <td className="px-1 py-0.5 tabular-nums">{gkTotFaced ? `${gkTotSaves}/${gkTotFaced}` : "0/0"}</td>
              <td className="px-1 py-0.5 tabular-nums">{fmtPct(gkTotSaves, gkTotFaced)}</td>
              {SHOT_CATS.map((c) => (
                <td key={c} className="px-1 py-0.5 tabular-nums">{fmtMA(gkTot[c])}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-[11px]">
        <div><span className="font-bold">Coach:</span> {coach ? `${coach.name} ${coach.surname}`.trim() : "—"}</div>
        <div>
          Number of attacks: <span className="font-semibold">{attacks}</span>,
          &nbsp;Efficiency: <span className="font-semibold">{efficiency}%</span>
        </div>
      </div>

      {/* Attack/Defense by type — side by side */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="font-bold text-[12px] mb-1">Attack by type of defense</div>
          <table className="w-full text-[10px] border border-black border-collapse">
            <thead className="bg-neutral-100">
              <tr>
                <th className="px-1 py-0.5 border border-black text-left"></th>
                {["Shots", "9m", "6m", "Wing", "TF", "E7", "E2"].map((h) => (
                  <th key={h} className="px-1 py-0.5 border border-black">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-1 py-0.5 border border-black font-semibold">On def. 6-0</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{fmtMA(attackByDef.normal) || "0/0"}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{fmtMA(attackByDefZones.normal["9m"])}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{fmtMA(attackByDefZones.normal["6m"])}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{fmtMA(attackByDefZones.normal.Wing)}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{attackByDefZones.normal.tf || ""}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{attackByDefZones.normal.e7 || ""}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{attackByDefZones.normal.e2 || ""}</td>
              </tr>
              <tr>
                <td className="px-1 py-0.5 border border-black font-semibold">Fastbreak</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{fmtMA(attackByDef.fb) || "0/0"}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{fmtMA(attackByDefZones.fb["9m"])}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{fmtMA(attackByDefZones.fb["6m"])}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{fmtMA(attackByDefZones.fb.Wing)}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{attackByDefZones.fb.tf || ""}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{attackByDefZones.fb.e7 || ""}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{attackByDefZones.fb.e2 || ""}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <div className="font-bold text-[12px] mb-1">Defense by type</div>
          <table className="w-full text-[10px] border border-black border-collapse">
            <thead className="bg-neutral-100">
              <tr>
                <th className="px-1 py-0.5 border border-black"></th>
                {["Total", "9m", "6m", "Wing", "Stl.", "C7", "2m"].map((h) => (
                  <th key={h} className="px-1 py-0.5 border border-black">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-1 py-0.5 border border-black font-semibold">Def. 6-0</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{fmtMA(defByType.total.normal) || "0/0"}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{fmtMA(defByType.zones.normal["9m"])}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{fmtMA(defByType.zones.normal["6m"])}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{fmtMA(defByType.zones.normal.Wing)}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{defByType.zones.normal.stl || ""}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{defByType.zones.normal.c7 || ""}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{defByType.zones.normal.twoMin || ""}</td>
              </tr>
              <tr>
                <td className="px-1 py-0.5 border border-black font-semibold">Fastbreak</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{fmtMA(defByType.total.fb) || "0/0"}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{fmtMA(defByType.zones.fb["9m"])}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{fmtMA(defByType.zones.fb["6m"])}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums">{fmtMA(defByType.zones.fb.Wing)}</td>
                <td className="px-1 py-0.5 border border-black tabular-nums"></td>
                <td className="px-1 py-0.5 border border-black tabular-nums"></td>
                <td className="px-1 py-0.5 border border-black tabular-nums"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Superiority / minority tables */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="font-bold text-[12px] mb-1">Attack with superiority / minority</div>
          <table className="w-full text-[10px] border border-black border-collapse">
            <thead className="bg-neutral-100">
              <tr>
                <th className="px-1 py-0.5 border border-black"></th>
                {["Att.", "Eff.", "Shots", "TF"].map((h) => (
                  <th key={h} className="px-1 py-0.5 border border-black">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {superRows.map((k) => {
                const r = strAttack.get(k);
                const eff = r && r.att ? Math.round((r.g / r.att) * 100) : 0;
                return (
                  <tr key={k}>
                    <td className="px-1 py-0.5 border border-black font-semibold">{superLabel[k]}</td>
                    <td className="px-1 py-0.5 border border-black tabular-nums">{r?.att || 0}</td>
                    <td className="px-1 py-0.5 border border-black tabular-nums">{r?.att ? `${eff}%` : ""}</td>
                    <td className="px-1 py-0.5 border border-black tabular-nums">{r ? `${r.g}/${r.a}` : "0/0"}</td>
                    <td className="px-1 py-0.5 border border-black tabular-nums">{r?.tf || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div>
          <div className="font-bold text-[12px] mb-1">Defense with superiority / minority</div>
          <table className="w-full text-[10px] border border-black border-collapse">
            <thead className="bg-neutral-100">
              <tr>
                <th className="px-1 py-0.5 border border-black"></th>
                {["Att.", "Eff.", "Shots", "TF"].map((h) => (
                  <th key={h} className="px-1 py-0.5 border border-black">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {superRows.map((k) => {
                const r = strDefense.get(k);
                const eff = r && r.att ? Math.round((r.g / r.att) * 100) : 0;
                // For defense, show opponent numbers with reversed strength label
                const flipped: Str =
                  k === "6v5" ? "5v6" : k === "5v6" ? "6v5" : k === "6v4" ? "4v6" : k === "4v6" ? "6v4" : "6v6";
                return (
                  <tr key={k}>
                    <td className="px-1 py-0.5 border border-black font-semibold">{superLabel[flipped]}</td>
                    <td className="px-1 py-0.5 border border-black tabular-nums">{r?.att || 0}</td>
                    <td className="px-1 py-0.5 border border-black tabular-nums">{r?.att ? `${eff}%` : ""}</td>
                    <td className="px-1 py-0.5 border border-black tabular-nums">{r ? `${r.g}/${r.a}` : "0/0"}</td>
                    <td className="px-1 py-0.5 border border-black tabular-nums">{r?.tf || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="text-[9px] text-neutral-600 mt-1">Numbers show attacking numbers of opponent. Lower efficiency of opponent means better defense of this team.</div>
        </div>
      </div>
    </div>
  );
}
