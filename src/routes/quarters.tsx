import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";

import { AppFooter } from "@/components/AppFooter";
import { HandballCourt } from "@/components/HandballCourt";
import { ReportLogo } from "@/components/ReportLogo";
import { isPenaltyShot } from "@/lib/court";
import { useGameStore, type LogEntry, type TeamDirection } from "@/lib/gameStore";
import { periodTitle } from "@/lib/periods";
import { matchReportSearch } from "@/lib/matchReportSearch";
import { useMatchReport } from "@/lib/useMatchReport";
import { GKZonesPanel } from "@/components/GKZonesPanel";

export const Route = createFileRoute("/quarters")({
  validateSearch: matchReportSearch,
  component: QuartersPage,
});

function directionForHalf(
  halfDirections: Record<number, TeamDirection>,
  period: number,
  fallback: TeamDirection,
): TeamDirection {
  return halfDirections[period] ?? fallback;
}

function periodScore(log: LogEntry[], period: number) {
  let s1 = 0;
  let s2 = 0;
  for (const e of log) {
    if (Number(e.half) !== period) continue;
    if (e.action !== "GOAL" && e.action !== "7M") continue;
    if (e.team === 1) s1++;
    else if (e.team === 2) s2++;
  }
  return { s1, s2 };
}

function courtShots(log: LogEntry[], period: number) {
  return log.filter((e) => Number(e.half) === period && (isPenaltyShot(e) || e.x != null));
}

function QuartersPage() {
  const { matchId, print } = Route.useSearch();
  const {
    archived,
    loading,
    missing,
    ready,
    team1,
    team2,
    score1,
    score2,
    log,
    info,
    half,
    team1Direction,
    halfDirections,
  } = useMatchReport(matchId);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (matchId) return;
    const refresh = () => void useGameStore.persist.rehydrate();
    refresh();
    const onVisibility = () => {
      if (!document.hidden) refresh();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "b-livestats") refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [matchId]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !ready) return;
    if (print === "1" || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("print") === "1")) {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [hydrated, ready, print]);

  const periods = useMemo(() => {
    let max = half;
    for (const e of log) {
      if (e.half > max) max = e.half;
    }
    return Array.from({ length: Math.max(max, 1) }, (_, i) => i + 1);
  }, [half, log]);

  if (!hydrated) return null;
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading match report…</div>;
  }
  if (missing) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white border p-6 text-center max-w-md">
          <div className="text-lg font-bold mb-2">Match not found</div>
          <Link to="/reports" className="text-xs font-bold uppercase underline">← Back to reports</Link>
        </div>
      </div>
    );
  }
  if (!ready) return <Navigate to="/" />;

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.97_0.005_260)] p-6 print:p-2">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">QUARTERS</h1>
            <div className="text-xs text-muted-foreground">
              {info.competition} · {info.date} · {info.venue}
            </div>
          </div>
          <div className="flex justify-center">
            <ReportLogo size="lg" />
          </div>
          <div className="flex items-center gap-2 justify-end">
            {archived ? (
              <Link to="/reports" className="h-9 px-3 bg-muted text-xs font-bold uppercase flex items-center">
                Back
              </Link>
            ) : (
              <Link to="/game" className="h-9 px-3 bg-muted text-xs font-bold uppercase flex items-center">
                Back
              </Link>
            )}
            <Link
              to="/stats"
              search={matchId ? { matchId } : undefined}
              className="h-9 px-3 bg-muted text-xs font-bold uppercase flex items-center"
            >
              Box Score
            </Link>
            <button
              onClick={() => window.print()}
              className="h-9 px-3 bg-topbar text-white text-xs font-bold uppercase flex items-center gap-2"
            >
              <Printer className="h-4 w-4" /> Print
            </button>
          </div>
        </div>

        <div className="bg-white border p-4 mb-4 print:hidden">
          <div className="flex items-center justify-center gap-4">
            <div className="text-right">
              <div className="text-lg font-bold" style={{ color: team1.color }}>
                {team1.name || "Team 1"}
              </div>
              <div className="text-xs text-muted-foreground uppercase">{team1.shortCode}</div>
            </div>
            <div className="text-3xl font-black tabular-nums">
              {score1} – {score2}
            </div>
            <div>
              <div className="text-lg font-bold" style={{ color: team2.color }}>
                {team2.name || "Team 2"}
              </div>
              <div className="text-xs text-muted-foreground uppercase">{team2.shortCode}</div>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2">
            Each period is a separate court snapshot. Full-game totals stay in Box Score.
          </p>
        </div>

        {periods.map((period) => {
          const score = periodScore(log, period);
          const shots = courtShots(log, period);
          const dir = directionForHalf(halfDirections ?? { 1: team1Direction }, period, team1Direction);
          return (
            <section
              key={period}
              className="bg-white border p-4 mb-4 print:break-after-page print:break-inside-avoid"
            >
              <div className="flex items-end justify-between gap-3 mb-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Period snapshot
                  </div>
                  <h2 className="text-xl font-bold">{periodTitle(period, info.halves)}</h2>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black tabular-nums">
                    <span style={{ color: team1.color }}>{score.s1}</span>
                    <span className="text-muted-foreground"> – </span>
                    <span style={{ color: team2.color }}>{score.s2}</span>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {shots.length} shot marker{shots.length === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
              <div className="max-w-4xl mx-auto">
                <HandballCourt
                  className="w-full print:h-[42vh]"
                  shots={shots}
                  team1Color={team1.color}
                  team2Color={team2.color}
                  team1Direction={dir}
                />
              </div>
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 mt-3 text-xs">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ background: team1.color }} />
                  {team1.shortName || team1.name || "Team 1"}
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ background: team2.color }} />
                  {team2.shortName || team2.name || "Team 2"}
                </span>
                <span className="text-muted-foreground">● Goal · ✕ Miss · ◌ Saved</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <GKZonesPanel
                  teamName={team1.name || "Team 1"}
                  color={team1.color}
                  shotsFaced={log.filter((e) => Number(e.half) === period && e.team === 2)}
                />
                <GKZonesPanel
                  teamName={team2.name || "Team 2"}
                  color={team2.color}
                  shotsFaced={log.filter((e) => Number(e.half) === period && e.team === 1)}
                />
              </div>
            </section>
          );
        })}

        <AppFooter variant="light" className="mt-auto print:hidden" />
      </div>
    </div>
  );
}
