import { useMemo } from "react";
import { useGameStore } from "@/lib/gameStore";

export function LiveStatsStrip() {
  const log = useGameStore((s) => s.log);
  const team1 = useGameStore((s) => s.team1);
  const team2 = useGameStore((s) => s.team2);
  const score1 = useGameStore((s) => s.score1);
  const score2 = useGameStore((s) => s.score2);
  const halves = useGameStore((s) => s.info.halves);

  const data = useMemo(() => {
    const halfScores: Record<number, { s1: number; s2: number }> = {};
    let maxHalf = halves;
    for (const e of log) {
      if (e.half && e.half > maxHalf) maxHalf = e.half;
      if (e.action !== "GOAL" && e.action !== "7M") continue;
      const h = e.half || 1;
      halfScores[h] ||= { s1: 0, s2: 0 };
      if (e.team === 1) halfScores[h].s1++;
      else if (e.team === 2) halfScores[h].s2++;
    }
    const extras = Math.min(4, Math.max(0, maxHalf - halves));
    const scorers = (teamN: 1 | 2, players: any[]) => {
      const counts: Record<string, number> = {};
      log.forEach((e) => {
        if (e.team === teamN && (e.action === "GOAL" || e.action === "7M") && e.playerNo) {
          counts[e.playerNo] = (counts[e.playerNo] || 0) + 1;
        }
      });
      return Object.entries(counts)
        .map(([no, g]) => {
          const pl = players.find((p) => p.no === no);
          return { no, g, name: pl ? `${pl.name} ${pl.surname}`.trim() || `#${no}` : `#${no}` };
        })
        .sort((a, b) => b.g - a.g)
        .slice(0, 3);
    };
    let p1 = 0, p2 = 0;
    log.forEach((e) => {
      if (e.action === "GOAL" || e.action === "7M" || e.action === "STEAL") {
        if (e.team === 1) p1++; else if (e.team === 2) p2++;
      } else if (e.action === "TURNOVER") {
        if (e.team === 1) p2++; else if (e.team === 2) p1++;
      }
    });
    const tot = p1 + p2 || 1;
    return {
      halfScores,
      extras,
      top1: scorers(1, team1.players),
      top2: scorers(2, team2.players),
      poss1: Math.round((p1 / tot) * 100),
      poss2: Math.round((p2 / tot) * 100),
    };
  }, [log, team1.players, team2.players, halves]);

  return (
    <div className="bg-white border grid grid-cols-3 text-xs">
      {/* per-half scores */}
      <div className="p-2 border-r">
        <table className="w-full text-center font-mono">
          <thead>
            <tr className="text-[10px] text-muted-foreground">
              <th className="text-left font-bold">Team</th>
              {Array.from({ length: halves }).map((_, i) => <th key={`h${i}`}>H{i + 1}</th>)}
              <th>Ex1</th>
              <th>Ex2</th>
              <th>Ex3</th>
              <th>Ex4</th>
              <th>Final</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-left font-bold truncate" style={{ color: team1.color }}>{team1.shortCode || team1.name || "T1"}</td>
              {Array.from({ length: halves }).map((_, i) => <td key={`h${i}`}>{data.halfScores[i + 1]?.s1 ?? 0}</td>)}
              <td>{data.halfScores[halves + 1]?.s1 ?? 0}</td>
              <td>{data.halfScores[halves + 2]?.s1 ?? 0}</td>
              <td>{data.halfScores[halves + 3]?.s1 ?? 0}</td>
              <td>{data.halfScores[halves + 4]?.s1 ?? 0}</td>
              <td className="font-bold">{score1}</td>
            </tr>
            <tr>
              <td className="text-left font-bold truncate" style={{ color: team2.color }}>{team2.shortCode || team2.name || "T2"}</td>
              {Array.from({ length: halves }).map((_, i) => <td key={`h${i}`}>{data.halfScores[i + 1]?.s2 ?? 0}</td>)}
              <td>{data.halfScores[halves + 1]?.s2 ?? 0}</td>
              <td>{data.halfScores[halves + 2]?.s2 ?? 0}</td>
              <td>{data.halfScores[halves + 3]?.s2 ?? 0}</td>
              <td>{data.halfScores[halves + 4]?.s2 ?? 0}</td>
              <td className="font-bold">{score2}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* top scorers */}
      <div className="p-2 border-r">
        <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Top Scorers</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            {data.top1.length === 0 && <div className="text-muted-foreground text-[10px]">—</div>}
            {data.top1.map((s) => (
              <div key={s.no} className="flex items-center gap-1 truncate">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: team1.color }} />
                <span className="font-bold">#{s.no}</span>
                <span className="truncate">{s.name}</span>
                <span className="ml-auto font-mono font-bold">{s.g}</span>
              </div>
            ))}
          </div>
          <div>
            {data.top2.length === 0 && <div className="text-muted-foreground text-[10px]">—</div>}
            {data.top2.map((s) => (
              <div key={s.no} className="flex items-center gap-1 truncate">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: team2.color }} />
                <span className="font-bold">#{s.no}</span>
                <span className="truncate">{s.name}</span>
                <span className="ml-auto font-mono font-bold">{s.g}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* possession % */}
      <div className="p-2">
        <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Possession Share</div>
        <div className="h-4 w-full flex rounded overflow-hidden border">
          <div style={{ width: `${data.poss1}%`, background: team1.color }} className="text-white text-[10px] font-bold flex items-center justify-center">
            {data.poss1 > 8 ? `${data.poss1}%` : ""}
          </div>
          <div style={{ width: `${data.poss2}%`, background: team2.color }} className="text-white text-[10px] font-bold flex items-center justify-center">
            {data.poss2 > 8 ? `${data.poss2}%` : ""}
          </div>
        </div>
        <div className="flex justify-between mt-1 text-[10px] font-bold">
          <span style={{ color: team1.color }}>{team1.shortCode || "T1"}</span>
          <span style={{ color: team2.color }}>{team2.shortCode || "T2"}</span>
        </div>
      </div>
    </div>
  );
}
