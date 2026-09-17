import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  listMatches,
  deleteMatch,
  getStandingsConfig,
  updateStandingsPoints,
  updateTeamBonus,
  type SavedMatchDTO,
  type StandingsConfigDTO,
} from "@/lib/db.functions";
import { COMPETITION_OPTIONS } from "@/lib/handball";
import { ReportLogo } from "@/components/ReportLogo";
import { AppFooter } from "@/components/AppFooter";
import { MatchReportLinks } from "@/components/MatchReportLinks";
import { Trash2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/standings")({
  component: StandingsPage,
});

interface StandingRow {
  team: string; teamKey: string; color: string;
  P: number; W: number; D: number; L: number;
  GF: number; GA: number; GD: number;
  basePts: number;
  b08: number; b10: number; bTP: number;
  Pts: number;
}

const nkey = (s: string) => (s || "").trim().toLowerCase();

function buildStandings(
  matches: SavedMatchDTO[],
  cfg: StandingsConfigDTO,
): StandingRow[] {
  const map = new Map<string, StandingRow>();
  const get = (name: string, color: string) => {
    const k = nkey(name);
    if (!map.has(k)) {
      const b = cfg.bonuses[k] || { bonus_08: 0, bonus_10: 0 };
      map.set(k, {
        team: name, teamKey: k, color,
        P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0,
        basePts: 0,
        b08: b.bonus_08, b10: b.bonus_10, bTP: b.bonus_08 + b.bonus_10,
        Pts: 0,
      });
    }
    return map.get(k)!;
  };
  matches.forEach((m) => {
    const a = get(m.team1Name, m.team1Color);
    const b = get(m.team2Name, m.team2Color);
    a.P++; b.P++;
    a.GF += m.score1; a.GA += m.score2;
    b.GF += m.score2; b.GA += m.score1;
    if (m.score1 > m.score2) { a.W++; b.L++; }
    else if (m.score1 < m.score2) { b.W++; a.L++; }
    else if (m.shootout1 != null && m.shootout2 != null && m.shootout1 !== m.shootout2) {
      if (m.shootout1 > m.shootout2) { a.W++; b.L++; } else { b.W++; a.L++; }
    }
    else { a.D++; b.D++; }

  });
  map.forEach((r) => {
    r.GD = r.GF - r.GA;
    r.bTP = r.b08 + r.b10;
    r.basePts = r.W * cfg.pointsWin + r.D * cfg.pointsDraw + r.L * cfg.pointsLoss;
    r.Pts = r.basePts + r.b08 + r.b10;
  });
  return Array.from(map.values()).sort(
    (x, y) => y.Pts - x.Pts || y.GD - x.GD || y.GF - x.GF,
  );
}

function formatPts(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}


