import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { listSeasonTeams, getSeasonBoxScore, type SeasonPlayerRow } from "@/lib/db.functions";
import { ReportLogo } from "@/components/ReportLogo";
import { AppFooter } from "@/components/AppFooter";
import { ArrowLeft, Printer } from "lucide-react";
import { displayShotXY, isPenaltyShot } from "@/lib/court";
import { MatchReportLinks } from "@/components/MatchReportLinks";
import courtAsset from "@/assets/handball-court-purple.png";
import goalAsset from "@/assets/handball-goal-real.png";

export const Route = createFileRoute("/season")({
  head: () => ({ meta: [{ title: "Season Box Score — B LiveStats" }] }),
  component: SeasonPage,
});

const ma = (m: { g: number; a: number }) => `${m.g}/${m.a}`;
const pct = (m: { g: number; a: number }) =>
  m.a > 0 ? Math.round((m.g / m.a) * 100) + "%" : "—";

function dotColor(a: string) {
  return a === "GOAL" || a === "7M" ? "#16a34a" : a === "SHOT SAVED" ? "#f59e0b" : "#dc2626";
}

function SeasonPage() {
  const teamsQ = useQuery({ queryKey: ["season", "teams"], queryFn: () => listSeasonTeams() });
  const [selected, setSelected] = useState<string>("");

  const teamList = teamsQ.data || [];
  const active = selected || teamList[0]?.name || "";
  const seasonQ = useQuery({
    queryKey: ["season", active],
    queryFn: () => getSeasonBoxScore({ data: { teamName: active } }),
    enabled: !!active,
  });

  const season = seasonQ.data;

  const shots = useMemo(() => {
    if (!season) return [] as NonNullable<typeof season>["shotEvents"];
    return season.shotEvents;
  }, [season]);

  const doPrint = () => window.print();

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.97_0.005_260)] p-6 print:p-0 print:bg-white">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-4 no-print">
          <div>
            <h1 className="text-2xl font-bold tracking-wide uppercase">Season Box Score</h1>
            <p className="text-xs text-muted-foreground">All matches aggregated for the selected team</p>
          </div>
          <div className="flex justify-center"><ReportLogo /></div>
          <div className="flex items-center gap-2 justify-end">
            <Link to="/home" className="h-9 px-3 bg-topbar text-white text-xs font-bold uppercase flex items-center gap-2"><ArrowLeft className="h-4 w-4" /> Home</Link>
            <button onClick={doPrint} className="h-9 px-3 bg-black text-white text-xs font-bold uppercase flex items-center gap-2"><Printer className="h-4 w-4" /> Print</button>
          </div>
        </div>

        <div className="bg-white border p-3 mb-4 flex flex-wrap items-center gap-3 no-print">
          <label className="text-xs font-bold uppercase tracking-wider">Team</label>
          <select
            value={active}
            onChange={(e) => setSelected(e.target.value)}
            className="h-9 px-3 border rounded-md text-sm bg-white min-w-[240px]"
          >
            {teamList.length === 0 && <option value="">No teams yet</option>}
            {teamList.map((t) => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>
          {season && (
            <div className="ml-auto flex items-center gap-4 text-xs">
              <span><strong>{season.matchesCount}</strong> matches</span>
              <span><span className="text-green-700 font-bold">{season.wins}W</span> · <span className="text-yellow-700 font-bold">{season.draws}D</span> · <span className="text-red-700 font-bold">{season.losses}L</span></span>
              <span>GF <strong>{season.goalsFor}</strong> · GA <strong>{season.goalsAgainst}</strong></span>
            </div>
          )}
        </div>

        {!active ? (
          <div className="bg-white border p-10 text-center text-sm text-muted-foreground">Save at least one match to see the season box score.</div>
        ) : seasonQ.isLoading ? (
          <div className="bg-white border p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : !season ? (
          <div className="bg-white border p-10 text-center text-sm text-muted-foreground">No data.</div>
        ) : (
          <>
            {/* Header banner */}
            <div className="bg-white border mb-4 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-block w-3 h-10" style={{ background: season.teamColor }} />
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Team</div>
                  <div className="text-2xl font-bold">{season.teamName}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Season Totals</div>
                <div className="text-2xl font-bold tabular-nums">{season.goalsFor} : {season.goalsAgainst}</div>
              </div>
            </div>

            {/* Player table */}
            <div className="bg-white border overflow-x-auto mb-4">
              <div className="px-3 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider">Players — Season Totals</div>
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    {["#","Player","Pos","GP","G","M/A","%","6m","9m","Wing","FB","BT","EG","7m M/A","7m %","AS","TO","ST","BS","2m","YC","RC","RF","R7m","P7m"].map((h)=>(
                      <th key={h} className="px-2 py-1.5 text-left font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {season.players.map((r) => (
                    <PlayerRow key={r.no} r={r} />
                  ))}
                  <PlayerRow r={season.totals} isTotals />
                </tbody>
              </table>
            </div>

            {/* Aggregate shot maps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-white border p-3">
                <div className="text-xs font-bold uppercase tracking-wider mb-2">Court — All Shots</div>
                <div className="relative w-full" style={{ aspectRatio: "2 / 1" }}>
                  <img src={courtAsset} alt="" className="absolute inset-0 w-full h-full object-contain" />
                  {shots.map((s: (typeof shots)[number], i: number) => {
                    const pen = isPenaltyShot({ action: s.action, subtype: s.subtype });
                    const xy = displayShotXY({ x: s.x, y: s.y, team: 1, action: s.action, subtype: s.subtype }, "left");
                    if (!xy || (!pen && (s.x == null || s.y == null))) return null;
                    return (
                      <span key={i} className="absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 border border-white/80"
                        style={{ left: `${xy.x * 100}%`, top: `${xy.y * 100}%`, background: dotColor(s.action) }} />
                    );
                  })}
                </div>
              </div>
              <div className="bg-white border p-3">
                <div className="text-xs font-bold uppercase tracking-wider mb-2">Goal Placement — All Shots</div>
                <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
                  <img src={goalAsset} alt="" className="absolute inset-0 w-full h-full object-contain" />
                  {shots.map((s: (typeof shots)[number], i: number) => {
                    if (s.goalX == null || s.goalY == null) return null;
                    return (
                      <span key={i} className="absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 border border-white/80"
                        style={{ left: `${s.goalX * 100}%`, top: `${s.goalY * 100}%`, background: dotColor(s.action) }} />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Match list */}
            <div className="bg-white border mb-4">
              <div className="px-3 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider">Match History</div>
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-bold uppercase tracking-wider">Date</th>
                    <th className="px-3 py-1.5 text-left font-bold uppercase tracking-wider">Competition</th>
                    <th className="px-3 py-1.5 text-left font-bold uppercase tracking-wider">Opponent</th>
                    <th className="px-3 py-1.5 text-center font-bold uppercase tracking-wider">Score</th>
                    <th className="px-3 py-1.5 text-center font-bold uppercase tracking-wider">Result</th>
                    <th className="px-3 py-1.5 text-right font-bold uppercase tracking-wider no-print">Report</th>
                  </tr>
                </thead>
                <tbody>
                  {season.matches.map((m) => (
                    <tr key={m.matchId} className="border-t">
                      <td className="px-3 py-1.5">{m.date}</td>
                      <td className="px-3 py-1.5">{m.competition || "—"}</td>
                      <td className="px-3 py-1.5">{m.opponent}</td>
                     <td className="px-3 py-1.5 text-center tabular-nums font-bold">
                       {m.ownScore} : {m.oppScore}
                       {m.ownShootout != null && m.oppShootout != null && (
                         <div className="text-[10px] font-normal text-muted-foreground">pens {m.ownShootout}-{m.oppShootout}</div>
                       )}
                     </td>

                      <td className="px-3 py-1.5 text-center font-bold" style={{ color: m.result === "W" ? "#16a34a" : m.result === "L" ? "#dc2626" : "#a16207" }}>{m.result}</td>
                      <td className="px-3 py-1.5 text-right no-print">
                        <MatchReportLinks matchId={m.matchId} />
                      </td>
                    </tr>
                  ))}
                  {season.matches.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">No matches yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        <AppFooter variant="light" className="mt-auto" />
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4 landscape; margin: 6mm; }
          body { background: #fff; }
        }
      `}</style>
    </div>
  );
}

function PlayerRow({ r, isTotals }: { r: SeasonPlayerRow; isTotals?: boolean }) {
  const shotMA = { g: r.goals, a: r.shots };
  return (
    <tr className={`border-t ${isTotals ? "bg-muted font-bold" : "hover:bg-muted/50"}`}>
      <td className="px-2 py-1 tabular-nums font-bold">{r.no || (isTotals ? "" : "—")}</td>
      <td className="px-2 py-1">{isTotals ? "TOTALS" : `${r.name} ${r.surname}`.trim() || "—"}</td>
      <td className="px-2 py-1 text-muted-foreground">{r.position || "—"}</td>
      <td className="px-2 py-1 tabular-nums">{r.played}</td>
      <td className="px-2 py-1 tabular-nums font-semibold">{r.goals}</td>
      <td className="px-2 py-1 tabular-nums">{ma(shotMA)}</td>
      <td className="px-2 py-1 tabular-nums">{pct(shotMA)}</td>
      <td className="px-2 py-1 tabular-nums">{ma(r.z6m)}</td>
      <td className="px-2 py-1 tabular-nums">{ma(r.z9m)}</td>
      <td className="px-2 py-1 tabular-nums">{ma(r.zWing)}</td>
      <td className="px-2 py-1 tabular-nums">{ma(r.zFB)}</td>
      <td className="px-2 py-1 tabular-nums">{ma(r.bt)}</td>
      <td className="px-2 py-1 tabular-nums">{ma(r.eg)}</td>
      <td className="px-2 py-1 tabular-nums">{`${r.pen}/${r.penAtt}`}</td>
      <td className="px-2 py-1 tabular-nums">{r.penAtt > 0 ? Math.round((r.pen / r.penAtt) * 100) + "%" : "—"}</td>
      <td className="px-2 py-1 tabular-nums">{r.assists}</td>
      <td className="px-2 py-1 tabular-nums">{r.turnovers}</td>
      <td className="px-2 py-1 tabular-nums">{r.steals}</td>
      <td className="px-2 py-1 tabular-nums">{r.blocks}</td>
      <td className="px-2 py-1 tabular-nums">{r.twoMin}</td>
      <td className="px-2 py-1 tabular-nums">{r.yellow}</td>
      <td className="px-2 py-1 tabular-nums">{r.red}</td>
      <td className="px-2 py-1 tabular-nums">{r.rf}</td>
      <td className="px-2 py-1 tabular-nums">{r.r7m}</td>
      <td className="px-2 py-1 tabular-nums">{r.p7m}</td>
    </tr>
  );
}
