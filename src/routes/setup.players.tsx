import { createFileRoute } from "@tanstack/react-router";
import { useGameStore, type Player } from "@/lib/gameStore";
import { POSITIONS } from "@/lib/handball";
import { Plus, X, AlertTriangle, Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { SetupPanel } from "@/components/SetupPanel";

export const Route = createFileRoute("/setup/players")({
  component: PlayersPage,
});


function TeamRoster({ n }: { n: 1 | 2 }) {
  const team = useGameStore((s) => (n === 1 ? s.team1 : s.team2));
  const setTeam = useGameStore((s) => s.setTeam);
  const setPlayer = useGameStore((s) => s.setPlayer);
  const addPlayer = useGameStore((s) => s.addPlayer);
  const removePlayer = useGameStore((s) => s.removePlayer);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pickPos, setPickPos] = useState(false);

  const handleAddPlayer = (position: string) => {
    addPlayer(n);
    // The new player is appended last; set its position immediately.
    setTimeout(() => {
      const latest = useGameStore.getState();
      const t = n === 1 ? latest.team1 : latest.team2;
      const last = t.players[t.players.length - 1];
      if (last && position) setPlayer(n, last.id, { position });
    }, 0);
    setPickPos(false);
  };

  const playerCount = team.players.filter((p) => p.playing).length;

  const onSave = () => {
    const data = JSON.stringify({ teamName: team.name, players: team.players }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = (team.name || `team-${n}`).replace(/[^a-z0-9_-]+/gi, "_");
    a.href = url;
    a.download = `${safeName}-roster.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { players?: Player[] } | Player[];
      const incoming = Array.isArray(parsed) ? parsed : parsed.players;
      if (!incoming || !Array.isArray(incoming)) throw new Error("Missing players array");
      const players: Player[] = incoming.map((p) => ({
        id: crypto.randomUUID(),
        no: String(p.no ?? ""),
        name: p.name ?? "",
        surname: p.surname ?? "",
        height: p.height ?? "",
        position: p.position ?? "",
        addInfo: p.addInfo ?? "",
        captain: !!p.captain,
        playing: !!p.playing,
      }));
      setTeam(n, { players });
    } catch (err) {
      alert("Failed to load roster file: " + (err as Error).message);
    }
  };

  return (
    <div className="bls-panel overflow-hidden">
      <div
        className="px-5 py-3 flex items-center justify-between border-b border-[color:var(--panel-border)]"
        style={{ background: `linear-gradient(90deg, ${team.color || "#00a040"}15, transparent 60%)` }}
      >
        <div className="flex items-center gap-3">
          <span
            className="h-7 w-7 rounded-md flex items-center justify-center text-white font-bold text-sm shadow"
            style={{ background: team.color || "#00a040" }}
          >
            {n}
          </span>
          <div>
            <div className="text-sm font-semibold tracking-wide">TEAM {n}</div>
            <div className="text-[11px] text-muted-foreground">{team.name || "Unnamed team"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSave}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-[color:var(--panel-border)] bg-white hover:bg-muted text-black font-semibold"
            title="Save roster to JSON file"
          >
            <Download className="h-3.5 w-3.5" /> Save
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-[color:var(--panel-border)] bg-white hover:bg-muted text-black font-semibold"
            title="Upload roster JSON file"
          >
            <Upload className="h-3.5 w-3.5" /> Upload
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onUpload} />
          <div className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-tab-done/15 text-tab-done">
            {playerCount} player{playerCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="px-4">
        <div className="grid grid-cols-[52px_1.3fr_1.5fr_100px_52px_52px_40px] text-[10px] font-bold uppercase tracking-wider text-black border-b border-[color:var(--panel-border)]">
          <div className="px-2 py-3 text-center">No.</div>
          <div className="px-3 py-3">Name</div>
          <div className="px-3 py-3">Surname</div>
          <div className="px-2 py-3">Position</div>
          <div className="px-2 py-3 text-center">Capt.</div>
          <div className="px-2 py-3 text-center">PLAYING</div>
          <div className="px-2 py-3" />
        </div>
        <div>
          {team.players.map((p, idx) => (
            <div
              key={p.id}
              className={`grid grid-cols-[52px_1.3fr_1.5fr_100px_52px_52px_40px] items-center group transition-colors hover:bg-[color:var(--surface)] ${
                idx % 2 === 1 ? "bg-[color:var(--surface)]/50" : ""
              } ${p.playing ? "border-l-2 border-l-brand-green" : ""}`}
            >
              <input className="h-9 px-2 text-sm bg-transparent text-black font-bold text-center focus:outline-none focus:bg-white" value={p.no} onChange={(e) => setPlayer(n, p.id, { no: e.target.value })} />
              <input className="h-9 px-3 text-sm bg-transparent text-black font-bold focus:outline-none focus:bg-white" value={p.name} onChange={(e) => setPlayer(n, p.id, { name: e.target.value })} />
              <input className="h-9 px-3 text-sm bg-transparent text-black font-bold focus:outline-none focus:bg-white" value={p.surname} onChange={(e) => setPlayer(n, p.id, { surname: e.target.value })} />
              <select className="h-9 px-2 text-sm bg-transparent focus:outline-none focus:bg-white" value={p.position} onChange={(e) => setPlayer(n, p.id, { position: e.target.value })}>
                <option value="">—</option>
                {POSITIONS.map((pos) => <option key={pos}>{pos}</option>)}
              </select>
              <label className="flex items-center justify-center cursor-pointer">
                <input type="checkbox" checked={p.captain} onChange={(e) => setPlayer(n, p.id, { captain: e.target.checked })} className="h-5 w-5 accent-brand-green" />
              </label>
              <label className="flex items-center justify-center cursor-pointer">
                <input type="checkbox" checked={!!p.playing} onChange={(e) => setPlayer(n, p.id, { playing: e.target.checked })} className="h-5 w-5 accent-brand-green" />
              </label>
              <div className="flex items-center justify-center">
                <button onClick={() => removePlayer(n, p.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-accent-red"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setPickPos(true)}
          className="mt-2 mb-3 flex items-center gap-2 px-3 py-2 text-sm text-brand-green font-medium hover:bg-[color:var(--surface)] rounded-md"
        >
          <span className="h-6 w-6 flex items-center justify-center bg-brand-green/10 rounded-md"><Plus className="h-4 w-4" /></span>
          Add Player
        </button>
      </div>
      {pickPos && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPickPos(false)}>
          <div className="bg-white rounded-lg p-5 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: team.color }}>
              Select Position — {team.name || `Team ${n}`}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {POSITIONS.map((pos) => (
                <button
                  key={pos}
                  onClick={() => handleAddPlayer(pos)}
                  className="px-3 py-3 rounded-md border text-sm font-bold hover:text-white transition-colors"
                  style={{ borderColor: team.color }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = team.color)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  {pos}
                </button>
              ))}
              <button onClick={() => handleAddPlayer("")} className="px-3 py-3 rounded-md border text-xs col-span-3 text-muted-foreground hover:bg-muted">
                Skip (no position)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayersPage() {
  const team1 = useGameStore((s) => s.team1);
  const team2 = useGameStore((s) => s.team2);
  const [dismissed, setDismissed] = useState(false);

  const missing: string[] = [];
  if (!team1.players.some((p) => p.captain)) missing.push(team1.shortName || team1.name || "Team 1");
  if (!team2.players.some((p) => p.captain)) missing.push(team2.shortName || team2.name || "Team 2");

  return (
    <SetupPanel
      title="Players"
      subtitle="Add your players and mark the captain. You can drag them onto the starting lineup from the court view."
    >
      {!dismissed && missing.length > 0 && (
        <div className="flex items-center justify-between bg-accent-red/5 border border-accent-red/20 rounded-md px-4 py-3 text-sm mb-5">
          <div className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="h-4 w-4 text-accent-red" />
            No captain set for {missing.join(" and ")}.
          </div>
          <button onClick={() => setDismissed(true)} className="text-xs uppercase tracking-wider flex items-center gap-1 hover:text-accent-red">
            Dismiss <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-6">
        <TeamRoster n={1} />
        <TeamRoster n={2} />
      </div>
    </SetupPanel>
  );
}