function StandingsPage() {
  const qc = useQueryClient();
  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["matches"],
    queryFn: () => listMatches(),
  });
  const { data: cfg } = useQuery({
    queryKey: ["standings-config"],
    queryFn: () => getStandingsConfig(),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteMatch({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matches"] }),
  });

  const pointsMut = useMutation({
    mutationFn: (p: { pointsWin: number; pointsDraw: number; pointsLoss: number }) =>
      updateStandingsPoints({ data: p }),
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: ["standings-config"] });
      const prev = qc.getQueryData<StandingsConfigDTO>(["standings-config"]);
      if (prev) qc.setQueryData<StandingsConfigDTO>(["standings-config"], { ...prev, ...p });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["standings-config"], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["standings-config"] }),
  });

  const bonusMut = useMutation({
    mutationFn: (b: { teamName: string; bonus_08: number; bonus_10: number }) =>
      updateTeamBonus({ data: b }),
    onMutate: async (b) => {
      await qc.cancelQueries({ queryKey: ["standings-config"] });
      const prev = qc.getQueryData<StandingsConfigDTO>(["standings-config"]);
      if (prev) {
        qc.setQueryData<StandingsConfigDTO>(["standings-config"], {
          ...prev,
          bonuses: {
            ...prev.bonuses,
            [nkey(b.teamName)]: { bonus_08: b.bonus_08, bonus_10: b.bonus_10 },
          },
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["standings-config"], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["standings-config"] }),
  });


  const effectiveCfg: StandingsConfigDTO = cfg || { pointsWin: 1, pointsDraw: 0.5, pointsLoss: 0, bonuses: {} };

  const isCup = (c?: string | null) => /cup|كأس/i.test(c ?? "");
  const [compFilter, setCompFilter] = useState<string>("__all__");

  const competitions = COMPETITION_OPTIONS;

  const nonCupMatches = matches.filter((m) => !isCup(m.competition));
  const selectedIsCup = compFilter !== "__all__" && isCup(compFilter);
  const standingsMatches =
    compFilter === "__all__"
      ? nonCupMatches
      : nonCupMatches.filter((m) => (m.competition || "").trim() === compFilter);
  const table = buildStandings(standingsMatches, effectiveCfg);

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.97_0.005_260)] p-6">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-wide uppercase">Tournament Standings</h1>
          </div>
          <div className="flex justify-center"><ReportLogo /></div>
          <div className="flex items-center gap-2 justify-end">
            <Link to="/" className="h-9 px-3 bg-topbar text-white text-xs font-bold uppercase flex items-center gap-2"><ArrowLeft className="h-4 w-4" /> Home</Link>
            <Link to="/players" className="h-9 px-3 bg-black text-white text-xs font-bold uppercase flex items-center">Players</Link>
          </div>
        </div>

        {/* Points rule settings */}
        <div className="bg-white border rounded-lg shadow-sm p-4 mb-4 flex flex-wrap items-center gap-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Points rule:</div>
          <PointsField label="Win"  value={effectiveCfg.pointsWin}  onChange={(v) => pointsMut.mutate({ ...effectiveCfg, pointsWin: v })} />
          <PointsField label="Draw" value={effectiveCfg.pointsDraw} onChange={(v) => pointsMut.mutate({ ...effectiveCfg, pointsDraw: v })} />
          <PointsField label="Loss" value={effectiveCfg.pointsLoss} onChange={(v) => pointsMut.mutate({ ...effectiveCfg, pointsLoss: v })} />
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Competition:</label>
            <select
              value={compFilter}
              onChange={(e) => setCompFilter(e.target.value)}
              className="h-9 px-2 border border-input rounded-md text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
            >
              <option value="__all__">All competitions</option>
              {competitions.map((c) => (
                <option key={c} value={c}>{c}{isCup(c) ? " (Cup)" : ""}</option>
              ))}
            </select>
          </div>
        </div>



        {isLoading ? (
          <div className="bg-white border p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : matches.length === 0 ? (
          <div className="bg-white border p-10 text-center">
            <div className="text-lg font-bold mb-2">No matches yet</div>
            <p className="text-sm text-muted-foreground">Finish a match and choose <span className="font-semibold">Game → Finish &amp; Save to Tournament</span> to populate standings.</p>
          </div>
        ) : (
          <>
            {selectedIsCup ? (
              <div className="bg-white border rounded-lg shadow-sm p-6 mb-6 text-center text-sm text-muted-foreground">
                Cup matches are not counted in standings. See results below.
              </div>
            ) : (
              <div className="bg-white border rounded-lg shadow-sm mb-6 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-muted">
                    <tr>
                      {["#", "Team", "P", "W", "D", "L", "GF", "GA", "GD", "FT", "M1", "M2", "TP", "Pts"].map((h, idx) => (
                        <th
                          key={h}
                          className={`px-3 py-2.5 font-bold uppercase tracking-wider text-xs whitespace-nowrap ${idx === 1 ? "text-left" : "text-center"}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.map((r, i) => (
                      <tr key={r.teamKey} className="border-t hover:bg-muted/50">
                        <td className="px-3 py-2 font-bold tabular-nums text-center">{i + 1}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2 font-semibold">
                            <span className="inline-block w-2 h-6" style={{ background: r.color }} />
                            {r.team}
                          </div>
                        </td>
                        <td className="px-3 py-2 tabular-nums text-center">{r.P}</td>
                        <td className="px-3 py-2 tabular-nums text-center">{r.W}</td>
                        <td className="px-3 py-2 tabular-nums text-center">{r.D}</td>
                        <td className="px-3 py-2 tabular-nums text-center">{r.L}</td>
                        <td className="px-3 py-2 tabular-nums text-center">{r.GF}</td>
                        <td className="px-3 py-2 tabular-nums text-center">{r.GA}</td>
                        <td className="px-3 py-2 tabular-nums text-center">{r.GD > 0 ? `+${r.GD}` : r.GD}</td>
                        <td className="px-3 py-2 tabular-nums text-center">{formatPts(r.basePts)}</td>
                        <BonusCell value={r.b08} onCommit={(v) => bonusMut.mutate({ teamName: r.team, bonus_08: v, bonus_10: r.b10 })} />
                        <BonusCell value={r.b10} onCommit={(v) => bonusMut.mutate({ teamName: r.team, bonus_08: r.b08, bonus_10: v })} />
                        <td className="px-3 py-2 tabular-nums text-center">{r.bTP}</td>
                        <td className="px-3 py-2 tabular-nums font-bold text-center">{formatPts(r.Pts)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}



            <h2 className="text-sm font-bold uppercase tracking-widest mb-2">Results</h2>
            <div className="bg-white border divide-y">
              {matches.map((m) => (
                <div key={m.id} className="px-3 py-2 grid grid-cols-[110px_1fr_auto_1fr_auto] gap-3 items-center text-sm">
                  <div className="text-xs text-muted-foreground">
                    <div>{m.date || new Date(m.finishedAt).toISOString().slice(0, 10)}</div>
                    {m.competition && (
                      <div className={`text-[10px] uppercase tracking-wider font-semibold ${isCup(m.competition) ? "text-accent-red" : "text-muted-foreground"}`}>
                        {m.competition}{isCup(m.competition) ? " · Cup" : ""}
                      </div>
                    )}
                  </div>
                  <div className="text-right font-semibold">{m.team1Name}</div>
                  <div className="font-bold tabular-nums px-3 text-center">
                    <div>{m.score1} : {m.score2}</div>
                    {m.shootout1 != null && m.shootout2 != null && (
                      <div className="text-[10px] font-normal text-muted-foreground">pens {m.shootout1}-{m.shootout2}</div>
                    )}
                  </div>
                  <div className="font-semibold">{m.team2Name}</div>
                  <div className="flex items-center gap-3">
                    <MatchReportLinks matchId={m.id} />
                    <button onClick={() => { if (confirm("Delete match?")) delMut.mutate(m.id); }} className="text-muted-foreground hover:text-accent-red"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}

            </div>
          </>
        )}
        <AppFooter variant="light" className="mt-auto" />
      </div>
    </div>
  );
}

function PointsField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  const commit = () => {
    const n = parseFloat(local);
    if (!Number.isFinite(n)) { setLocal(String(value)); return; }
    if (n !== value) onChange(n);
    else setLocal(String(value));
  };
  return (
    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
      {label}
      <input
        type="number"
        step="0.5"
        inputMode="decimal"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="h-9 w-20 px-2 border border-input rounded-md text-sm bg-white text-center tabular-nums shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
      />
    </label>
  );
}


function BonusCell({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  const commit = () => {
    const n = parseFloat(String(local).trim().replace(",", "."));
    if (!Number.isFinite(n)) { setLocal(String(value)); return; }
    if (n !== value) onCommit(n);
    else setLocal(String(value));
  };
  return (
    <td className="px-2 py-1 text-center">
      <input
        type="number"
        step="0.5"
        inputMode="decimal"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="h-8 w-14 px-2 border border-input rounded-md text-sm bg-white text-center tabular-nums shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
      />
    </td>
  );
}
