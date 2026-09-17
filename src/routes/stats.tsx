import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { type LogEntry, type TeamSetup } from "@/lib/gameStore";
import { ReportLogo } from "@/components/ReportLogo";
import { AppFooter } from "@/components/AppFooter";

import courtAsset from "@/assets/handball-court-purple.png";
import goalAsset from "@/assets/handball-goal-real.png";
import fedLogoAsset from "@/assets/ihf-logo.jpeg";
import bLiveStatsLogoAsset from "@/assets/b-live-stats-logo.png";
import {
  buildBoxScore,
  buildTeamTotals,
  buildGoalkeeperStats,
  gkSavePct,
  downloadCsv,
} from "@/lib/exportCsv";
import { classifyShotZoneOrOverride, displayShotXY, isPenaltyShot, isFastBreak } from "@/lib/court";
import { HandballCourt } from "@/components/HandballCourt";
import { FileSpreadsheet, Printer } from "lucide-react";
import { matchReportSearch } from "@/lib/matchReportSearch";
import { useMatchReport } from "@/lib/useMatchReport";
import { GKZonesPanel } from "@/components/GKZonesPanel";

export const Route = createFileRoute("/stats")({
  validateSearch: matchReportSearch,
  component: StatsPage,
});

const WIDE_SECTIONS = new Set([
  "sec-ihf-t1",
  "sec-ihf-t2",
  "sec-strength",
]);

function buildPrintHtml(nodes: HTMLElement[]): string {
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((el) => el.outerHTML)
    .join("");
  // Expand each printed node: if it contains data-print-unit descendants, emit
  // one page per unit; otherwise emit the whole node as a single page.
  const pages: HTMLElement[] = [];
  for (const n of nodes) {
    const units = Array.from(n.querySelectorAll<HTMLElement>("[data-print-unit]"));
    if (units.length > 0) pages.push(...units);
    else pages.push(n);
  }
  const inner = pages
    .map((n, i) => {
      const brk = i < pages.length - 1 ? "break-after:page;page-break-after:always;" : "";
      return `<section class="print-page" style="${brk}"><div class="print-scale">${n.outerHTML}</div></section>`;
    })
    .join("");
  const extra = `
    <style>
      @page { size: A4 landscape; margin: 4mm }
      html, body { margin: 0; background:#fff; font-family:system-ui }
      body { padding: 4px }
      .overflow-x-auto, [class*="overflow-x"] { overflow: visible !important; }
      table { width: 100% !important; table-layout: auto; border-collapse: collapse; }
      section.print-page { break-inside: avoid; page-break-inside: avoid; }
      .print-scale { transform-origin: top left; }
      section.print-page [class*="break-after-page"],
      section.print-page [style*="break-after"] { break-after: auto !important; page-break-after: auto !important; }
    </style>`;
  return `<!doctype html><html><head><meta charset="utf-8"/>${styles}${extra}</head><body>${inner}</body></html>`;
}

function printSectionsByIds(ids: string[]) {
  const nodes = ids
    .map((id) => document.getElementById(id))
    .filter((n): n is HTMLElement => !!n);
  if (nodes.length === 0) return;
  const w = window.open("", "_blank", "width=1200,height=900");
  if (!w) return;
  w.document.write(buildPrintHtml(nodes));
  w.document.close();
  let done = false;
  const fit = () => {
    if (done) return;
    done = true;
    try {
      const doc = w.document;
      // A4 landscape @96dpi ≈ 1123×794, minus 4mm margins (~15px each)
      const pageW = 1123 - 30;
      const pageH = 794 - 30;
      doc.querySelectorAll<HTMLElement>(".print-scale").forEach((el) => {
        el.style.transform = "none";
        const w0 = el.scrollWidth || el.getBoundingClientRect().width;
        const h0 = el.scrollHeight || el.getBoundingClientRect().height;
        if (!w0 || !h0) return;
        const scale = Math.min(pageW / w0, pageH / h0, 1);
        el.style.transform = `scale(${scale})`;
        el.style.width = `${w0}px`;
        const parent = el.parentElement as HTMLElement | null;
        if (parent) {
          parent.style.width = `${w0 * scale}px`;
          parent.style.height = `${h0 * scale}px`;
          parent.style.overflow = "hidden";
        }
      });
    } catch {}
    w.focus();
    w.print();
  };
  w.addEventListener("load", () => setTimeout(fit, 600));
  setTimeout(fit, 1200);
}

function printSectionById(id: string) {
  printSectionsByIds([id]);
}

function SectionPrint({ id, label = "Print Section" }: { id: string; label?: string }) {
  return (
    <div className="print:hidden flex justify-end mb-1">
      <button
        onClick={() => printSectionById(id)}
        className="h-7 px-2 bg-topbar text-white text-[10px] font-bold uppercase flex items-center gap-1 rounded"
      >
        <Printer className="h-3 w-3" /> {label}
      </button>
    </div>
  );
}

const SECTION_LIST: { id: string; label: string }[] = [
  { id: "sec-ihf-t1", label: "IHF · Team 1" },
  { id: "sec-ihf-t2", label: "IHF · Team 2" },
  { id: "sec-compare", label: "Team Comparison" },
  { id: "sec-shot-locations", label: "Shot Locations" },
  { id: "sec-gk", label: "Goalkeepers & Shot Zones" },
  { id: "sec-visuals", label: "Shot Chart & Player Analysis" },
  { id: "sec-shots-by-position-t1", label: "Shots by Position · T1" },
  { id: "sec-shots-by-position-t2", label: "Shots by Position · T2" },
  { id: "sec-strength", label: "Strength Situation" },
  { id: "sec-shootout", label: "Shootout" },
];

