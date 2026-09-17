import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listPlayers } from "@/lib/db.functions";
import { ReportLogo } from "@/components/ReportLogo";
import { AppFooter } from "@/components/AppFooter";
import { ArrowLeft, Search } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/players/")({
  component: PlayersListPage,
});

function PlayersListPage() {
  const { data: players = [], isLoading } = useQuery({
    queryKey: ["players"],
    queryFn: () => listPlayers(),
  });
  const [q, setQ] = useState("");
  const filtered = players.filter((p) => {
    if (!q.trim()) return true;
    const s = `${p.name} ${p.surname} ${p.no} ${p.teamName} ${p.position}`.toLowerCase();
    return s.includes(q.toLowerCase());
  });

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.97_0.005_260)] p-6">
      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-wide uppercase">Players Directory</h1>
            <p className="text-xs text-muted-foreground">All players from every saved match</p>
          </div>
          <div className="flex justify-center"><ReportLogo /></div>
          <div className="flex items-center gap-2 justify-end">
            <Link to="/" className="h-9 px-3 bg-topbar text-white text-xs font-bold uppercase flex items-center gap-2"><ArrowLeft className="h-4 w-4" /> Home</Link>
            <Link to="/standings" className="h-9 px-3 bg-black text-white text-xs font-bold uppercase flex items-center">Standings</Link>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, number, team, or position"
            className="w-full h-10 pl-9 pr-3 border rounded-md text-sm bg-white"
          />
        </div>

        {isLoading ? (
          <div className="bg-white border p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border p-10 text-center text-sm text-muted-foreground">No players yet. Save a match first.</div>
        ) : (
          <div className="bg-white border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-xs">#</th>
                  <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-xs">Player</th>
                  <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-xs">Team</th>
                  <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-xs">Position</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={`${p.teamName}-${p.no}-${i}`} className="border-t hover:bg-muted/50">
                    <td className="px-3 py-2 font-bold tabular-nums">{p.no}</td>
                    <td className="px-3 py-2 font-semibold">{p.name} {p.surname}</td>
                    <td className="px-3 py-2 flex items-center gap-2">
                      <span className="inline-block w-2 h-5" style={{ background: p.teamColor }} />
                      {p.teamName}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{p.position || "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to="/players/$teamName/$playerNo"
                        params={{ teamName: String(p.teamName).trim(), playerNo: String(p.no).trim() }}
                        className="text-xs font-bold uppercase tracking-wider text-accent-orange hover:underline"
                      >
                        View report →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AppFooter variant="light" className="mt-auto" />
      </div>
    </div>
  );
}
