import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { listMatches } from "@/lib/db.functions";
import { ReportLogo } from "@/components/ReportLogo";
import { AppFooter } from "@/components/AppFooter";
import { MatchReportLinks } from "@/components/MatchReportLinks";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Match Reports — B LiveStats" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["matches"],
    queryFn: () => listMatches(),
  });

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.97_0.005_260)] p-6">
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-wide uppercase">Match Reports</h1>
            <p className="text-xs text-muted-foreground">Open Box Score and Quarters for a finished match</p>
          </div>
          <div className="flex justify-center"><ReportLogo /></div>
          <div className="flex items-center gap-2 justify-end">
            <Link to="/home" className="h-9 px-3 bg-topbar text-white text-xs font-bold uppercase flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white border p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : matches.length === 0 ? (
          <div className="bg-white border p-10 text-center">
            <div className="text-lg font-bold mb-2">No finished matches</div>
            <p className="text-sm text-muted-foreground">Finish a match to see its Box Score and Quarters here.</p>
          </div>
        ) : (
          <div className="bg-white border divide-y">
            {matches.map((m) => (
              <div key={m.id} className="px-3 py-3 grid grid-cols-[110px_1fr_auto] gap-3 items-center text-sm">
                <div className="text-xs text-muted-foreground">
                  <div>{m.date || new Date(m.finishedAt).toISOString().slice(0, 10)}</div>
                  {m.competition && (
                    <div className="text-[10px] uppercase tracking-wider font-semibold">{m.competition}</div>
                  )}
                </div>
                <div>
                  <div className="font-semibold">
                    {m.team1Name}{" "}
                    <span className="tabular-nums font-bold">
                      {m.score1} : {m.score2}
                    </span>{" "}
                    {m.team2Name}
                  </div>
                  {m.shootout1 != null && m.shootout2 != null && (
                    <div className="text-[10px] text-muted-foreground">pens {m.shootout1}-{m.shootout2}</div>
                  )}
                </div>
                <MatchReportLinks matchId={m.id} />
              </div>
            ))}
          </div>
        )}
        <AppFooter variant="light" className="mt-auto" />
      </div>
    </div>
  );
}