function PrintToolbar() {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const selectAll = () => setSelected(Object.fromEntries(SECTION_LIST.map((s) => [s.id, true])));
  const clear = () => setSelected({});
  const chosen = SECTION_LIST.filter((s) => selected[s.id]).map((s) => s.id);
  return (
    <div className="print:hidden bg-white border rounded p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Print Sections</div>
        <div className="flex items-center gap-2">
          <button onClick={selectAll} className="h-7 px-2 bg-muted text-[10px] font-bold uppercase rounded">Select all</button>
          <button onClick={clear} className="h-7 px-2 bg-muted text-[10px] font-bold uppercase rounded">Clear</button>
          <button
            onClick={() => chosen.length && printSectionsByIds(chosen)}
            disabled={chosen.length === 0}
            className="h-7 px-3 bg-topbar text-white text-[10px] font-bold uppercase rounded flex items-center gap-1 disabled:opacity-40"
          >
            <Printer className="h-3 w-3" /> Print selected ({chosen.length})
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1">
        {SECTION_LIST.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={!!selected[s.id]} onChange={() => toggle(s.id)} />
            <span>{s.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}


function StatsPage() {
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
    team1Direction,
    timeouts1,
    timeouts2,
    shootoutRounds,
  } = useMatchReport(matchId);
  const [hydrated, setHydrated] = useState(false);

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

  const stats1 = buildBoxScore(log, team1, 1);
  const stats2 = buildBoxScore(log, team2, 2);
  const totals1 = buildTeamTotals(log, 1, timeouts1);
  const totals2 = buildTeamTotals(log, 2, timeouts2);
  const gk1 = buildGoalkeeperStats(log, team1, 1, { halves: info.halves, halfLength: info.halfLength, otLength: info.otLength });
  const gk2 = buildGoalkeeperStats(log, team2, 2, { halves: info.halves, halfLength: info.halfLength, otLength: info.otLength });

  // Rebounds per team — attribute by reboundTeam (who actually grabbed the ball).
  // OR = grabbing team is the same as the shooting team (own miss recovered)
  // DR = grabbing team is opposite to the shooting team
  const rebounds = (teamN: 1 | 2) => {
    let off = 0, def = 0;
    log.forEach((e) => {
      if (!e.reboundNo || !e.reboundTeam) return;
      if (e.reboundTeam !== teamN) return;
      if (e.team === teamN) off++;
      else def++;
    });
    return { off, def, total: off + def };
  };
  const reb1 = rebounds(1);
  const reb2 = rebounds(2);
  const blue1 = log.filter((e) => e.team === 1 && e.action === "BLUE").length;
  const blue2 = log.filter((e) => e.team === 2 && e.action === "BLUE").length;
  const gkSum = (gks: ReturnType<typeof buildGoalkeeperStats>) => {
    const saves = gks.reduce((a, g) => a + g.saves, 0);
    const conceded = gks.reduce((a, g) => a + g.goalsConceded, 0);
    const faced = saves + conceded;
    const pct = faced ? Math.round((saves / faced) * 100) : 0;
    return { saves, conceded, pct };
  };
  const gkT1 = gkSum(gk1);
  const gkT2 = gkSum(gk2);

  // Shot zone counts per team. Geographic zones (6m/9m/Wing/7m) come from
  // classifyZone. FB is a parallel counter based on the fast-break flag —
  // a fast-break shot is counted BOTH in its geographic zone and in FB.
  const zoneCount = (teamN: 1 | 2, zone: "6m" | "9m" | "Wing" | "7m") => {
    return log.filter((e) => {
      if (e.team !== teamN) return false;
      if ((e.subtype === "BREAK THROUGH" || e.subtype === "EMPTY GOAL") && zone !== "7m") return false;
      const z = classifyZone(e);
      return z === zone;
    }).length;
  };
  const subCount = (teamN: 1 | 2, sub: string) =>
    log.filter((e) => e.team === teamN && e.subtype === sub &&
      (e.action === "GOAL" || e.action === "SHOT MISSED" || e.action === "SHOT SAVED" || e.action === "7M")).length;
  const fbCount = (teamN: 1 | 2) =>
    log.filter((e) => e.team === teamN && e.fastBreak === true &&
      (e.action === "GOAL" || e.action === "SHOT MISSED" || e.action === "SHOT SAVED")).length;
  const z1 = { "6m": zoneCount(1, "6m"), "9m": zoneCount(1, "9m"), Wing: zoneCount(1, "Wing"), "7m": zoneCount(1, "7m") };
  const z2 = { "6m": zoneCount(2, "6m"), "9m": zoneCount(2, "9m"), Wing: zoneCount(2, "Wing"), "7m": zoneCount(2, "7m") };
  const fb1 = fbCount(1), fb2 = fbCount(2);
  const bt1 = subCount(1, "BREAK THROUGH"), bt2 = subCount(2, "BREAK THROUGH");
  const eg1 = subCount(1, "EMPTY GOAL"), eg2 = subCount(2, "EMPTY GOAL");

  const exportTeamCsv = (teamName: string, stats: ReturnType<typeof buildBoxScore>) => {
    const groupRow = ["", "Players", "", "", "Shots", "", "", "", "", "", "", "7m", "", "Offence", "", "", "Defence", "", "", "", "WIN", "", "", "Penalties Due", "", "", ""];
    const headerRow = ["No","Name","Pos","Goals","M/A","%","6m","9m","Wing","FB","7m M/A","7m %","AS","R7m","TO","ST","BS","P7m","RF","DF","OF","TOT","2m","YC","RC","BC"];
    const rows: (string | number)[][] = [groupRow, headerRow];
    stats.forEach((s) => {
      const pct = s.shots ? `${Math.round((s.goals / s.shots) * 100)}%` : "-";
      rows.push([
        s.no, s.name, "", s.goals, `${s.goals}/${s.shots}`, pct,
        "", "", "", "",
        `${s.pen}/${s.pen}`, s.pen ? "100%" : "-",
        s.assists, "", s.turnovers,
        s.steals, s.blocks, "", s.fouls,
        "", "", "",
        s.twoMin, s.yellow, s.red, "",
      ]);
    });
    downloadCsv(`${teamName}-boxscore.csv`, rows);
  };


  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.97_0.005_260)] p-6 print:p-2">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">BOX SCORE</h1>
            <div className="text-xs text-muted-foreground">{info.competition} · {info.date} · {info.venue}</div>
          </div>
          <div className="flex justify-center"><ReportLogo size="lg" /></div>
          <div className="flex items-center gap-2 justify-end">
            {archived ? (
              <Link to="/reports" className="h-9 px-3 bg-muted text-xs font-bold uppercase flex items-center">Back</Link>
            ) : (
              <Link to="/game" className="h-9 px-3 bg-muted text-xs font-bold uppercase flex items-center">Back</Link>
            )}
            <Link
              to="/quarters"
              search={matchId ? { matchId } : undefined}
              className="h-9 px-3 bg-muted text-xs font-bold uppercase flex items-center"
            >
              Quarters
            </Link>
            <button onClick={() => window.print()} className="h-9 px-3 bg-topbar text-white text-xs font-bold uppercase flex items-center gap-2"><Printer className="h-4 w-4" /> Print</button>
            <button onClick={() => exportTeamCsv(team1.shortCode || "team1", stats1)} className="h-9 px-3 bg-tab-done text-white text-xs font-bold uppercase flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> {team1.shortCode || "T1"}</button>
            <button onClick={() => exportTeamCsv(team2.shortCode || "team2", stats2)} className="h-9 px-3 bg-tab-done text-white text-xs font-bold uppercase flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> {team2.shortCode || "T2"}</button>
          </div>
        </div>

        <PrintToolbar />







        {/* IHF-STYLE OFFICIAL MATCH STATISTICS — one team per printed page */}
        {([1, 2] as const).map((tn) => {
          const t = tn === 1 ? team1 : team2;
          const s = tn === 1 ? stats1 : stats2;
          const sid = `sec-ihf-t${tn}`;
          return (
            <div key={sid}>
              <SectionPrint id={sid} />
              <div id={sid} className="bg-white border border-black p-4 mb-4 print:break-after-page">
                {/* Header row */}
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-neutral-300 pb-3">
                  <div className="w-24 h-24 flex items-center justify-center"><img src={fedLogoAsset} alt="Logo" className="w-full h-full object-contain" /></div>
                  <div className="text-center">
                    <div className="font-bold text-base leading-tight">{info.competition || "—"}</div>
                    <div className="text-xs text-neutral-600 mt-1">{info.gameType || "Match"}</div>
                  </div>
                  <div className="w-[136px] h-[136px] flex items-center justify-center">
                    <img src={bLiveStatsLogoAsset} alt="B LiveStats logo" className="w-full h-full object-contain" />
                  </div>
                </div>

                {/* Match info */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4 mt-3 text-[11px]">
                  <div>
                    <div className="font-bold">Match Team Statistics</div>
                    <div>Match No. <span className="font-semibold">{info.gameNumber || "—"}</span></div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">
                      {(team1.name || "Team 1")} <span className="tabular-nums">{score1} - {score2}</span> {(team2.name || "Team 2")}
                    </div>
                    <div className="text-[11px] text-neutral-600">
                      {(() => {
                        const half = (n: 1 | 2, h: number) =>
                          log.filter((e) => e.team === n && e.half === h && (e.action === "GOAL" || e.action === "7M")).length;
                        const parts: string[] = [`(${half(1, 1)} - ${half(2, 1)})`];
                        if (info.halves > 1) parts.push(`(${half(1, 2)} - ${half(2, 2)})`);
                        return parts.join(" ");
                      })()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div>{info.date} {info.time && <>· {info.time}</>}</div>
                    {info.spectators && <div>Attendance: {info.spectators}</div>}
                    <div>{[info.venue, info.city].filter(Boolean).join(", ")}</div>
                  </div>
                </div>

                {/* Referees */}
                <div className="text-[11px] mt-2 pb-2 border-b border-neutral-300">
                  <span className="font-bold">Referees: </span>
                  {info.officials
                    .filter((o) => /referee/i.test(o.role))
                    .map((o) => `${o.name} ${o.surname}${o.country ? ` (${o.country})` : ""}`)
                    .join(" / ") || "—"}
                </div>

                {/* One team table per page */}
                <div className="mt-4 print:break-inside-avoid">
                  <TeamTable name={t.name || `Team ${tn}`} color={t.color} team={t} stats={s} log={log} teamN={tn} />
                </div>
              </div>
            </div>
          );
        })}



        <SectionPrint id="sec-compare" />
        <div id="sec-compare" className="bg-white border mb-4 print:break-after-page print:break-inside-avoid">
          {/* Score header (merged into Team Comparison) */}
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-12" style={{ background: team1.color }} />
              <div>
                <div className="text-lg font-bold">{team1.name || "Team 1"}</div>
                <div className="text-xs text-muted-foreground uppercase">{team1.shortCode}</div>
              </div>
            </div>
            <div className="text-5xl font-bold tabular-nums">{score1} : {score2}</div>
            <div className="flex items-center gap-3">
              <div>
                <div className="text-lg font-bold text-right">{team2.name || "Team 2"}</div>
                <div className="text-xs text-muted-foreground uppercase text-right">{team2.shortCode}</div>
              </div>
              <div className="w-3 h-12" style={{ background: team2.color }} />
            </div>
          </div>

          <div className="p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Team Comparison</div>
          <div className="space-y-2">

            <CompareRow label="Goals" a={totals1.goals} b={totals2.goals} ca={team1.color} cb={team2.color} />
            <CompareRow label="Shots" a={totals1.shots} b={totals2.shots} ca={team1.color} cb={team2.color} />
            <CompareRow label="Shot %" a={Math.round(totals1.shotPct)} b={Math.round(totals2.shotPct)} suffix="%" ca={team1.color} cb={team2.color} />
            <CompareRow label="6m" a={z1["6m"]} b={z2["6m"]} ca={team1.color} cb={team2.color} />
            <CompareRow label={`7m (${totals1.pen}/${totals1.penAtt} · ${totals2.pen}/${totals2.penAtt})`} a={totals1.pen} b={totals2.pen} ca={team1.color} cb={team2.color} />
            <CompareRow label="9m" a={z1["9m"]} b={z2["9m"]} ca={team1.color} cb={team2.color} />
            <CompareRow label="Wing" a={z1.Wing} b={z2.Wing} ca={team1.color} cb={team2.color} />
            <CompareRow label="Fast Break" a={fb1} b={fb2} ca={team1.color} cb={team2.color} />
            <CompareRow label="Break Through" a={bt1} b={bt2} ca={team1.color} cb={team2.color} />
            <CompareRow label="Empty Goal" a={eg1} b={eg2} ca={team1.color} cb={team2.color} />
            <CompareRow label="Assists" a={totals1.assists} b={totals2.assists} ca={team1.color} cb={team2.color} />
            <CompareRow label="Steals" a={totals1.steals} b={totals2.steals} ca={team1.color} cb={team2.color} />
            <CompareRow label="Turnovers" a={totals1.turnovers} b={totals2.turnovers} ca={team1.color} cb={team2.color} reverse />
            <CompareRow label="Blocks" a={totals1.blocks} b={totals2.blocks} ca={team1.color} cb={team2.color} />
            <CompareRow label="WIN" a={reb1.total} b={reb2.total} ca={team1.color} cb={team2.color} />
            <CompareRow label="Off. WIN" a={reb1.off} b={reb2.off} ca={team1.color} cb={team2.color} />
            <CompareRow label="Def. WIN" a={reb1.def} b={reb2.def} ca={team1.color} cb={team2.color} />
            <CompareRow label="2-min" a={totals1.twoMin} b={totals2.twoMin} ca={team1.color} cb={team2.color} reverse />
            <CompareRow label="Yellow Cards" a={totals1.yellow} b={totals2.yellow} ca={team1.color} cb={team2.color} reverse />
            <CompareRow label="Red Cards" a={totals1.red} b={totals2.red} ca={team1.color} cb={team2.color} reverse />
            <CompareRow label="Blue Cards" a={blue1} b={blue2} ca={team1.color} cb={team2.color} reverse />
            <CompareRow label="Timeouts" a={totals1.timeouts} b={totals2.timeouts} ca={team1.color} cb={team2.color} />
            <CompareRow label="GK Saves" a={gkT1.saves} b={gkT2.saves} ca={team1.color} cb={team2.color} />
            <CompareRow label="GK Goals In" a={gkT1.conceded} b={gkT2.conceded} ca={team1.color} cb={team2.color} reverse />
            <CompareRow label="GK Save %" a={gkT1.pct} b={gkT2.pct} suffix="%" ca={team1.color} cb={team2.color} />
          </div>
          </div>
        </div>




        {/* Per-team shot location report */}
        <SectionPrint id="sec-shot-locations" />
        <div id="sec-shot-locations" className="bg-white border p-4 mb-4 print:break-after-page print:break-inside-avoid">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Shot Locations by Team</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TeamShotPanel teamName={team1.name || "Team 1"} totals={totals1} shots={log.filter((e) => e.team === 1 && (isPenaltyShot(e) || e.x != null))} team1Direction={team1Direction} />
            <TeamShotPanel teamName={team2.name || "Team 2"} totals={totals2} shots={log.filter((e) => e.team === 2 && (isPenaltyShot(e) || e.x != null))} team1Direction={team1Direction} />
          </div>
          <div className="flex justify-center gap-6 mt-3 text-xs">
            <span className="text-brand-green font-bold">+ Made</span>
            <span className="text-accent-red font-bold">− Missed / Saved</span>
          </div>
        </div>

        {/* Goalkeepers + GK Shot Zones — merged */}
        <SectionPrint id="sec-gk" />
        <div id="sec-gk" className="mb-4 print:break-after-page print:break-inside-avoid">
          <div data-print-unit="gk-tables" className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <GKPanel name={team1.name || "Team 1"} color={team1.color} gks={gk1} />
            <GKPanel name={team2.name || "Team 2"} color={team2.color} gks={gk2} />
          </div>
          <div data-print-unit="gk-zones" className="grid grid-cols-1 md:grid-cols-2 gap-4 print:gap-2">
            <GKZonesPanel teamName={team1.name || "Team 1"} color={team1.color} shotsFaced={log.filter((e) => e.team === 2)} />
            <GKZonesPanel teamName={team2.name || "Team 2"} color={team2.color} shotsFaced={log.filter((e) => e.team === 1)} />
          </div>
        </div>

        {/* Shot Chart + Player Analysis — merged */}
        <SectionPrint id="sec-visuals" />
        <div id="sec-visuals" className="mb-4 print:break-after-page print:break-inside-avoid">
          <div data-print-unit="shot-chart" className="bg-white border p-4 mb-4 print:p-2">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 print:mb-1">Shot Chart — All Shots</div>
            <div className="max-w-3xl mx-auto print:max-w-2xl">
              <HandballCourt
                className="print:h-[38vh]"
                shots={log.filter((e) => isPenaltyShot(e) || e.x != null)}
                team1Color={team1.color}
                team2Color={team2.color}
                team1Direction={team1Direction}
                colorForShot={(s) => {
                  const roster = s.team === 1 ? team1.players : s.team === 2 ? team2.players : [];
                  const pl = roster.find((p) => p.no === s.playerNo);
                  return posColor(pl?.position);
                }}
              />
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3 text-xs print:mt-1">
              {["GK","LW","LB","CB","RB","RW","P"].map((p) => (
                <span key={p} className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ background: posColor(p) }} />
                  <span className="font-bold uppercase">{p}</span>
                </span>
              ))}
              <span className="text-muted-foreground">● Goal · ✕ Miss · ◌ Saved</span>
            </div>
          </div>
          <div data-print-unit="player-analysis" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PlayerAnalysisPanel teamName={team1.name || "Team 1"} color={team1.color} team={team1} log={log} teamN={1} />
            <PlayerAnalysisPanel teamName={team2.name || "Team 2"} color={team2.color} team={team2} log={log} teamN={2} />
          </div>
        </div>





        {/* Shots by Position — split per team so each prints on its own page */}
        <SectionPrint id="sec-shots-by-position-t1" label="Print T1 Positions" />
        <div id="sec-shots-by-position-t1" className="mb-4 print:break-after-page print:break-inside-avoid">
          <PositionPanel teamName={team1.name || "Team 1"} color={team1.color} team={team1} log={log} teamN={1} team1Direction={team1Direction} />
        </div>
        <SectionPrint id="sec-shots-by-position-t2" label="Print T2 Positions" />
        <div id="sec-shots-by-position-t2" className="mb-4 print:break-after-page print:break-inside-avoid">
          <PositionPanel teamName={team2.name || "Team 2"} color={team2.color} team={team2} log={log} teamN={2} team1Direction={team1Direction} />
        </div>



        {/* Strength Situation Breakdown */}
        <div className="h-4" />
        <SectionPrint id="sec-strength" />
        <div id="sec-strength" className="print:break-before-page print:break-inside-avoid">
          <StrengthSituationTable
            team1={team1}
            team2={team2}
            log={log}
            halfLength={info.halfLength}
            otLength={info.otLength}
            halves={info.halves}
          />
        </div>

        {/* Shootout (after extra time) — always last */}
        <div className="h-4" />
        <SectionPrint id="sec-shootout" />
        <div id="sec-shootout" className="print:break-before-page print:break-inside-avoid">
          <ShootoutStats team1={team1} team2={team2} rounds={shootoutRounds} />
        </div>
        <AppFooter variant="light" className="mt-auto print:hidden" />
      </div>
    </div>
  );
}

