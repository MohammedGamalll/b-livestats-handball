import { classifyShotZoneOrOverride, isFastBreak } from "@/lib/court";
import type { LogEntry, TeamSetup } from "@/lib/gameStore";
import type { buildBoxScore } from "@/lib/exportCsv";

export type Zone = "6m" | "Wing" | "9m" | "7m" | "FB";

// Returns the geographic zone (6m/9m/Wing/7m). FB is tracked separately.
export function classifyZone(e: LogEntry): Exclude<Zone, "FB"> | null {
  return classifyShotZoneOrOverride(e);
}

export interface ZoneCount { g: number; a: number; saved: number; missed: number; post: number; blocked: number }
export const emptyZone = (): ZoneCount => ({ g: 0, a: 0, saved: 0, missed: 0, post: 0, blocked: 0 });

export function fmtMA(g: number, a: number) { return a ? `${g}/${a}` : ""; }
export function fmtPct(g: number, a: number) { return a ? `${Math.round((g / a) * 100)}` : ""; }

export function TeamStatsTable({ name, color, team, stats, log, teamN }: { name: string; color: string; team: TeamSetup; stats: ReturnType<typeof buildBoxScore>; log: LogEntry[]; teamN: 1 | 2 }) {
  const perPlayer = new Map<string, Record<Zone, ZoneCount>>();
  const ensure = (pn: string) => {
    let m = perPlayer.get(pn);
    if (!m) { m = { "6m": emptyZone(), Wing: emptyZone(), "9m": emptyZone(), "7m": emptyZone(), FB: emptyZone() }; perPlayer.set(pn, m); }
    return m;
  };
  const sub = new Map<string, { r7m: number; p7m: number; rf: number; dr: number; or: number }>();
  const ensureSub = (pn: string) => {
    let m = sub.get(pn);
    if (!m) { m = { r7m: 0, p7m: 0, rf: 0, dr: 0, or: 0 }; sub.set(pn, m); }
    return m;
  };
  log.forEach((e) => {
    if (e.team === teamN && e.playerNo) {
      const isBtEg = e.subtype === "BREAK THROUGH" || e.subtype === "EMPTY GOAL";
      const isShot = e.action === "GOAL" || e.action === "SHOT MISSED" || e.action === "SHOT SAVED" || e.action === "7M";
      const bump = (rec: ZoneCount) => {
        rec.a++;
        if (e.action === "GOAL" || e.action === "7M") rec.g++;
        else if (e.action === "SHOT SAVED") rec.saved++;
        else if (e.action === "SHOT MISSED") {
          if (e.missZone === "POST" || e.subtype === "POST") rec.post++;
          else if (e.subtype === "BLOCK") rec.blocked++;
          else rec.missed++;
        }
      };
      const z = isBtEg ? null : classifyZone(e);
      if (z) bump(ensure(e.playerNo)[z]);
      // FB is a parallel counter — any shot flagged as fast break counts here too,
      // regardless of geographic zone.
      if (isShot && !isBtEg && isFastBreak(e)) bump(ensure(e.playerNo).FB);
    }
    if (e.team !== teamN && e.involverNo) {
      const sb = ensureSub(e.involverNo);
      if (e.action === "FOUL" || e.action === "7M" || e.action === "2-MIN" || e.action === "YELLOW" || e.action === "RED" || e.action === "BLUE") sb.rf++;
      if (e.action === "FOUL" && e.subtype === "7M") sb.r7m++;
    }
    if (e.team === teamN && e.playerNo && e.action === "FOUL" && e.subtype === "7M") {
      const sb = ensureSub(e.playerNo);
      sb.p7m++;
    }
    if (e.reboundNo && e.reboundTeam === teamN) {
      if (e.team === teamN) {
        const sb = ensureSub(e.reboundNo); sb.or++;
      } else {
        const sb = ensureSub(e.reboundNo); sb.dr++;
      }
    }
  });

  const zones: Zone[] = ["6m", "Wing", "9m", "7m", "FB"];
  const teamZ: Record<Zone, ZoneCount> = { "6m": emptyZone(), Wing: emptyZone(), "9m": emptyZone(), "7m": emptyZone(), FB: emptyZone() };
  perPlayer.forEach((rec) => {
    zones.forEach((z) => {
      teamZ[z].g += rec[z].g;
      teamZ[z].a += rec[z].a;
      teamZ[z].saved += rec[z].saved;
      teamZ[z].missed += rec[z].missed;
      teamZ[z].post += rec[z].post;
      teamZ[z].blocked += rec[z].blocked;
    });
  });

  const btEg = new Map<string, { btG: number; btA: number; egG: number; egA: number }>();
  log.forEach((e) => {
    if (e.team !== teamN || !e.playerNo) return;
    if (!(e.action === "GOAL" || e.action === "SHOT MISSED" || e.action === "SHOT SAVED" || e.action === "7M")) return;
    const cur = btEg.get(e.playerNo) ?? { btG: 0, btA: 0, egG: 0, egA: 0 };
    const made = e.action === "GOAL" || e.action === "7M";
    if (e.subtype === "BREAK THROUGH") { cur.btA++; if (made) cur.btG++; }
    if (e.subtype === "EMPTY GOAL") { cur.egA++; if (made) cur.egG++; }
    btEg.set(e.playerNo, cur);
  });
  const teamBT = Array.from(btEg.values()).reduce((a, v) => ({ g: a.g + v.btG, a: a.a + v.btA }), { g: 0, a: 0 });
  const teamEG = Array.from(btEg.values()).reduce((a, v) => ({ g: a.g + v.egG, a: a.a + v.egA }), { g: 0, a: 0 });

  const totals = stats.reduce(
    (a, s) => ({
      goals: a.goals + s.goals, shots: a.shots + s.shots,
      assists: a.assists + s.assists, steals: a.steals + s.steals,
      turnovers: a.turnovers + s.turnovers, blocks: a.blocks + s.blocks,
      yellow: a.yellow + s.yellow, twoMin: a.twoMin + s.twoMin, red: a.red + s.red,
      pen: a.pen + s.pen, fouls: a.fouls + s.fouls,
    }),
    { goals: 0, shots: 0, assists: 0, steals: 0, turnovers: 0, blocks: 0, yellow: 0, twoMin: 0, red: 0, pen: 0, fouls: 0 },
  );

  const playerByNo = new Map(team.players.map((p) => [p.no, p]));

  const groupHead = (label: string, span: number, bg: string) => (
    <th colSpan={span} className="px-1 py-1 text-center font-bold uppercase tracking-wider border-b" style={{ background: bg }}>{label}</th>
  );

  const HEADERS = ["No","Name","Pos","Goals","M/A","%","6m","9m","Wing","FB","BT","EG","7m M/A","7m %","AS","R7m","TO","ST","BS","P7m","RF","DF","OF","TOT","2m","YC","RC","BC"];

  return (
    <div className="bg-white border overflow-x-auto">
      <div className="px-3 py-2 text-white font-bold uppercase tracking-wider text-sm" style={{ background: color }}>{name}</div>
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr>
            {groupHead("Players", 3, "#e5e7eb")}
            {groupHead("Shots", 9, "#f3f4f6")}
            {groupHead("7m", 2, "#e5e7eb")}
            {groupHead("Offence", 3, "#f3f4f6")}
            {groupHead("Defence", 4, "#e5e7eb")}
            {groupHead("WIN", 3, "#f3f4f6")}
            {groupHead("Penalties Due", 4, "#e5e7eb")}
          </tr>
          <tr className="bg-muted">
            {HEADERS.map((h, i) => (
              <th key={i} className="px-1 py-1 text-left font-bold uppercase tracking-wider border-b">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map((s, idx) => {
            const p = playerByNo.get(s.no);
            const z = perPlayer.get(s.no) ?? { "6m": emptyZone(), Wing: emptyZone(), "9m": emptyZone(), "7m": emptyZone(), FB: emptyZone() };
            const sb = sub.get(s.no) ?? { r7m: 0, p7m: 0, rf: 0, dr: 0, or: 0 };
            const pct = s.shots ? Math.round((s.goals / s.shots) * 100) : "";
            const stripe = idx % 2 === 0 ? "" : "bg-muted/30";
            const tot = sb.dr + sb.or;
            return (
              <tr key={s.no} className={`border-t ${stripe}`}>
                <td className="px-1 py-1 font-bold tabular-nums">{s.no}</td>
                <td className="px-1 py-1 whitespace-nowrap">{s.name || "—"}</td>
                <td className="px-1 py-1 uppercase">{p?.position ?? ""}</td>
                <td className="px-1 py-1 tabular-nums font-bold">{s.goals || ""}</td>
                <td className="px-1 py-1 tabular-nums">{s.shots ? `${s.goals}/${s.shots}` : ""}</td>
                <td className="px-1 py-1 tabular-nums">{pct}</td>
                <td className="px-1 py-1 tabular-nums">{fmtMA(z["6m"].g, z["6m"].a)}</td>
                <td className="px-1 py-1 tabular-nums">{fmtMA(z["9m"].g, z["9m"].a)}</td>
                <td className="px-1 py-1 tabular-nums">{fmtMA(z.Wing.g, z.Wing.a)}</td>
                <td className="px-1 py-1 tabular-nums">{fmtMA(z.FB.g, z.FB.a)}</td>
                <td className="px-1 py-1 tabular-nums">{fmtMA(btEg.get(s.no)?.btG ?? 0, btEg.get(s.no)?.btA ?? 0)}</td>
                <td className="px-1 py-1 tabular-nums">{fmtMA(btEg.get(s.no)?.egG ?? 0, btEg.get(s.no)?.egA ?? 0)}</td>
                <td className="px-1 py-1 tabular-nums">{fmtMA(z["7m"].g, z["7m"].a)}</td>
                <td className="px-1 py-1 tabular-nums">{fmtPct(z["7m"].g, z["7m"].a)}</td>
                <td className="px-1 py-1 tabular-nums">{s.assists || ""}</td>
                <td className="px-1 py-1 tabular-nums">{sb.r7m || ""}</td>
                <td className="px-1 py-1 tabular-nums">{s.turnovers || ""}</td>
                <td className="px-1 py-1 tabular-nums">{s.steals || ""}</td>
                <td className="px-1 py-1 tabular-nums">{s.blocks || ""}</td>
                <td className="px-1 py-1 tabular-nums">{sb.p7m || ""}</td>
                <td className="px-1 py-1 tabular-nums">{sb.rf || ""}</td>
                <td className="px-1 py-1 tabular-nums">{sb.dr || ""}</td>
                <td className="px-1 py-1 tabular-nums">{sb.or || ""}</td>
                <td className="px-1 py-1 tabular-nums font-bold">{tot || ""}</td>
                <td className="px-1 py-1 tabular-nums">{s.twoMin || ""}</td>
                <td className="px-1 py-1 tabular-nums">{s.yellow || ""}</td>
                <td className="px-1 py-1 tabular-nums">{s.red || ""}</td>
                <td className="px-1 py-1 tabular-nums">{s.blue || ""}</td>
              </tr>
            );
          })}
          <tr className="bg-muted/70 border-t font-bold">
            <td className="px-1 py-1" />
            <td className="px-1 py-1 uppercase text-[10px]">Total</td>
            <td />
            <td className="px-1 py-1 tabular-nums">{totals.goals || ""}</td>
            <td className="px-1 py-1 tabular-nums">{totals.shots ? `${totals.goals}/${totals.shots}` : ""}</td>
            <td className="px-1 py-1 tabular-nums">{totals.shots ? Math.round((totals.goals / totals.shots) * 100) : ""}</td>
            <td className="px-1 py-1 tabular-nums">{fmtMA(teamZ["6m"].g, teamZ["6m"].a)}</td>
            <td className="px-1 py-1 tabular-nums">{fmtMA(teamZ["9m"].g, teamZ["9m"].a)}</td>
            <td className="px-1 py-1 tabular-nums">{fmtMA(teamZ.Wing.g, teamZ.Wing.a)}</td>
            <td className="px-1 py-1 tabular-nums">{fmtMA(teamZ.FB.g, teamZ.FB.a)}</td>
            <td className="px-1 py-1 tabular-nums">{fmtMA(teamBT.g, teamBT.a)}</td>
            <td className="px-1 py-1 tabular-nums">{fmtMA(teamEG.g, teamEG.a)}</td>
            <td className="px-1 py-1 tabular-nums">{fmtMA(teamZ["7m"].g, teamZ["7m"].a)}</td>
            <td className="px-1 py-1 tabular-nums">{fmtPct(teamZ["7m"].g, teamZ["7m"].a)}</td>
            <td className="px-1 py-1 tabular-nums">{totals.assists || ""}</td>
            <td />
            <td className="px-1 py-1 tabular-nums">{totals.turnovers || ""}</td>
            <td className="px-1 py-1 tabular-nums">{totals.steals || ""}</td>
            <td className="px-1 py-1 tabular-nums">{totals.blocks || ""}</td>
            <td /><td /><td /><td /><td />
            <td className="px-1 py-1 tabular-nums">{totals.twoMin || ""}</td>
            <td className="px-1 py-1 tabular-nums">{totals.yellow || ""}</td>
            <td className="px-1 py-1 tabular-nums">{totals.red || ""}</td>
            <td className="px-1 py-1 tabular-nums">{stats.reduce((a, s) => a + s.blue, 0) || ""}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
