import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useGameStore, formatClock } from "@/lib/gameStore";
import { ReportLogo } from "@/components/ReportLogo";
import { AppFooter } from "@/components/AppFooter";
import { buildBoxScore } from "@/lib/exportCsv";
import { HandballCourt } from "@/components/HandballCourt";
import { isPenaltyShot } from "@/lib/court";



export const Route = createFileRoute("/scoreboard")({
  component: ScoreboardPage,
});

function ScoreboardPage() {
  const setupComplete = useGameStore((s) => s.setupComplete);
  const team1 = useGameStore((s) => s.team1);
  const team2 = useGameStore((s) => s.team2);
  const score1 = useGameStore((s) => s.score1);
  const score2 = useGameStore((s) => s.score2);
  const clockSec = useGameStore((s) => s.clockSec);
  const clockRunning = useGameStore((s) => s.clockRunning);
  const half = useGameStore((s) => s.half);
  const info = useGameStore((s) => s.info);
  const activeSuspensions = useGameStore((s) => s.activeSuspensions);
  const log = useGameStore((s) => s.log);
  const shootoutRounds = useGameStore((s) => s.shootoutRounds);
  const team1Direction = useGameStore((s) => s.team1Direction);

  useEffect(() => {
    const refresh = () => void useGameStore.persist.rehydrate();
    refresh();
    const onVisibility = () => { if (!document.hidden) refresh(); };
    const onStorage = (e: StorageEvent) => { if (e.key === "b-livestats") refresh(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  if (!hydrated) return null;
  if (!setupComplete) return <Navigate to="/" />;

  const susp1 = activeSuspensions.filter((s) => s.team === 1);
  const susp2 = activeSuspensions.filter((s) => s.team === 2);
  const periodLabel = half === 1 ? "1st" : half === 2 ? "2st" : half === 3 ? "EX" : "pen";

  const shootout1 = shootoutRounds.reduce((a, r) => a + (r.t1 === "G" ? 1 : 0), 0);
  const shootout2 = shootoutRounds.reduce((a, r) => a + (r.t2 === "G" ? 1 : 0), 0);

  const stats1 = buildBoxScore(log, team1, 1);
  const stats2 = buildBoxScore(log, team2, 2);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center select-none">
      <div className="w-full max-w-6xl px-8">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-6">
          <div />
          <div className="flex flex-col items-center gap-2">
            <ReportLogo className="text-white/70" />
            <div className="text-center text-white/60 text-sm uppercase tracking-[0.3em]">
              {info.competition || "Live Match"}
            </div>
          </div>
          <div />
        </div>


        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
          <TeamBlock team={team1} score={score1} shootout={shootout1} timeouts={log.filter((e) => e.action === "TIMEOUT" && e.team === 1 && e.half === half).length} susp={susp1} align="right" />

          <div className="flex flex-col items-center px-6">
            <div className="text-white/50 text-xs tracking-[0.4em] font-bold uppercase mb-1">{periodLabel}</div>
            <div className="font-mono text-7xl md:text-9xl font-bold tabular-nums">{formatClock(clockSec)}</div>
            <div className={`mt-3 px-3 py-1 text-[10px] tracking-widest font-bold uppercase rounded ${clockRunning ? "bg-tab-done text-white" : "bg-white/10 text-white/60"}`}>
              {clockRunning ? "Live" : "Paused"}
            </div>
          </div>

          <TeamBlock team={team2} score={score2} shootout={shootout2} timeouts={log.filter((e) => e.action === "TIMEOUT" && e.team === 2 && e.half === half).length} susp={susp2} align="left" />
        </div>

        {/* Player stats tables */}
        <div className="grid grid-cols-2 gap-6 mt-8">
          <PlayerStatsTable team={team1} stats={stats1} align="right" />
          <PlayerStatsTable team={team2} stats={stats2} align="left" />
        </div>

        {/* Shot Locations */}
        <div className="mt-8">
          <div className="text-center text-white/60 text-xs uppercase tracking-[0.3em] mb-4 font-bold">Shot Locations by Team</div>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white/5 rounded-lg p-4 flex flex-col">
              <div className="text-center text-sm font-bold mb-2 uppercase tracking-wider" style={{ color: team1.color }}>{team1.name || team1.shortCode}</div>
              <div className="aspect-[2/1] w-full relative">
                <HandballCourt
                  className="w-full h-full"
                  shots={log.filter((e) => e.team === 1 && (isPenaltyShot(e) || e.x != null))}
                  team1Color={team1.color}
                  team2Color={team1.color}
                  team1Direction={team1Direction}
                />
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-4 flex flex-col">
              <div className="text-center text-sm font-bold mb-2 uppercase tracking-wider" style={{ color: team2.color }}>{team2.name || team2.shortCode}</div>
              <div className="aspect-[2/1] w-full relative">
                <HandballCourt
                  className="w-full h-full"
                  shots={log.filter((e) => e.team === 2 && (isPenaltyShot(e) || e.x != null))}
                  team1Color={team2.color}
                  team2Color={team2.color}
                  team1Direction={team1Direction}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-3 text-xs text-white/60">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-tab-done inline-block"></span> Goal</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 inline-block relative"><span className="absolute inset-0 bg-accent-red" style={{clipPath: 'polygon(20% 0%, 0% 20%, 30% 50%, 0% 80%, 20% 100%, 50% 70%, 80% 100%, 100% 80%, 70% 50%, 100% 20%, 80% 0%, 50% 30%)'}}></span></span> Missed</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border border-dashed border-white/60 inline-block"></span> Saved</span>
          </div>
        </div>

        {/* Shootout rounds */}
        {shootoutRounds.length > 0 && (
          <div className="mt-8">
            <ShootoutDisplay rounds={shootoutRounds} team1={team1} team2={team2} />
          </div>
        )}

        <div className="mt-10 text-center text-white/40 text-xs tracking-widest uppercase">
          {info.venue} {info.city ? `· ${info.city}` : ""}
        </div>

        <AppFooter variant="dark" />
      </div>
    </div>
  );
}


function TeamBlock({ team, score, shootout, timeouts, susp, align }: any) {
  return (
    <div className={`flex flex-col ${align === "right" ? "items-end text-right" : "items-start text-left"}`}>
      <div className="flex items-center gap-4">
        {align === "left" && <div className="w-3 h-20" style={{ background: team.color }} />}
        <div className={align === "right" ? "order-1" : ""}>
          <div className="text-3xl md:text-5xl font-bold tracking-wide">{team.name || "—"}</div>
          <div className="text-white/50 text-sm tracking-widest uppercase">{team.shortCode}</div>
        </div>
        {align === "right" && <div className="w-3 h-20" style={{ background: team.color }} />}
      </div>
      <div className="text-[10rem] md:text-[12rem] leading-none font-bold tabular-nums mt-2">
        {score}{shootout > 0 ? <span className="text-[4rem] md:text-[5rem] text-white/60 align-top">+{shootout}</span> : ""}
      </div>
      <div className="flex gap-2 mt-2 items-center">
        <span className="text-[10px] uppercase tracking-widest text-white/40">T/O</span>
        {[0, 1].map((i) => (
          <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < timeouts ? "bg-accent-orange" : "bg-white/15"}`} />
        ))}
      </div>

      {susp.length > 0 && (
        <div className={`flex flex-wrap gap-2 mt-3 ${align === "right" ? "justify-end" : ""}`}>
          {susp.map((s: any) => (
            <div key={s.id} className="bg-accent-red/90 px-2 py-1 rounded text-xs font-bold tabular-nums">
              #{s.playerNo} {formatClock(s.remainingSec)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShootoutDisplay({ rounds, team1, team2 }: { rounds: { t1: ("G" | "M" | null); t2: ("G" | "M" | null); t1Player?: string; t2Player?: string }[]; team1: any; team2: any }) {
  return (
    <div className="bg-white/5 rounded-lg p-4">
      <div className="text-center text-white/60 text-xs uppercase tracking-[0.3em] mb-3 font-bold">Penalty Shootout</div>
      <div className="flex justify-center">
        <table className="text-sm text-center border-collapse">
          <thead>
            <tr className="text-white/50 text-xs uppercase tracking-wider">
              <th className="px-3 py-1">#</th>
              <th className="px-3 py-1" style={{ color: team1.color }}>{team1.shortCode}</th>
              <th className="px-3 py-1" style={{ color: team2.color }}>{team2.shortCode}</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r, i) => (
              <tr key={i} className="border-t border-white/10">
                <td className="px-3 py-1 font-mono text-white/70">{i + 1}</td>
                <td className="px-3 py-1">
                  <div className="flex items-center justify-center gap-2">
                    {r.t1Player && <span className="text-white/70 font-mono text-xs">#{r.t1Player}</span>}
                    {r.t1 === "G" ? <span className="text-tab-done font-bold">●</span> : r.t1 === "M" ? <span className="text-accent-red font-bold">✕</span> : <span className="text-white/20">—</span>}
                  </div>
                </td>
                <td className="px-3 py-1">
                  <div className="flex items-center justify-center gap-2">
                    {r.t2Player && <span className="text-white/70 font-mono text-xs">#{r.t2Player}</span>}
                    {r.t2 === "G" ? <span className="text-tab-done font-bold">●</span> : r.t2 === "M" ? <span className="text-accent-red font-bold">✕</span> : <span className="text-white/20">—</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayerStatsTable({ team, stats, align }: { team: any; stats: ReturnType<typeof buildBoxScore>; align: "left" | "right" }) {
  const rows = stats.filter((s) => s.shots > 0 || s.fouls > 0 || s.goals > 0);
  return (
    <div className={`flex flex-col ${align === "right" ? "items-end" : "items-start"}`}>
      <div className="text-xs uppercase tracking-widest text-white/50 mb-2 font-bold">{team.shortCode} — Players</div>
      <table className="text-sm border-collapse">
        <thead>
          <tr className="text-white/50 text-xs uppercase tracking-wider">
            <th className="px-2 py-1 text-left">#</th>
            <th className="px-2 py-1 text-left">Player</th>
            <th className="px-2 py-1 text-center">G</th>
            <th className="px-2 py-1 text-center">Shots</th>
            <th className="px-2 py-1 text-center">F</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.no} className="border-t border-white/10">
              <td className="px-2 py-1 font-bold tabular-nums">{s.no}</td>
              <td className="px-2 py-1 whitespace-nowrap">{s.name || "—"}</td>
              <td className="px-2 py-1 text-center tabular-nums font-bold">{s.goals || ""}</td>
              <td className="px-2 py-1 text-center tabular-nums">{s.shots || ""}</td>
              <td className="px-2 py-1 text-center tabular-nums">{s.fouls || ""}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-2 py-2 text-white/30 text-xs italic">No stats yet</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