type ActionGroupKey = "MADE" | "MISSED" | "FOUL" | "TURNOVER";
const ACTION_GROUP: Partial<Record<LogEntry["action"], ActionGroupKey>> = {
  "GOAL": "MADE",
  "7M": "MADE",
  "SHOT MISSED": "MISSED",
  "SHOT SAVED": "MISSED",
  "FOUL": "FOUL",
  "YELLOW": "FOUL",
  "2-MIN": "FOUL",
  // RED is an ejection, not a foul — excluded from strength/foul bucketing.
  "BLUE": "FOUL",
  "TURNOVER": "TURNOVER",
};

function eventTotalSec(e: LogEntry, halfLength: number, otLength: number, halves: number): number {
  const [mm, ss] = (e.clock || "00:00").split(":").map((v) => parseInt(v, 10) || 0);
  const clockSec = mm * 60 + ss;
  let elapsedBefore = 0;
  for (let h = 1; h < e.half; h++) {
    elapsedBefore += (h > halves ? otLength : halfLength) * 60;
  }
  const thisLen = (e.half > halves ? otLength : halfLength) * 60;
  return elapsedBefore + (thisLen - clockSec);
}

function StrengthSituationTable({
  team1, team2, log, halfLength, otLength, halves,
}: {
  team1: TeamSetup; team2: TeamSetup; log: LogEntry[];
  halfLength: number; otLength: number; halves: number;
}) {
  const withTime = log.map((e) => ({ e, t: eventTotalSec(e, halfLength, otLength, halves) }));
  const chronological = [...withTime].sort((a, b) => a.t - b.t);

  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  // Per-team GK predicate — robust to unset/mislabeled position fields.
  const buildIsGK = (team: TeamSetup) => {
    const norm = (s?: string) => String(s ?? "").trim().toUpperCase();
    const anyPositionSet = team.players.some((p) => norm(p.position) !== "");
    const gkNos = new Set(
      team.players
        .filter((p) => {
          const r = norm(p.position);
          return r === "GK" || r === "GOALKEEPER" || r.startsWith("GK");
        })
        .map((p) => p.no),
    );
    return (no: string): boolean => {
      if (gkNos.has(no)) return true;
      if (!anyPositionSet && (no === "1" || no === "12" || no === "16")) return true;
      return false;
    };
  };
  const isGK1 = buildIsGK(team1);
  const isGK2 = buildIsGK(team2);

  // Kickoff lineup: honor Player.onCourt when present; else first up-to-7 playing players.
  const kickoffOnCourt = (team: TeamSetup, isGK: (no: string) => boolean): Set<string> => {
    const explicit = team.players.filter((p) => p.onCourt === true);
    const pool = explicit.length > 0 ? explicit : team.players.filter((p) => p.playing !== false);
    const gk = pool
      .filter((p) => isGK(p.no))
      .sort((a, b) => (Number(a.no) || 0) - (Number(b.no) || 0))[0];
    const picked: string[] = [];
    if (gk) picked.push(gk.no);
    for (const p of pool) {
      if (picked.length >= 7) break;
      if (p.no && !picked.includes(p.no)) picked.push(p.no);
    }
    return new Set(picked);
  };

  type TeamState = {
    onCourt: Set<string>;
    suspendedCount: number;
    permanentlyOut: Set<string>;
    twoMinHistory: Map<string, number>;
    // Pending restorations: at endT decrement suspendedCount, and optionally re-add player.
    restorations: { endT: number; playerNo: string; readd: boolean }[];
  };
  const state: Record<1 | 2, TeamState> = {
    1: { onCourt: kickoffOnCourt(team1, isGK1), suspendedCount: 0, permanentlyOut: new Set(), twoMinHistory: new Map(), restorations: [] },
    2: { onCourt: kickoffOnCourt(team2, isGK2), suspendedCount: 0, permanentlyOut: new Set(), twoMinHistory: new Map(), restorations: [] },
  };

  const hasGKNow = (teamN: 1 | 2): boolean => {
    const isGK = teamN === 1 ? isGK1 : isGK2;
    for (const no of state[teamN].onCourt) {
      if (isGK(no)) return true;
    }
    return false;

  };

  const totalOnCourtNow = (teamN: 1 | 2): number => {
    return clamp(7 - state[teamN].suspendedCount, 3, 7);
  };

  const fieldPlayersNow = (teamN: 1 | 2): number => {
    const total = totalOnCourtNow(teamN);
    return hasGKNow(teamN) ? total - 1 : total;
  };

  // Sweep expired restorations for both teams up to time `t`.
  const sweep = (t: number) => {
    (["1", "2"] as const).forEach((k) => {
      const teamN = Number(k) as 1 | 2;
      const st = state[teamN];
      const stillPending: typeof st.restorations = [];
      for (const r of st.restorations) {
        if (r.endT <= t) {
          st.suspendedCount = Math.max(0, st.suspendedCount - 1);
          if (r.readd && !st.permanentlyOut.has(r.playerNo) && st.onCourt.size < 7) {
            st.onCourt.add(r.playerNo);
          }
        } else {
          stillPending.push(r);
        }
      }
      st.restorations = stillPending;
    });
  };

  const parseSubNos = (raw?: string): string[] => {
    if (!raw) return [];
    if (raw.includes("↔")) return raw.split("↔").map((s) => s.trim()).filter(Boolean);
    return [raw.trim()];
  };

  // Per-event caches decided BEFORE applying the event's state effects.
  const situationByEntryId = new Map<string, { attackField: number; defendField: number; emptyAttack: boolean }>();

  chronological.forEach(({ e, t }) => {
    sweep(t);

    // Record the situation for scorable events before applying their effects.
    if (e.team && ACTION_GROUP[e.action]) {
      const acting: 1 | 2 = e.team as 1 | 2;
      const opp: 1 | 2 = acting === 1 ? 2 : 1;
      situationByEntryId.set(e.id, {
        attackField: fieldPlayersNow(acting),
        defendField: fieldPlayersNow(opp),
        emptyAttack: !hasGKNow(acting),
      });
    }

    if (!e.team) return;
    const teamN = e.team as 1 | 2;
    const st = state[teamN];
    const p = e.playerNo;

    if (e.action === "SUBSTITUTION") {
      const nos = parseSubNos(e.playerNo);
      // Toggle presence for each listed number (in↔out).
      nos.forEach((no) => {
        if (st.permanentlyOut.has(no)) return;
        if (st.onCourt.has(no)) st.onCourt.delete(no);
        else if (st.onCourt.size < 7) st.onCourt.add(no);
      });
    } else if (e.action === "2-MIN" && p) {
      st.onCourt.delete(p);
      st.suspendedCount += 1;
      const prior = st.twoMinHistory.get(p) || 0;
      const next = prior + 1;
      st.twoMinHistory.set(p, next);
      if (next >= 3) {
        // Auto-RED: player is permanently out; team still serves the 2-minute penalty.
        st.permanentlyOut.add(p);
        st.restorations.push({ endT: t + 120, playerNo: p, readd: false });
      } else {
        st.restorations.push({ endT: t + 120, playerNo: p, readd: true });
      }
    } else if ((e.action === "RED" || e.action === "BLUE") && p) {
      st.onCourt.delete(p);
      st.permanentlyOut.add(p);
      // Team serves a 2-minute penalty; player never returns.
      st.suspendedCount += 1;
      st.restorations.push({ endT: t + 120, playerNo: p, readd: false });
    }
  });

  type Cell = Record<ActionGroupKey, number>;
  const empty = (): Cell => ({ MADE: 0, MISSED: 0, FOUL: 0, TURNOVER: 0 });

  type SituationRow = {
    situation: string;
    defense: string;
    cell: Cell;
  };

  // Composite key: situation|defense. Each unique combination becomes one row.
  const teamBuckets: Record<1 | 2, Record<string, SituationRow>> = {
    1: {},
    2: {},
  };

  const situationLabel = (attackField: number, defendField: number, emptyAttack: boolean): string => {
    let base: string;
    if (attackField === 7 && defendField === 6) base = "7v6";
    else base = `${attackField}v${defendField}`;
    return emptyAttack ? `${base} · Empty Goal` : base;
  };

  withTime.forEach(({ e }) => {
    if (!e.team) return;
    const grp = ACTION_GROUP[e.action];
    if (!grp) return;
    const sr = situationByEntryId.get(e.id);
    if (!sr) return;
    // User-confirmed override (from the strength confirmation modal) takes precedence.
    const attack = e.strengthAttack ?? sr.attackField;
    const defend = e.strengthDefend ?? sr.defendField;
    const emptyGoalFlag = e.strengthAttackEmpty ?? sr.emptyAttack;
    const situation = situationLabel(attack, defend, emptyGoalFlag);
    const defenseLabel = e.defense || "—";
    const groupKey = `${situation}|${defenseLabel}`;
    const bucket = teamBuckets[e.team as 1 | 2];
    if (bucket[groupKey]) {
      bucket[groupKey].cell[grp]++;
    } else {
      bucket[groupKey] = { situation, defense: defenseLabel, cell: empty() };
      bucket[groupKey].cell[grp]++;
    }
  });

  const groups: ActionGroupKey[] = ["MADE", "MISSED", "FOUL", "TURNOVER"];

  const renderTeamTable = (teamN: 1 | 2, tSetup: TeamSetup) => {
    const buckets = teamBuckets[teamN];
    const rows = Object.values(buckets).sort((a, b) => {
      if (a.situation !== b.situation) return a.situation.localeCompare(b.situation);
      return a.defense.localeCompare(b.defense);
    });
    const label = tSetup.shortCode || (tSetup.name ? tSetup.name.slice(0, 20) : `Team ${teamN}`);
    return (
      <div className="bg-white border mb-4 print:break-inside-avoid">
        <div className="px-3 py-2 text-white font-bold uppercase tracking-wider text-xs" style={{ background: tSetup.color || "#666" }}>
          Strength Situation — {label}
        </div>
        {rows.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground">No actions recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="px-2 py-1 text-left font-bold uppercase border-r">
                    Situation
                    <div className="font-normal normal-case text-[10px] text-muted-foreground">attack field v defend field</div>
                  </th>
                  <th className="px-2 py-1 text-left font-bold uppercase border-r">Defense</th>
                  {groups.map((g) => (
                    <th key={g} className="px-2 py-1 text-center font-bold uppercase">{g}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  return (
                    <tr key={`${row.situation}|${row.defense}`} className="border-t">
                      <td className="px-2 py-1 font-bold tabular-nums border-r">{row.situation}</td>
                      <td className="px-2 py-1 tabular-nums border-r">{row.defense}</td>
                      {groups.map((g) => (
                        <td key={g} className="px-2 py-1 text-center tabular-nums">{row.cell[g] || "—"}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="px-3 py-2 bg-topbar text-white font-bold uppercase tracking-wider text-xs mb-3">
        Strength Situation — Actions by Player Count
      </div>
      {renderTeamTable(1, team1)}
      {renderTeamTable(2, team2)}
      <div className="px-3 py-2 text-[10px] text-muted-foreground bg-white border">
        Situation compares attacking-team field players vs defending-team field players at the moment of the action.
        Field players = total on court minus goalkeeper (dynamically detected from on-court roles).
        "Empty Net" is an independent flag set when the defending team has no goalkeeper on court, regardless of strength.
        A 2-minute suspension, red card, or blue card each reduce the team's capacity for 2 minutes; red/blue also permanently exclude the player.
        A 3rd 2-minute suspension for the same player auto-converts to a red card (permanent exclusion) while the team still serves 2 minutes.
        Defense codes: 6/0, 5/1, 4/2, 3/3, M2M, 5/0, 4/1 — chosen for each action by the scorer.
      </div>
    </div>
  );
}


function ShootoutStats({ team1, team2, rounds }: { team1: TeamSetup; team2: TeamSetup; rounds: { t1: ("G" | "M" | null); t2: ("G" | "M" | null); t1Player?: string; t2Player?: string }[] }) {
  const tally = (side: "t1" | "t2") => {
    const made = rounds.filter((r) => r[side] === "G").length;
    const att = rounds.filter((r) => r[side] != null).length;
    return { made, att, pct: att ? Math.round((made / att) * 100) : 0 };
  };
  const t1 = tally("t1");
  const t2 = tally("t2");
  const perPlayer = (side: "t1" | "t2") => {
    const m = new Map<string, { made: number; att: number }>();
    rounds.forEach((r) => {
      const pn = side === "t1" ? r.t1Player : r.t2Player;
      const v = r[side];
      if (!pn || v == null) return;
      const cur = m.get(pn) ?? { made: 0, att: 0 };
      cur.att++;
      if (v === "G") cur.made++;
      m.set(pn, cur);
    });
    return m;
  };
  const p1 = perPlayer("t1");
  const p2 = perPlayer("t2");
  const renderTeam = (name: string, color: string, team: TeamSetup, totals: typeof t1, players: Map<string, { made: number; att: number }>) => (
    <div className="bg-white border">
      <div className="px-3 py-2 text-white font-bold uppercase tracking-wider text-xs flex items-center justify-between" style={{ background: color }}>
        <span>Shootout Penalties — {name}</span>
        <span className="tabular-nums">{totals.made}/{totals.att} · {totals.pct}%</span>
      </div>
      {players.size === 0 ? (
        <div className="p-4 text-xs text-muted-foreground">No shootout penalties recorded.</div>
      ) : (
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              <th className="px-2 py-1 text-left font-bold uppercase">#</th>
              <th className="px-2 py-1 text-left font-bold uppercase">Player</th>
              <th className="px-2 py-1 text-center font-bold uppercase">Made</th>
              <th className="px-2 py-1 text-center font-bold uppercase">M/A</th>
              <th className="px-2 py-1 text-center font-bold uppercase">%</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(players.entries()).map(([no, v]) => {
              const p = team.players.find((pl) => pl.no === no);
              const nm = p ? `${p.name} ${p.surname}`.trim() : "";
              const pct = v.att ? Math.round((v.made / v.att) * 100) : 0;
              return (
                <tr key={no} className="border-t">
                  <td className="px-2 py-1 font-bold">{no}</td>
                  <td className="px-2 py-1">{nm || "—"}</td>
                  <td className="px-2 py-1 text-center tabular-nums font-bold">{v.made}</td>
                  <td className="px-2 py-1 text-center tabular-nums">{v.made}/{v.att}</td>
                  <td className="px-2 py-1 text-center tabular-nums">{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {renderTeam(team1.name || "Team 1", team1.color, team1, t1, p1)}
      {renderTeam(team2.name || "Team 2", team2.color, team2, t2, p2)}
    </div>
  );
}

function PositionPanel({ teamName, color, team, log, teamN, team1Direction }: { teamName: string; color: string; team: TeamSetup; log: LogEntry[]; teamN: 1 | 2; team1Direction: "left" | "right" }) {
  const POSITIONS_ORDER = ["GK", "LW", "LB", "CB", "RB", "RW", "P"];
  const grouped = new Map<string, typeof team.players>();
  team.players.forEach((p) => {
    const pos = p.position || "—";
    const arr = grouped.get(pos) || [];
    arr.push(p);
    grouped.set(pos, arr);
  });
  const orderedPositions = [...POSITIONS_ORDER.filter((p) => grouped.has(p)), ...[...grouped.keys()].filter((p) => !POSITIONS_ORDER.includes(p))];
  const shotsByPlayer = (no: string) => {
    const list = log.filter((e) => e.team === teamN && e.playerNo === no);
    const goals = list.filter((e) => e.action === "GOAL" || e.action === "7M").length;
    const missed = list.filter((e) => e.action === "SHOT MISSED").length;
    const saved = list.filter((e) => e.action === "SHOT SAVED").length;
    const shots = goals + missed + saved;
    return { goals, missed, saved, shots };
  };
  return (
    <div className="bg-white border">
      <div className="px-3 py-2 text-white font-bold uppercase tracking-wider text-xs" style={{ background: color }}>
        Shots by Position — {teamName}
      </div>
      <div className="divide-y">
        {orderedPositions.map((pos) => {
          const players = grouped.get(pos) || [];
          return (
            <div key={pos}>
              <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider flex items-center gap-2" style={{ background: `${color}15`, color }}>
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
                {pos}
                <span className="text-muted-foreground">({players.length})</span>
              </div>
              <table className="w-full text-[11px]">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-2 py-1 text-left font-bold w-10">#</th>
                    <th className="px-2 py-1 text-left font-bold">Name</th>
                    <th className="px-2 py-1 text-center font-bold">Goals</th>
                    <th className="px-2 py-1 text-center font-bold">Saved</th>
                    <th className="px-2 py-1 text-center font-bold">Missed</th>
                    <th className="px-2 py-1 text-center font-bold">Shots</th>
                    <th className="px-2 py-1 text-center font-bold">%</th>
                    <th className="px-2 py-1 text-center font-bold w-[720px]">Court &amp; Goal Placement</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => {
                    const s = shotsByPlayer(p.no);
                    const pct = s.shots ? Math.round((s.goals / s.shots) * 100) : 0;
                    const playerShots = log
                      .filter((e) => e.team === teamN && e.playerNo === p.no && (e.action === "GOAL" || e.action === "7M" || e.action === "SHOT MISSED" || e.action === "SHOT SAVED"))
                      .map((e, i) => ({ ...e, seq: i + 1 }));
                    const courtShots = playerShots.filter((e) => isPenaltyShot(e) || (e.x != null && e.y != null));
                    const goalShots = playerShots.filter((e) => e.goalX != null && e.goalY != null);
                    const dotColor = (a: LogEntry["action"]) =>
                      a === "GOAL" || a === "7M" ? "#16a34a" : a === "SHOT SAVED" ? "#f59e0b" : "#dc2626";
                    return (
                      <tr key={p.id} className="border-t" style={{ color }}>
                        <td className="px-2 py-1 font-bold tabular-nums">{p.no}</td>
                        <td className="px-2 py-1 font-semibold">{[p.name, p.surname].filter(Boolean).join(" ") || "—"}</td>
                        <td className="px-2 py-1 text-center tabular-nums font-bold">{s.goals || ""}</td>
                        <td className="px-2 py-1 text-center tabular-nums">{s.saved || ""}</td>
                        <td className="px-2 py-1 text-center tabular-nums">{s.missed || ""}</td>
                        <td className="px-2 py-1 text-center tabular-nums">{s.shots || ""}</td>
                        <td className="px-2 py-1 text-center tabular-nums">{s.shots ? `${pct}%` : ""}</td>
                        <td className="px-1 py-1">
                          {playerShots.length === 0 ? (
                            <div className="text-[9px] text-muted-foreground text-center">—</div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 items-center">
                              <div className="relative">
                                <img src={courtAsset} alt="court" className="w-full h-auto block" draggable={false} />
                                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                  {courtShots.map((e) => {
                                    const { x, y } = displayShotXY(e, team1Direction);
                                    return (
                                      <g key={`c-${e.id}`} transform={`translate(${x * 100} ${y * 100})`}>
                                        <circle r="3" fill={dotColor(e.action)} stroke="#fff" strokeWidth="0.5" />
                                        <text x="0" y="0.9" textAnchor="middle" fontSize="3" fontWeight="700" fill="#fff">{e.seq}</text>
                                      </g>
                                    );
                                  })}
                                </svg>
                              </div>
                              <div className="relative">
                                <img src={goalAsset} alt="goal" className="w-full h-auto block" draggable={false} />
                                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                  {goalShots.map((e) => (
                                    <g key={`g-${e.id}`} transform={`translate(${(e.goalX ?? 0) * 100} ${(e.goalY ?? 0) * 100})`}>
                                      <circle r="4" fill={dotColor(e.action)} stroke="#fff" strokeWidth="0.6" />
                                      <text x="0" y="1.2" textAnchor="middle" fontSize="4" fontWeight="700" fill="#fff">{e.seq}</text>
                                    </g>
                                  ))}
                                </svg>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamShotPanel({ teamName, totals, shots, team1Direction }: { teamName: string; totals: { goals: number; shots: number; shotPct: number; pen: number; missed?: number }; shots: LogEntry[]; team1Direction: "left" | "right" }) {
  const made = shots.filter((s) => s.action === "GOAL" || s.action === "7M");
  const missed = shots.filter((s) => s.action === "SHOT MISSED" || s.action === "SHOT SAVED");
  const shotsTotal = totals.shots;
  const pct = totals.shotPct ? Math.round(totals.shotPct) : 0;
  return (
    <div className="border rounded-md overflow-hidden">
      <div className="px-3 py-2 bg-topbar text-white text-sm font-bold text-center">{teamName}</div>
      <div className="relative bg-white">
        <img src={courtAsset} alt="" className="w-full h-auto block" draggable={false} />
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          {made.map((s) => {
            const { x, y } = displayShotXY(s, team1Direction);
            return (
              <g key={s.id} transform={`translate(${x * 100} ${y * 100})`} stroke="#16a34a" strokeWidth="0.6" strokeLinecap="round">
                <line x1="-1.4" y1="0" x2="1.4" y2="0" />
                <line x1="0" y1="-1.4" x2="0" y2="1.4" />
              </g>
            );
          })}
          {missed.map((s) => {
            const { x, y } = displayShotXY(s, team1Direction);
            return (
              <g key={s.id} transform={`translate(${x * 100} ${y * 100})`} stroke="#dc2626" strokeWidth="0.6" strokeLinecap="round">
                <line x1="-1.4" y1="0" x2="1.4" y2="0" />
              </g>
            );
          })}
        </svg>
      </div>
      <table className="w-full text-xs border-t">
        <thead className="bg-muted">
          <tr>
            <th className="px-2 py-1 text-left font-bold uppercase tracking-wider">Field Goals</th>
            <th className="px-2 py-1 text-center font-bold uppercase tracking-wider">M/A</th>
            <th className="px-2 py-1 text-center font-bold uppercase tracking-wider">%</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t"><td className="px-2 py-1">All Shots</td><td className="px-2 py-1 text-center tabular-nums">{totals.goals}/{shotsTotal}</td><td className="px-2 py-1 text-center tabular-nums">{pct}</td></tr>
          <tr className="border-t"><td className="px-2 py-1">7m</td><td className="px-2 py-1 text-center tabular-nums">{totals.pen}/{shots.filter((s) => isPenaltyShot(s)).length || totals.pen}</td><td className="px-2 py-1 text-center tabular-nums">—</td></tr>
        </tbody>
      </table>
    </div>
  );
}



function CompareRow({ label, a, b, ca, cb, suffix = "", reverse = false }: { label: string; a: number; b: number; ca: string; cb: string; suffix?: string; reverse?: boolean }) {
  const max = Math.max(a, b, 1);
  const aPct = (a / max) * 100;
  const bPct = (b / max) * 100;
  const aWins = reverse ? a < b : a > b;
  const bWins = reverse ? b < a : b > a;
  return (
    <div className="grid grid-cols-[1fr_120px_1fr] items-center gap-3 text-sm">
      <div className="flex items-center justify-end gap-2">
        <span className={`font-bold tabular-nums ${aWins ? "" : "text-muted-foreground"}`}>{a}{suffix}</span>
        <div className="h-3 bg-muted rounded overflow-hidden flex-1 max-w-[180px] relative">
          <div className="absolute right-0 top-0 bottom-0" style={{ width: `${aPct}%`, background: ca }} />
        </div>
      </div>
      <div className="text-center text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</div>
      <div className="flex items-center gap-2">
        <div className="h-3 bg-muted rounded overflow-hidden flex-1 max-w-[180px]">
          <div className="h-full" style={{ width: `${bPct}%`, background: cb }} />
        </div>
        <span className={`font-bold tabular-nums ${bWins ? "" : "text-muted-foreground"}`}>{b}{suffix}</span>
      </div>
    </div>
  );
}

function GKPanel({ name, color, gks }: { name: string; color: string; gks: ReturnType<typeof buildGoalkeeperStats> }) {
  return (
    <div className="bg-white border">
      <div className="px-3 py-2 text-white font-bold uppercase tracking-wider text-xs flex items-center justify-between" style={{ background: color }}>
        <span>Goalkeepers — {name}</span>
      </div>
      {gks.length === 0 ? (
        <div className="p-4 text-xs text-muted-foreground">No goalkeeper assigned (set player position to GK).</div>
      ) : (
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              {["#","Player","Saves","Goals In","Save %"].map((h) => (
                <th key={h} className="px-2 py-2 text-left font-bold uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gks.map((g) => {
              const pct = gkSavePct(g);
              return (
                <tr key={g.no} className="border-t">
                  <td className="px-2 py-2 font-bold">{g.no}</td>
                  <td className="px-2 py-2">{g.name || "—"}</td>
                  <td className="px-2 py-2 tabular-nums font-bold">{g.saves}</td>
                  <td className="px-2 py-2 tabular-nums">{g.goalsConceded}</td>
                  <td className="px-2 py-2 tabular-nums">
                    <div className="flex items-center gap-2">
                      <span className="font-bold w-10">{pct}%</span>
                      <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                        <div className="h-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block w-3 h-3 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

type Zone = "6m" | "Wing" | "9m" | "7m" | "FB";
type GeoZone = "6m" | "Wing" | "9m" | "7m";
// Court geography (normalized to the displayed court image):
//   6m   = inside the solid 6m arc (central strip)
//   9m   = between the 6m arc and the 9m arc (central strip)
//   Wing = extreme y strips (y<=0.2 or y>=0.8) regardless of radius
//   7m   = penalty throws (action "7M" or subtype "PENALTY")
// FB is NOT a geographic zone — it is a parallel counter that fires whenever
// a shot is flagged as fast break. A fast-break shot counts BOTH in its
// geographic zone and in the FB column.
function classifyZone(e: LogEntry): GeoZone | null {
  return classifyShotZoneOrOverride(e);
}

interface ZoneCount { g: number; a: number; saved: number; missed: number; post: number; blocked: number }
const emptyZone = (): ZoneCount => ({ g: 0, a: 0, saved: 0, missed: 0, post: 0, blocked: 0 });

function fmtMA(g: number, a: number) { return a ? `${g}/${a}` : ""; }
function fmtPct(g: number, a: number) { return a ? `${Math.round((g / a) * 100)}` : ""; }



function TeamTable({ name, color, team, stats, log, teamN }: { name: string; color: string; team: TeamSetup; stats: ReturnType<typeof buildBoxScore>; log: LogEntry[]; teamN: 1 | 2 }) {
  // Per-player zone aggregates (uses court coordinates classification)
  const perPlayer = new Map<string, Record<Zone, ZoneCount>>();
  const ensure = (pn: string) => {
    let m = perPlayer.get(pn);
    if (!m) { m = { "6m": emptyZone(), Wing: emptyZone(), "9m": emptyZone(), "7m": emptyZone(), FB: emptyZone() }; perPlayer.set(pn, m); }
    return m;
  };
  // Subtype-based counts (EG, Penalty)
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
      // FB is a parallel counter — fast-break shots ALSO count in FB
      // in addition to their geographic zone.
      if (isShot && !isBtEg && isFastBreak(e)) bump(ensure(e.playerNo).FB);
      // own player shooting 7m is already represented in the 7m M/A column
    }

    // opponent fouls involving our player → fouls drawn / received
    if (e.team !== teamN && e.involverNo) {
      const sb = ensureSub(e.involverNo);
      if (e.action === "FOUL" || e.action === "7M" || e.action === "2-MIN" || e.action === "YELLOW" || e.action === "RED" || e.action === "BLUE") sb.rf++;
      // 7m drawn by our player (opponent FOUL with subtype 7M)
      if (e.action === "FOUL" && e.subtype === "7M") sb.r7m++;
    }
    // fouls caused by our player that gave a 7m to opponent
    if (e.team === teamN && e.playerNo && e.action === "FOUL" && e.subtype === "7M") {
      const sb = ensureSub(e.playerNo);
      sb.p7m++;
    }
    // rebounds tagged on shot entries — credit only the team that actually grabbed the ball
    if (e.reboundNo && e.reboundTeam === teamN) {
      if (e.team === teamN) {
        // own miss recovered → offensive rebound
        const sb = ensureSub(e.reboundNo); sb.or++;
      } else {
        // opponent miss recovered → defensive rebound
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

  // per-player BT / EG counts (subtype on a shot) — track made/attempts
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

const POSITION_COLORS: Record<string, string> = {
  GK: "#6B7280",
  LW: "#F59E0B",
  LB: "#EF4444",
  CB: "#8B5CF6",
  RB: "#3B82F6",
  RW: "#10B981",
  P: "#F2E8D5",
};
const posColor = (pos?: string) => POSITION_COLORS[pos ?? ""] ?? "#94a3b8";

const ZONE_XG: Record<Zone, number> = {
  "7m": 0.75,
  "6m": 0.65,
  Wing: 0.55,
  FB: 0.70,
  "9m": 0.30,
};

function PlayerAnalysisPanel({ teamName, color, team, log, teamN }: { teamName: string; color: string; team: TeamSetup; log: LogEntry[]; teamN: 1 | 2 }) {
  const playerByNo = new Map(team.players.map((p) => [p.no, p]));

  const teamShots = log.filter(
    (e) => e.team === teamN && e.playerNo && (e.action === "GOAL" || e.action === "7M" || e.action === "SHOT MISSED" || e.action === "SHOT SAVED"),
  );

  const goalShots = teamShots.filter((e) => e.action === "GOAL" || e.action === "7M");
  const missShots = teamShots.filter((e) => e.action === "SHOT MISSED" || e.action === "SHOT SAVED");


  type Row = { no: string; name: string; pos: string; shots: number; goals: number; xg: number };
  const rowMap = new Map<string, Row>();
  teamShots.forEach((e) => {
    const p = playerByNo.get(e.playerNo!);
    const key = e.playerNo!;
    const row = rowMap.get(key) ?? {
      no: key,
      name: p ? `${p.name} ${p.surname}`.trim() : "",
      pos: p?.position ?? "",
      shots: 0, goals: 0, xg: 0,
    };
    row.shots++;
    if (e.action === "GOAL" || e.action === "7M") row.goals++;
    const z = classifyZone(e);
    const xgKey: Zone | null = isFastBreak(e) ? "FB" : z;
    if (xgKey) row.xg += ZONE_XG[xgKey];
    rowMap.set(key, row);
  });
  const rows = Array.from(rowMap.values()).sort((a, b) => b.goals - a.goals || b.shots - a.shots);

  const posMap = new Map<string, { pos: string; players: number; shots: number; goals: number; xg: number }>();
  rows.forEach((r) => {
    const key = r.pos || "—";
    const p = posMap.get(key) ?? { pos: key, players: 0, shots: 0, goals: 0, xg: 0 };
    p.players++;
    p.shots += r.shots;
    p.goals += r.goals;
    p.xg += r.xg;
    posMap.set(key, p);
  });
  const POS_ORDER = ["GK", "LW", "LB", "CB", "RB", "RW", "P"];
  const posRows = Array.from(posMap.values()).sort(
    (a, b) => (POS_ORDER.indexOf(a.pos) + 100) - (POS_ORDER.indexOf(b.pos) + 100),
  );

  const usedPositions = Array.from(new Set(rows.map((r) => r.pos).filter(Boolean)));

  const pct = (g: number, s: number) => (s ? Math.round((g / s) * 100) : 0);
  const xgPct = (xg: number, s: number) => (s ? Math.round((xg / s) * 100) : 0);
  const deltaCls = (d: number) => (d > 0 ? "text-brand-green" : d < 0 ? "text-accent-red" : "text-muted-foreground");

  // Deterministic fallback coordinates when goalX/goalY are missing,
  // so every shot still appears on the goal image.
  const hash = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h;
  };
  const missZoneCoord = (mz?: string): { x: number; y: number } | null => {
    switch (mz) {
      case "LEFT_CORNER": return { x: 0.15, y: 0.75 };
      case "RIGHT_CORNER": return { x: 0.85, y: 0.75 };
      case "LEFT_CROSSBAR": return { x: 0.20, y: 0.15 };
      case "RIGHT_CROSSBAR": return { x: 0.80, y: 0.15 };
      case "POST": return { x: 0.50, y: 0.50 };
      default: return null;
    }
  };
  const plotCoord = (e: LogEntry) => {
    if (e.goalX != null && e.goalY != null) return { x: e.goalX, y: e.goalY };
    const mz = missZoneCoord(e.missZone);
    if (mz) {
      const h = hash(e.id);
      return { x: mz.x + (((h & 0xff) / 255 - 0.5) * 0.08), y: mz.y + ((((h >> 8) & 0xff) / 255 - 0.5) * 0.08) };
    }
    const h = hash(e.id);
    // scatter within the goal mouth (10..90% width, 20..85% height)
    return { x: 0.10 + ((h & 0xffff) / 0xffff) * 0.80, y: 0.20 + (((h >> 16) & 0xffff) / 0xffff) * 0.65 };
  };

  const renderGoalFrame = (title: string, shots: LogEntry[]) => (
    <div className="flex-1 min-w-0">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1 text-center">{title}</div>
      <div className="relative">
        <img src={goalAsset} alt="goal" className="w-full h-auto block" draggable={false} />
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          {shots.map((s) => {
            const pl = playerByNo.get(s.playerNo!);
            const c = posColor(pl?.position);
            const { x, y } = plotCoord(s);
            return (
              <g key={s.id} transform={`translate(${x * 100} ${y * 100})`}>
                <circle r="2" fill={c} stroke="#fff" strokeWidth="0.4" opacity="0.92" />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="text-center text-[10px] mt-1 tabular-nums text-muted-foreground">{shots.length} shots</div>
    </div>
  );


  return (
    <div className="bg-white border">
      <div className="px-3 py-2 text-white font-bold uppercase tracking-wider text-xs" style={{ background: color }}>
        Player Shot Analysis — {teamName}
      </div>
      <div className="p-3 flex gap-3">
        {renderGoalFrame("Goals", goalShots)}
        {renderGoalFrame("Saved / Missed", missShots)}
      </div>
      {usedPositions.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
          {usedPositions.map((p) => (
            <span key={p} className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: posColor(p) }} />
              <span className="font-bold uppercase">{p}</span>
            </span>
          ))}
        </div>
      )}

      <div className="border-t">
        <div className="px-3 py-1 bg-muted text-[10px] uppercase tracking-widest font-bold">Players</div>
        <table className="w-full text-[11px]">
          <thead className="bg-muted/50">
            <tr>
              {["#", "Name", "Pos", "Shots", "Goals", "Actual%", "xG%", "Δ"].map((h) => (
                <th key={h} className="px-2 py-1 text-left font-bold uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-2 py-3 text-center text-muted-foreground">No shots recorded.</td></tr>
            ) : rows.map((r) => {
              const a = pct(r.goals, r.shots);
              const x = xgPct(r.xg, r.shots);
              const d = a - x;
              return (
                <tr key={r.no} className="border-t">
                  <td className="px-2 py-1 font-bold tabular-nums" style={{ borderLeft: `3px solid ${posColor(r.pos)}` }}>{r.no}</td>
                  <td className="px-2 py-1">{r.name || "—"}</td>
                  <td className="px-2 py-1 uppercase font-bold" style={{ color: posColor(r.pos) }}>{r.pos || "—"}</td>
                  <td className="px-2 py-1 tabular-nums">{r.shots}</td>
                  <td className="px-2 py-1 tabular-nums font-bold">{r.goals}</td>
                  <td className="px-2 py-1 tabular-nums">{a}%</td>
                  <td className="px-2 py-1 tabular-nums text-muted-foreground">{x}%</td>
                  <td className={`px-2 py-1 tabular-nums font-bold ${deltaCls(d)}`}>{d > 0 ? "+" : ""}{d}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t">
        <div className="px-3 py-1 bg-muted text-[10px] uppercase tracking-widest font-bold">By Position</div>
        <table className="w-full text-[11px]">
          <thead className="bg-muted/50">
            <tr>
              {["Pos", "Players", "Shots", "Goals", "Actual%", "xG%", "Δ"].map((h) => (
                <th key={h} className="px-2 py-1 text-left font-bold uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posRows.length === 0 ? (
              <tr><td colSpan={7} className="px-2 py-3 text-center text-muted-foreground">—</td></tr>
            ) : posRows.map((p) => {
              const a = pct(p.goals, p.shots);
              const x = xgPct(p.xg, p.shots);
              const d = a - x;
              return (
                <tr key={p.pos} className="border-t">
                  <td className="px-2 py-1 font-bold uppercase">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: posColor(p.pos) }} />
                      {p.pos}
                    </span>
                  </td>
                  <td className="px-2 py-1 tabular-nums">{p.players}</td>
                  <td className="px-2 py-1 tabular-nums">{p.shots}</td>
                  <td className="px-2 py-1 tabular-nums font-bold">{p.goals}</td>
                  <td className="px-2 py-1 tabular-nums">{a}%</td>
                  <td className="px-2 py-1 tabular-nums text-muted-foreground">{x}%</td>
                  <td className={`px-2 py-1 tabular-nums font-bold ${deltaCls(d)}`}>{d > 0 ? "+" : ""}{d}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}



