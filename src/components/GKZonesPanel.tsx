import type { LogEntry } from "@/lib/gameStore";
import goalAsset from "@/assets/handball-goal-real.png";

export function GKZonesPanel({
  teamName,
  color,
  shotsFaced,
}: {
  teamName: string;
  color: string;
  shotsFaced: LogEntry[];
}) {
  const goals = shotsFaced.filter((e) => e.action === "GOAL" || e.action === "7M").length;
  const saved = shotsFaced.filter((e) => e.action === "SHOT SAVED").length;
  const missed = shotsFaced.filter((e) => e.action === "SHOT MISSED");
  const posts = missed.filter((e) => e.missZone === "POST" || e.missZone === "LEFT_CROSSBAR" || e.missZone === "RIGHT_CROSSBAR").length;
  const offFrame = missed.length - posts;
  const onFrame = goals + saved;
  const total = goals + saved + missed.length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const placed = shotsFaced.filter((e) => e.goalX != null && e.goalY != null);
  return (
    <div className="bg-white border">
      <div className="px-3 py-2 text-white font-bold uppercase tracking-wider text-xs" style={{ background: color }}>
        GK Shot Zones — {teamName}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-3 p-3">
        <div className="relative">
          <img src={goalAsset} alt="goal" className="w-full h-auto block print:w-auto print:max-h-[30vh] print:mx-auto" draggable={false} />
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {placed.map((s) => {
              const isGoal = s.action === "GOAL" || s.action === "7M";
              const isSave = s.action === "SHOT SAVED";
              const stroke = isGoal ? "#16a34a" : isSave ? "#2563eb" : "#dc2626";
              return (
                <g key={s.id} transform={`translate(${(s.goalX ?? 0) * 100} ${(s.goalY ?? 0) * 100})`} stroke={stroke} strokeWidth="0.8" strokeLinecap="round" fill="none">
                  {isGoal && (<><line x1="-1.6" y1="0" x2="1.6" y2="0" /><line x1="0" y1="-1.6" x2="0" y2="1.6" /></>)}
                  {isSave && (<circle r="1.6" />)}
                  {!isGoal && !isSave && (<><line x1="-1.6" y1="-1.6" x2="1.6" y2="1.6" /><line x1="-1.6" y1="1.6" x2="1.6" y2="-1.6" /></>)}
                </g>
              );
            })}
          </svg>
        </div>
        <table className="text-xs self-start min-w-[180px]">
          <thead className="bg-muted">
            <tr><th className="px-2 py-1 text-left">Type</th><th className="px-2 py-1 text-center">#</th><th className="px-2 py-1 text-center">%</th></tr>
          </thead>
          <tbody>
            <tr className="border-t"><td className="px-2 py-1">Goals</td><td className="px-2 py-1 text-center tabular-nums font-bold text-brand-green">{goals}</td><td className="px-2 py-1 text-center tabular-nums">{pct(goals)}%</td></tr>
            <tr className="border-t"><td className="px-2 py-1">Saves</td><td className="px-2 py-1 text-center tabular-nums font-bold" style={{ color }}>{saved}</td><td className="px-2 py-1 text-center tabular-nums">{pct(saved)}%</td></tr>
            <tr className="border-t"><td className="px-2 py-1">Post / Crossbar</td><td className="px-2 py-1 text-center tabular-nums font-bold">{posts}</td><td className="px-2 py-1 text-center tabular-nums">{pct(posts)}%</td></tr>
            <tr className="border-t"><td className="px-2 py-1">On Frame</td><td className="px-2 py-1 text-center tabular-nums">{onFrame}</td><td className="px-2 py-1 text-center tabular-nums">{pct(onFrame)}%</td></tr>
            <tr className="border-t"><td className="px-2 py-1">Off Frame</td><td className="px-2 py-1 text-center tabular-nums">{offFrame}</td><td className="px-2 py-1 text-center tabular-nums">{pct(offFrame)}%</td></tr>
            <tr className="border-t bg-muted/50"><td className="px-2 py-1 font-bold">Total Shots</td><td className="px-2 py-1 text-center tabular-nums font-bold">{total}</td><td className="px-2 py-1 text-center">—</td></tr>
          </tbody>
        </table>
      </div>
      <div className="px-3 pb-2 text-[10px] text-muted-foreground flex gap-3">
        <span className="text-brand-green font-bold">+ Goal</span>
        <span style={{ color }} className="font-bold">○ Save</span>
        <span className="text-accent-red font-bold">✕ Missed</span>
      </div>
    </div>
  );
}
