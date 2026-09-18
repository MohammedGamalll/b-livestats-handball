import { createFileRoute } from "@tanstack/react-router";
import { useGameStore, type TeamSetup } from "@/lib/gameStore";
import { COACH_ROLES } from "@/lib/handball";
import { ColorPicker } from "@/components/ColorPicker";
import { User, Download, Upload, BookmarkPlus, Library } from "lucide-react";
import { SetupPanel, SectionTitle } from "@/components/SetupPanel";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listTeams, saveTeam, deleteTeam } from "@/lib/db.functions";

export const Route = createFileRoute("/setup/teams")({
  component: TeamsPage,
});

function downloadTeamJson(team: TeamSetup, n: 1 | 2) {
  const data = JSON.stringify(team, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = (team.name || `team-${n}`).replace(/[^a-z0-9_-]+/gi, "_");
  a.href = url;
  a.download = `${safeName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function TeamCard({ n }: { n: 1 | 2 }) {
  const team = useGameStore((s) => (n === 1 ? s.team1 : s.team2));
  const setTeam = useGameStore((s) => s.setTeam);
  const setCoach = useGameStore((s) => s.setCoach);
  const qc = useQueryClient();
  const { data: savedTeams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => listTeams(),
  });
  const saveMut = useMutation({
    mutationFn: (t: {
      name: string;
      shortName?: string;
      color?: string;
      coaches?: TeamSetup["coaches"];
      players: TeamSetup["players"];
    }) => saveTeam({ data: t }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teams"] }),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteTeam({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teams"] }),
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const saveToLibrary = async () => {
    if (!team.name.trim()) { alert("Set a team name first."); return; }
    try {
      await saveMut.mutateAsync({
        name: team.name,
        shortName: team.shortName,
        color: team.color,
        coaches: team.coaches,
        players: team.players,
      });
      alert(`Saved "${team.name}" to team library.`);
    } catch (e) {
      alert("Failed to save: " + (e as Error).message);
    }
  };
  const loadFromLibrary = (id: string) => {
    const t = savedTeams.find((x) => x.id === id);
    if (!t) return;
    setTeam(n, {
      name: t.name,
      shortName: t.shortName || "",
      color: t.color,
      coaches: t.coaches?.length ? t.coaches.map((c) => ({ ...c })) : undefined,
      players: t.players.map((p) => ({ ...p })),
    });
    setLibraryOpen(false);
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<TeamSetup>;
      if (typeof parsed !== "object" || parsed === null) throw new Error("Invalid file");
      setTeam(n, parsed);
    } catch (err) {
      alert("Failed to load team file: " + (err as Error).message);
    }
  };

  return (
    <div className="bls-panel overflow-hidden">
      <div
        className="px-5 py-3 flex items-center gap-3 border-b border-[color:var(--panel-border)]"
        style={{
          background: `linear-gradient(90deg, ${team.color || "#00a040"}15, transparent 60%)`,
        }}
      >
        <span
          className="h-7 w-7 rounded-md flex items-center justify-center text-white font-bold text-sm shadow"
          style={{ background: team.color || "#00a040" }}
        >
          {n}
        </span>
        <div className="flex-1">
          <div className="text-sm font-semibold tracking-wide">TEAM {n}</div>
          <div className="text-[11px] text-muted-foreground">{team.name || "Unnamed team"}</div>
        </div>
        <button
          type="button"
          onClick={() => downloadTeamJson(team, n)}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-[color:var(--panel-border)] bg-white hover:bg-muted text-black font-semibold"
          title="Save team to JSON file"
        >
          <Download className="h-3.5 w-3.5" /> Save
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-[color:var(--panel-border)] bg-white hover:bg-muted text-black font-semibold"
          title="Upload team JSON file"
        >
          <Upload className="h-3.5 w-3.5" /> Upload
        </button>
        <button
          type="button"
          onClick={saveToLibrary}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-[color:var(--panel-border)] bg-white hover:bg-muted text-black font-semibold"
          title="Save this team (with roster) to reuse later"
        >
          <BookmarkPlus className="h-3.5 w-3.5" /> Save Team
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setLibraryOpen((o) => !o)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-[color:var(--panel-border)] bg-white hover:bg-muted text-black font-semibold"
            title="Load a saved team"
          >
            <Library className="h-3.5 w-3.5" /> Library ({savedTeams.length})
          </button>
          {libraryOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-white border shadow-lg min-w-[220px] max-h-64 overflow-auto">
              {savedTeams.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">No saved teams yet</div>
              ) : savedTeams.map((t) => (
                <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 border-b last:border-b-0 hover:bg-muted">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ background: t.color }} />
                  <button className="flex-1 text-left text-xs font-semibold" onClick={() => loadFromLibrary(t.id)}>{t.name}</button>
                  <button className="text-[10px] text-accent-red hover:underline" onClick={() => { if (confirm(`Remove "${t.name}" from library?`)) delMut.mutate(t.id); }}>del</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onUpload}
        />
      </div>
      <div className="p-5 space-y-6">
        <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-3 items-center">
          <label className="text-sm text-right text-black font-bold border-2 border-black rounded px-2 py-1 bg-white flex items-center justify-end"><span className="text-accent-red mr-0.5">*</span>Name</label>
          <input className="bls-input" value={team.name} onChange={(e) => setTeam(n, { name: e.target.value })} />
          <label className="text-sm text-right text-black font-bold border-2 border-black rounded px-2 py-1 bg-white flex items-center justify-end"><span className="text-accent-red mr-0.5">*</span>Short Name</label>
          <input className="bls-input" value={team.shortName} onChange={(e) => setTeam(n, { shortName: e.target.value })} />


          <label className="text-sm text-right text-black font-bold border-2 border-black rounded px-2 py-1 bg-white flex items-center justify-end col-span-3 justify-self-end"><span className="text-accent-red mr-0.5">*</span>Team Color</label>
          <ColorPicker value={team.color} onChange={(c) => setTeam(n, { color: c })} />
        </div>

        <div>
          <SectionTitle>Coaching Staff</SectionTitle>
          <div className="mt-3 space-y-2">
            {team.coaches.map((c, i) => (
              <div key={i} className="flex items-stretch border border-[color:var(--panel-border)] rounded-md overflow-hidden bg-white">
                <input placeholder="NAME" className="flex-1 px-3 py-2 text-sm text-black font-bold border-r border-[color:var(--panel-border)] focus:outline-none focus:bg-[color:var(--surface)]/60" value={c.name} onChange={(e) => setCoach(n, i, { name: e.target.value })} />
                <input placeholder="SURNAME" className="flex-1 px-3 py-2 text-sm text-black font-bold border-r border-[color:var(--panel-border)] focus:outline-none focus:bg-[color:var(--surface)]/60" value={c.surname} onChange={(e) => setCoach(n, i, { surname: e.target.value })} />
                <div className="flex-1 border-r border-[color:var(--panel-border)] px-3 py-1">
                  <div className="text-[10px] uppercase text-black font-bold tracking-wider">Role</div>
                  <select className="w-full text-sm bg-transparent outline-none font-medium text-brand-green" value={c.role} onChange={(e) => setCoach(n, i, { role: e.target.value })}>
                    {COACH_ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <input placeholder="COUNTRY" className="flex-1 px-3 py-2 text-sm text-black font-bold border-r border-[color:var(--panel-border)] focus:outline-none focus:bg-[color:var(--surface)]/60" value={c.country} onChange={(e) => setCoach(n, i, { country: e.target.value })} />
                <button className="w-20 bg-[color:var(--surface)] flex flex-col items-center justify-center text-[10px] text-muted-foreground hover:bg-muted">
                  <User className="h-4 w-4" /> More
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamsPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-lg font-semibold tracking-tight">Configure both teams</h2>
        <p className="text-xs text-accent-red mt-1">*Denotes mandatory fields</p>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <TeamCard n={1} />
        <TeamCard n={2} />
      </div>
    </div>
  );
}
