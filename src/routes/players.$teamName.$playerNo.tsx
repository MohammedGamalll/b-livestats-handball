import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getPlayerReport, type GkShotEvent } from "@/lib/db.functions";
import { ReportLogo } from "@/components/ReportLogo";
import { AppFooter } from "@/components/AppFooter";
import { GoalMouthMarks } from "@/components/GoalMouthMarks";
import { ArrowLeft, Printer } from "lucide-react";
import { displayShotXY, isPenaltyShot } from "@/lib/court";
import { periodTitle } from "@/lib/periods";
import courtAsset from "@/assets/handball-court-purple.png";
import goalAsset from "@/assets/handball-goal-real.png";


const playerQueryOptions = (teamName: string, playerNo: string) => ({
  queryKey: ["player", teamName, playerNo] as const,
  queryFn: () => getPlayerReport({ data: { teamName, playerNo } }),
});

export const Route = createFileRoute("/players/$teamName/$playerNo")({
  beforeLoad: ({ params }) => {
    const t = decodeURIComponent(params.teamName).trim();
    const n = decodeURIComponent(params.playerNo).trim();
    if (t !== params.teamName || n !== params.playerNo) {
      throw redirect({ to: "/players/$teamName/$playerNo", params: { teamName: t, playerNo: n }, replace: true });
    }
  },
  loader: ({ context, params }) => {
    if (typeof window === "undefined" || !window.electronAPI) return null;
    return context.queryClient.ensureQueryData(playerQueryOptions(params.teamName, params.playerNo));
  },
  component: PlayerReportPage,
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center bg-white border p-6">
        <div className="text-lg font-bold mb-2">Couldn't load player report</div>
        <div className="text-xs text-muted-foreground mb-4">{String(error?.message || error)}</div>
        <Link to="/players" className="text-xs font-bold uppercase underline">← Back to players</Link>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center bg-white border p-6">
        <div className="text-lg font-bold mb-2">Player not found</div>
        <Link to="/players" className="text-xs font-bold uppercase underline">← Back to players</Link>
      </div>
    </div>
  ),
});

function StatBox({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-white border rounded p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums leading-none mt-1" style={accent ? { color: accent } : undefined}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function SectionHeader({ title, color, onPrint }: { title: string; color?: string; onPrint?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-2 no-print">
      <div className="px-3 py-1.5 text-white font-bold uppercase tracking-wider text-xs" style={{ background: color || "#111" }}>
        {title}
      </div>
      {onPrint && (
        <button onClick={onPrint} className="h-7 px-2 bg-black text-white text-[10px] font-bold uppercase flex items-center gap-1">
          <Printer className="h-3 w-3" /> Print
        </button>
      )}
    </div>
  );
}

function dotColor(a: string) {
  return a === "GOAL" || a === "7M" ? "#16a34a" : a === "SHOT SAVED" ? "#f59e0b" : "#dc2626";
}

function GoalDots({ shots }: { shots: Array<{ action: string; goalX?: number; goalY?: number }> }) {
  const marked = shots.filter((s) => s.goalX != null && s.goalY != null);
  return (
    <div className="relative">
      <img src={goalAsset} alt="goal" className="w-full h-auto block" draggable={false} />
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        {marked.map((e, i) => (
          <g key={`g-${i}`} transform={`translate(${(e.goalX ?? 0) * 100} ${(e.goalY ?? 0) * 100})`}>
            <circle r="3.6" fill={dotColor(e.action)} stroke="#fff" strokeWidth="0.5" />
            <text textAnchor="middle" dominantBaseline="central" fontSize="3.2" fontWeight="700" fill="#fff">{i + 1}</text>
          </g>
        ))}
      </svg>
      {marked.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-wider font-bold text-muted-foreground">No goal-mouth markers</div>
      )}
    </div>
  );
}

