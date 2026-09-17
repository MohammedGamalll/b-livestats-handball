import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";

import { AppFooter } from "@/components/AppFooter";
import { GoalMouthMarks } from "@/components/GoalMouthMarks";
import { ReportLogo } from "@/components/ReportLogo";
import { matchReportSearch } from "@/lib/matchReportSearch";
import { useMatchReport } from "@/lib/useMatchReport";
import { useGameStore } from "@/lib/gameStore";
import { attributeGoalkeepers, eventHalf, type GkKeeperStats, type GkTeamReport } from "@/lib/gkAttribution";
import { periodTitle } from "@/lib/periods";

export const Route = createFileRoute("/gk-report")({
  validateSearch: matchReportSearch,
  component: GkReportPage,
});

function GkReportPage() {
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
  } = useMatchReport(matchId);
  const [hydrated, setHydrated] = useState(false);
  const [focus, setFocus] = useState<1 | 2>(1);

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

  const halves = info.halves || 2;
  const halfLength = info.halfLength || 30;
  const otLength = info.otLength || 5;
  const report1 = useMemo(
    () => attributeGoalkeepers(team1, log, 1, { halves, halfLength, otLength }),
    [team1, log, halves, halfLength, otLength],
  );
  const report2 = useMemo(
    () => attributeGoalkeepers(team2, log, 2, { halves, halfLength, otLength }),
    [team2, log, halves, halfLength, otLength],
  );
  const report = focus === 1 ? report1 : report2;

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
    <div className="min-h-screen flex flex-col bg-[oklch(0.97_0.005_260)] p-6 print:p-0 print:bg-white">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-4 no-print">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">GOALKEEPER</h1>
            <div className="text-xs text-muted-foreground">
              {info.competition} · {info.date} · {info.venue}
            </div>
          </div>
          <div className="flex justify-center"><ReportLogo /></div>
          <div className="flex items-center gap-2 justify-end">
            {archived ? (
              <Link to="/reports" className="h-9 px-3 bg-muted text-xs font-bold uppercase flex items-center">Back</Link>
            ) : (
              <Link to="/game" className="h-9 px-3 bg-muted text-xs font-bold uppercase flex items-center">Back</Link>
            )}
            <Link to="/stats" search={matchId ? { matchId } : undefined} className="h-9 px-3 bg-muted text-xs font-bold uppercase flex items-center">Box Score</Link>
            <Link to="/quarters" search={matchId ? { matchId } : undefined} className="h-9 px-3 bg-muted text-xs font-bold uppercase flex items-center">Quarters</Link>
            <button onClick={() => window.print()} className="h-9 px-3 bg-black text-white text-xs font-bold uppercase flex items-center gap-2">
              <Printer className="h-4 w-4" /> Print
            </button>
            <Link to="/home" className="h-9 px-3 bg-topbar text-white text-xs font-bold uppercase flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
          </div>
        </div>
        <div className="hidden print:flex justify-center mb-4"><ReportLogo /></div>

        <div className="bg-white border mb-5 p-4">
          <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Goalkeeper Report</div>
          <div className="text-xl font-bold mt-1">
            {team1.name || "Team 1"} {score1} – {score2} {team2.name || "Team 2"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {info.competition || "Match"}{info.date ? ` · ${info.date}` : ""}{archived ? "" : " · Live"}
          </div>
          <div className="mt-3 flex gap-2 no-print">
            <button
              type="button"
              onClick={() => setFocus(1)}
              className={`h-8 px-3 text-[10px] font-bold uppercase ${focus === 1 ? "text-white" : "bg-muted"}`}
              style={focus === 1 ? { background: team1.color } : undefined}
            >
              {team1.name || "Team 1"}
            </button>
            <button
              type="button"
              onClick={() => setFocus(2)}
              className={`h-8 px-3 text-[10px] font-bold uppercase ${focus === 2 ? "text-white" : "bg-muted"}`}
              style={focus === 2 ? { background: team2.color } : undefined}
            >
              {team2.name || "Team 2"}
            </button>
          </div>
        </div>

        <TeamGkBlock report={report} halves={halves} />

        <AppFooter variant="light" className="mt-auto print:hidden" />
      </div>
    </div>
  );
}

function TeamGkBlock({ report, halves }: { report: GkTeamReport; halves: number }) {
  const active = report.keepers.filter((k) => k.faced > 0 || k.seconds > 0 || k.periodsPlayed.length);
  const rows = active.length ? active : report.keepers;
  return (
    <div className="mb-8">
      <div className="px-3 py-2 text-white font-bold uppercase tracking-wider text-xs" style={{ background: report.teamColor }}>
        {report.teamName || "Team"}
      </div>
      <div className="bg-white border overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              {["#", "Player", "Saves", "GA", "Posts", "Faced", "Save %", "Share"].map((h) => (
                <th key={h} className="px-2 py-2 text-left font-bold uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t bg-muted/40 font-bold">
              <td className="px-2 py-2" colSpan={2}>Team total</td>
              <td className="px-2 py-2 tabular-nums">{report.teamSaves}</td>
              <td className="px-2 py-2 tabular-nums">{report.teamConceded}</td>
              <td className="px-2 py-2 tabular-nums">{report.teamPosts}</td>
              <td className="px-2 py-2 tabular-nums">{report.teamFaced}</td>
              <td className="px-2 py-2 tabular-nums">{Math.round(report.teamSavePct)}%</td>
              <td className="px-2 py-2">100%</td>
            </tr>
            {rows.map((k) => (
              <tr key={k.no} className="border-t">
                <td className="px-2 py-2 font-bold">{k.no}</td>
                <td className="px-2 py-2">{k.name || "—"}</td>
                <td className="px-2 py-2 tabular-nums font-bold">{k.saves}</td>
                <td className="px-2 py-2 tabular-nums">{k.conceded}</td>
                <td className="px-2 py-2 tabular-nums">{k.posts}</td>
                <td className="px-2 py-2 tabular-nums">{k.faced}</td>
                <td className="px-2 py-2 tabular-nums">{Math.round(k.savePct)}%</td>
                <td className="px-2 py-2 tabular-nums">{Math.round(k.shareOfTeamFaced)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.map((k) => (
        <KeeperMaps key={k.no} keeper={k} halves={halves} color={report.teamColor} />
      ))}
    </div>
  );
}

function KeeperMaps({ keeper, halves, color }: { keeper: GkKeeperStats; halves: number; color: string }) {
  const maxHalf = Math.max(halves, ...keeper.periodsPlayed, ...keeper.shotEvents.map((s) => eventHalf(s) ?? 0), 1);
  const periods = Array.from({ length: maxHalf }, (_, i) => i + 1);
  return (
    <div className="bg-white border border-t-0 p-4 mb-3">
      <div className="text-sm font-bold mb-3">#{keeper.no} {keeper.name}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {periods.map((period) => {
          const played = keeper.periodsPlayed.includes(period);
          const shots = keeper.shotEvents.filter((s) => Number(s.half) === period);
          const saves = shots.filter((s) => s.kind === "save").length;
          const goals = shots.filter((s) => s.kind === "goal").length;
          const posts = shots.filter((s) => s.kind === "post").length;
          return (
            <div key={period}>
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{periodTitle(period, halves)}</div>
                {played ? (
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {saves} saves · {goals} goals · {posts} posts
                  </div>
                ) : (
                  <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Did not play</div>
                )}
              </div>
              {played ? (
                <GoalMouthMarks shots={shots} color={color} />
              ) : (
                <div className="border bg-muted/30 min-h-[120px] flex items-center justify-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Did not play
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