function PlayerReportPage() {
  const params = Route.useParams();
  const teamName = params.teamName;
  const playerNo = params.playerNo;
  
  const { data } = useSuspenseQuery(playerQueryOptions(teamName, playerNo));
  const isLoading = false;

  const [compFilter, setCompFilter] = useState<string>("ALL");
  const competitions = useMemo(() => {
    const set = new Set<string>();
    (data?.matches || []).forEach((m: any) => { if (m.competition) set.add(m.competition); });
    return Array.from(set).sort();
  }, [data]);

  const filteredMatches = useMemo(() => {
    if (!data) return [] as any[];
    if (compFilter === "ALL") return data.matches;
    return data.matches.filter((m: any) => (m.competition || "") === compFilter);
  }, [data, compFilter]);

  const allowedMatchIds = useMemo(() => new Set(filteredMatches.map((m: any) => m.matchId)), [filteredMatches]);

  const totals = useMemo(() => {
    const t = {
      played: 0, wins: 0, draws: 0, losses: 0,
      goals: 0, shots: 0, missed: 0, saved: 0,
      pen: 0, penAtt: 0, assists: 0, steals: 0, turnovers: 0, blocks: 0,
      yellow: 0, twoMin: 0, red: 0, shootingPct: 0,
    };
    filteredMatches.forEach((m: any) => {
      t.played++;
      if (m.result === "W") t.wins++;
      else if (m.result === "D") t.draws++;
      else if (m.result === "L") t.losses++;
      t.goals += m.goals || 0;
      t.shots += m.shots || 0;
      t.assists += m.assists || 0;
      t.steals += m.steals || 0;
      t.turnovers += m.turnovers || 0;
      t.blocks += m.blocks || 0;
      t.yellow += m.yellow || 0;
      t.twoMin += m.twoMin || 0;
      t.red += m.red || 0;
      t.pen += m.pen || 0;
      t.penAtt += m.penAtt || 0;
    });
    // Derive missed/saved from shotEvents scoped to filtered matches
    (data?.shotEvents || []).forEach((e: any) => {
      if (!allowedMatchIds.has(e.matchId)) return;
      if (e.action === "SHOT MISSED") t.missed++;
      else if (e.action === "SHOT SAVED") t.saved++;
    });
    t.shootingPct = t.shots > 0 ? (t.goals / t.shots) * 100 : 0;
    return t;
  }, [filteredMatches, allowedMatchIds, data]);

  const color = data?.teamColor || "#111";
  const isGK = Boolean(data?.isGK) || String(data?.position || "").toUpperCase().startsWith("GK");
  const gkTotals = useMemo(() => {
    let saves = 0;
    let conceded = 0;
    let posts = 0;
    let shareFaced = 0;
    let shareN = 0;
    filteredMatches.forEach((m: any) => {
      saves += m.gkSaves || 0;
      conceded += m.gkConceded || 0;
      posts += m.gkPosts || 0;
      if ((m.gkFaced || 0) > 0 || (m.gkSaves || 0) > 0) {
        shareFaced += m.gkShareFaced || 0;
        shareN++;
      }
    });
    const faced = saves + conceded;
    return {
      saves,
      conceded,
      posts,
      faced,
      savePct: faced > 0 ? (saves / faced) * 100 : 0,
      shareFaced: shareN ? shareFaced / shareN : 0,
    };
  }, [filteredMatches]);
  const gkShots = ((data?.gk?.shotEvents || []) as GkShotEvent[]).filter((e) => allowedMatchIds.has(e.matchId));
  const gkPeriods = useMemo(() => {
    let max = 2;
    filteredMatches.forEach((m: any) => {
      if ((m.halves || 2) > max) max = m.halves || 2;
    });
    gkShots.forEach((e) => {
      const h = Number(e.half);
      if (Number.isFinite(h) && h > max) max = h;
    });
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [filteredMatches, gkShots]);
  const filteredShotEvents = (data?.shotEvents || []).filter((e: any) => allowedMatchIds.has(e.matchId));
  const courtShots = filteredShotEvents
    .filter((e: any) => isPenaltyShot(e) || (e.x != null && e.y != null))
    .map((e: any, i: number) => ({ ...e, seq: i + 1 }));
  const goalShots = filteredShotEvents
    .filter((e: any) => e.goalX != null && e.goalY != null)
    .map((e: any, i: number) => ({ ...e, seq: i + 1 }));

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.97_0.005_260)] p-6 print:p-0 print:bg-white">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-4 no-print">
          <div>
            <Link to="/players" className="text-xs text-muted-foreground hover:underline">← Back to players</Link>
          </div>
          <div className="flex justify-center"><ReportLogo /></div>
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => window.print()} className="h-9 px-3 bg-black text-white text-xs font-bold uppercase flex items-center gap-2"><Printer className="h-4 w-4" /> Print</button>
            <Link to="/" className="h-9 px-3 bg-topbar text-white text-xs font-bold uppercase flex items-center gap-2"><ArrowLeft className="h-4 w-4" /> Home</Link>
          </div>
        </div>

        <div className="hidden print:flex justify-center mb-4"><ReportLogo /></div>

        {isLoading ? (
          <div className="bg-white border p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : !data ? (
          <div className="bg-white border p-10 text-center text-sm text-muted-foreground">Player not found.</div>
        ) : (
          <>
            {/* Header card */}
            <div className="bg-white border mb-5 overflow-hidden">
              <div className="h-2" style={{ background: color }} />
              <div className="p-5 flex items-center gap-5">
                <div className="h-24 w-24 rounded flex items-center justify-center text-white text-4xl font-bold shrink-0" style={{ background: color }}>
                  {data.no}
                </div>
                <div className="flex-1">
                  <div className="text-3xl font-bold leading-tight">{[data.name, data.surname].filter(Boolean).join(" ") || "—"}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    <span className="font-semibold" style={{ color }}>{data.teamName}</span>
                    {data.position && <> · {data.position}</>}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px] font-bold uppercase">
                    <span className="px-2 py-1 bg-muted rounded">{totals.played} Matches</span>
                    <span className="px-2 py-1 bg-green-600 text-white rounded">{totals.wins}W</span>
                    <span className="px-2 py-1 bg-gray-500 text-white rounded">{totals.draws}D</span>
                    <span className="px-2 py-1 bg-red-600 text-white rounded">{totals.losses}L</span>
                  </div>
                </div>
                {competitions.length > 0 && (
                  <div className="flex flex-col items-end gap-1 no-print">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Competition</label>
                    <select
                      value={compFilter}
                      onChange={(e) => setCompFilter(e.target.value)}
                      className="h-9 px-3 border rounded text-sm font-semibold bg-white min-w-[180px]"
                    >
                      <option value="ALL">All Competitions</option>
                      {competitions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {isGK && (
              <>
                <SectionHeader title={compFilter === "ALL" ? "Goalkeeper Totals" : `Goalkeeper — ${compFilter}`} color={color} />
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-6">
                  <StatBox label="Matches" value={totals.played} />
                  <StatBox label="Saves" value={gkTotals.saves} accent="#f59e0b" />
                  <StatBox label="Goals conceded" value={gkTotals.conceded} accent="#dc2626" />
                  <StatBox label="Save %" value={`${gkTotals.savePct.toFixed(1)}%`} />
                  <StatBox label="Shots faced" value={gkTotals.faced} />
                  <StatBox label="Share of team" value={`${Math.round(gkTotals.shareFaced)}%`} />
                </div>

                <SectionHeader title="Goal maps by period" color={color} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {gkPeriods.map((period) => {
                    const shots = gkShots.filter((e) => Number(e.half) === period);
                    const played = filteredMatches.some((m: any) => (m.gkPeriods || []).includes(period) || shots.some((s) => s.matchId === m.matchId));
                    const halves = filteredMatches[0]?.halves || 2;
                    return (
                      <div key={period} className="bg-white border p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-bold">{periodTitle(period, halves)}</div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {played
                              ? `${shots.filter((s) => s.action === "SHOT SAVED" || s.kind === "save").length} saves · ${shots.filter((s) => s.kind === "goal" || s.action === "GOAL" || s.action === "7M").length} conceded`
                              : "Did not play"}
                          </div>
                        </div>
                        {played ? <GoalMouthMarks shots={shots} /> : (
                          <div className="border bg-muted/30 min-h-[120px] flex items-center justify-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Did not play
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <SectionHeader title="Goal maps by match" color={color} />
                <div className="space-y-4 mb-6">
                  {filteredMatches.map((m: any) => {
                    const shots = gkShots.filter((e) => e.matchId === m.matchId);
                    const halves = m.halves || 2;
                    const maxHalf = Math.max(halves, ...shots.map((s) => Number(s.half) || 0), 1);
                    const periods = Array.from({ length: maxHalf }, (_, i) => i + 1);
                    return (
                      <div key={m.matchId} className="bg-white border p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="text-sm font-bold">{m.date} vs {m.opponent}</div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {m.ownScore}:{m.oppScore} · {m.gkSaves || 0} saves · {m.gkConceded || 0} conceded
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {periods.map((period) => {
                            const played = (m.gkPeriods || []).includes(period);
                            const periodShots = shots.filter((s) => Number(s.half) === period);
                            return (
                            <div key={period}>
                              <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                                {periodTitle(period, halves)}{played ? "" : " — Did not play"}
                              </div>
                              {played ? <GoalMouthMarks shots={periodShots} /> : (
                                <div className="border bg-muted/30 min-h-[100px] flex items-center justify-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                  Did not play
                                </div>
                              )}
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {filteredMatches.length === 0 && (
                    <div className="bg-white border p-6 text-center text-sm text-muted-foreground">No goalkeeper appearances recorded yet.</div>
                  )}
                </div>
              </>
            )}

            {/* Career Totals */}
            <SectionHeader title={compFilter === "ALL" ? (isGK ? "Field totals" : "Career Totals") : `Totals — ${compFilter}`} color={color} />
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-6">
              <StatBox label="Matches" value={totals.played} />
              <StatBox label="Goals" value={totals.goals} accent={color} />
              <StatBox label="Shots" value={totals.shots} />
              <StatBox label="Shooting %" value={`${totals.shootingPct.toFixed(1)}%`} />
              <StatBox label="7m" value={`${totals.pen}/${totals.penAtt}`} />
              <StatBox label="Assists" value={totals.assists} />
              <StatBox label="Steals" value={totals.steals} />
              <StatBox label="Turnovers" value={totals.turnovers} />
              <StatBox label="Blocks" value={totals.blocks} />
              <StatBox label="2-min" value={totals.twoMin} />
              <StatBox label="Yellow" value={totals.yellow} />
              <StatBox label="Red" value={totals.red} />
            </div>

            {/* Shooting breakdown */}
            <SectionHeader title="Shooting Breakdown" color={color} />
            <div className="bg-white border p-4 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                <StatBox label="Goals" value={totals.goals} accent="#16a34a" />
                <StatBox label="Missed" value={totals.missed} accent="#dc2626" />
                <StatBox label="Saved" value={totals.saved} accent="#f59e0b" />
                <StatBox label="7m Made/Att" value={`${totals.pen}/${totals.penAtt}`} />
                <StatBox label="Shooting %" value={`${totals.shootingPct.toFixed(1)}%`} />
              </div>
              {totals.shots > 0 && (
                <div className="w-full h-3 rounded overflow-hidden flex bg-muted">
                  <div style={{ width: `${(totals.goals / totals.shots) * 100}%`, background: "#16a34a" }} />
                  <div style={{ width: `${(totals.saved / totals.shots) * 100}%`, background: "#f59e0b" }} />
                  <div style={{ width: `${(totals.missed / totals.shots) * 100}%`, background: "#dc2626" }} />
                </div>
              )}
              <div className="flex items-center gap-4 mt-2 text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: "#16a34a" }} /> Goal</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: "#f59e0b" }} /> Saved</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: "#dc2626" }} /> Missed</span>
              </div>
            </div>

            {/* Shot Chart */}
            <SectionHeader title="Shot Chart (All Matches)" color={color} />
            <div className="bg-white border p-4 mb-6">
              {courtShots.length === 0 && goalShots.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-6">No shots recorded yet.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Court Placement</div>
                    <div className="relative">
                      <img src={courtAsset} alt="court" className="w-full h-auto block" draggable={false} />
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {courtShots.map((e: any) => {
                          const { x, y } = displayShotXY(e);
                          return (
                          <g key={`c-${e.seq}`} transform={`translate(${x * 100} ${y * 100})`}>
                            <circle r="2.8" fill={dotColor(e.action)} stroke="#fff" strokeWidth="0.4" />
                            <text textAnchor="middle" dominantBaseline="central" fontSize="2.6" fontWeight="700" fill="#fff">{e.seq}</text>
                          </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Goal Placement</div>
                    <div className="relative">
                      <img src={goalAsset} alt="goal" className="w-full h-auto block" draggable={false} />
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {goalShots.map((e: any) => (
                          <g key={`g-${e.seq}`} transform={`translate(${(e.goalX ?? 0) * 100} ${(e.goalY ?? 0) * 100})`}>
                            <circle r="3.6" fill={dotColor(e.action)} stroke="#fff" strokeWidth="0.5" />
                            <text textAnchor="middle" dominantBaseline="central" fontSize="3.2" fontWeight="700" fill="#fff">{e.seq}</text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Match by Match */}
            <SectionHeader title={`Match by Match (${filteredMatches.length})`} color={color} />
            <div className="bg-white border overflow-x-auto mb-6">
              <table className="w-full text-[11px] border-collapse min-w-[1200px]">
                <thead style={{ background: color }} className="text-white">
                  <tr>
                    {[
                      "Date","Comp","Opponent","Result","Pos",
                      ...(isGK ? ["Saves","GA","Save %","Faced","Share %"] : []),
                      "Goals","M/A","%",
                      "6m","9m","Wing","FB","BT","EG",
                      "7m M/A","7m %",
                      "AS","R7m","TO","ST","BS","P7m","RF",
                      "2m","YC","RC","BC"
                    ].map((h) => (
                      <th key={h} className="px-1.5 py-1.5 text-left font-bold uppercase tracking-wider text-[9px] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMatches.map((m: any, i: number) => {
                    const pct = m.shots > 0 ? (m.goals / m.shots) * 100 : 0;
                    const pen7Pct = m.penAtt > 0 ? Math.round((m.pen / m.penAtt) * 100) : "";
                    const fma = (g: number, a: number) => a ? `${g}/${a}` : "";
                    return (
                      <tr key={m.matchId} className={`border-t ${i % 2 ? "bg-muted/30" : ""}`}>
                        <td className="px-1.5 py-1 whitespace-nowrap">{m.date}</td>
                        <td className="px-1.5 py-1 whitespace-nowrap">{m.competition || "—"}</td>
                        <td className="px-1.5 py-1 font-semibold whitespace-nowrap">{m.opponent}</td>
                        <td className="px-1.5 py-1 tabular-nums whitespace-nowrap">
                          <span className={`inline-block w-4 h-4 leading-4 text-center text-white text-[9px] font-bold rounded mr-1 ${m.result === "W" ? "bg-green-600" : m.result === "L" ? "bg-red-600" : "bg-gray-500"}`}>{m.result}</span>
                          {m.ownScore}:{m.oppScore}
                        </td>
                        <td className="px-1.5 py-1 uppercase">{data.position || ""}</td>
                        {isGK && (
                          <>
                            <td className="px-1.5 py-1 tabular-nums font-bold" style={{ color: "#f59e0b" }}>{m.gkSaves || ""}</td>
                            <td className="px-1.5 py-1 tabular-nums">{m.gkConceded || ""}</td>
                            <td className="px-1.5 py-1 tabular-nums">
                              {(m.gkSaves || 0) + (m.gkConceded || 0) > 0
                                ? `${Math.round(((m.gkSaves || 0) / ((m.gkSaves || 0) + (m.gkConceded || 0))) * 100)}`
                                : ""}
                            </td>
                            <td className="px-1.5 py-1 tabular-nums">{m.gkFaced || ""}</td>
                            <td className="px-1.5 py-1 tabular-nums">
                              {m.gkFaced ? `${Math.round(m.gkShareFaced || 0)}` : ""}
                            </td>
                          </>
                        )}
                        <td className="px-1.5 py-1 tabular-nums font-bold" style={{ color }}>{m.goals || ""}</td>
                        <td className="px-1.5 py-1 tabular-nums">{m.shots ? `${m.goals}/${m.shots}` : ""}</td>
                        <td className="px-1.5 py-1 tabular-nums">{m.shots ? `${pct.toFixed(0)}` : ""}</td>
                        <td className="px-1.5 py-1 tabular-nums">{fma(m.z6m.g, m.z6m.a)}</td>
                        <td className="px-1.5 py-1 tabular-nums">{fma(m.z9m.g, m.z9m.a)}</td>
                        <td className="px-1.5 py-1 tabular-nums">{fma(m.zWing.g, m.zWing.a)}</td>
                        <td className="px-1.5 py-1 tabular-nums">{fma(m.zFB.g, m.zFB.a)}</td>
                        <td className="px-1.5 py-1 tabular-nums">{fma(m.bt.g, m.bt.a)}</td>
                        <td className="px-1.5 py-1 tabular-nums">{fma(m.eg.g, m.eg.a)}</td>
                        <td className="px-1.5 py-1 tabular-nums">{fma(m.pen, m.penAtt)}</td>
                        <td className="px-1.5 py-1 tabular-nums">{pen7Pct}</td>
                        <td className="px-1.5 py-1 tabular-nums">{m.assists || ""}</td>
                        <td className="px-1.5 py-1 tabular-nums">{m.r7m || ""}</td>
                        <td className="px-1.5 py-1 tabular-nums">{m.turnovers || ""}</td>
                        <td className="px-1.5 py-1 tabular-nums">{m.steals || ""}</td>
                        <td className="px-1.5 py-1 tabular-nums">{m.blocks || ""}</td>
                        <td className="px-1.5 py-1 tabular-nums">{m.p7m || ""}</td>
                        <td className="px-1.5 py-1 tabular-nums">{m.rf || ""}</td>
                        <td className="px-1.5 py-1 tabular-nums">{m.twoMin || ""}</td>
                        <td className="px-1.5 py-1 tabular-nums">{m.yellow || ""}</td>
                        <td className="px-1.5 py-1 tabular-nums">{m.red || ""}</td>
                        <td className="px-1.5 py-1 tabular-nums">{m.blue || ""}</td>
                      </tr>
                    );
                  })}
                  {filteredMatches.length === 0 && (
                    <tr><td colSpan={isGK ? 30 : 27} className="px-3 py-6 text-center text-sm text-muted-foreground">No match appearances recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
        <AppFooter variant="light" className="mt-auto" />
      </div>
    </div>
  );
}
