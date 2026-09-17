import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";


interface BracketTeam { name: string; seed: number }
interface BracketMatch {
  id: string;
  round: number;
  pos: number; // 0..n in round
  teamA: BracketTeam | null;
  teamB: BracketTeam | null;
  scoreA: string;
  scoreB: string;
  winner: "A" | "B" | null;
}

interface BracketState {
  teams: string[];
  matches: BracketMatch[];
}

const STORAGE_KEY = "b-livestats-bracket";

const loadBracket = (): BracketState => {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) return JSON.parse(raw);
  } catch {}
  return { teams: [], matches: [] };
};

const saveBracket = (b: BracketState) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(b)); } catch {}
};

function buildBracket(teamNames: string[]): BracketMatch[] {
  const cleaned = teamNames.filter((t) => t.trim());
  if (cleaned.length < 2) return [];
  // Round up to next power of 2 with BYEs
  let size = 1;
  while (size < cleaned.length) size *= 2;
  const seeded: (BracketTeam | null)[] = cleaned.map((name, i) => ({ name, seed: i + 1 }));
  while (seeded.length < size) seeded.push(null);

  const matches: BracketMatch[] = [];
  const rounds = Math.log2(size);
  // First round
  for (let i = 0; i < size; i += 2) {
    matches.push({
      id: `r0-m${i / 2}`,
      round: 0,
      pos: i / 2,
      teamA: seeded[i],
      teamB: seeded[i + 1],
      scoreA: "",
      scoreB: "",
      winner: seeded[i] && !seeded[i + 1] ? "A" : !seeded[i] && seeded[i + 1] ? "B" : null,
    });
  }
  // Subsequent rounds (empty)
  for (let r = 1; r < rounds; r++) {
    const count = size / Math.pow(2, r + 1);
    for (let m = 0; m < count; m++) {
      matches.push({
        id: `r${r}-m${m}`,
        round: r,
        pos: m,
        teamA: null,
        teamB: null,
        scoreA: "",
        scoreB: "",
        winner: null,
      });
    }
  }
  return propagateWinners(matches);
}

function propagateWinners(matches: BracketMatch[]): BracketMatch[] {
  const byRound: Record<number, BracketMatch[]> = {};
  matches.forEach((m) => {
    byRound[m.round] = byRound[m.round] || [];
    byRound[m.round].push(m);
  });
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);
  for (let i = 0; i < rounds.length - 1; i++) {
    const cur = byRound[rounds[i]].sort((a, b) => a.pos - b.pos);
    const next = byRound[rounds[i + 1]].sort((a, b) => a.pos - b.pos);
    next.forEach((nm) => {
      const left = cur[nm.pos * 2];
      const right = cur[nm.pos * 2 + 1];
      const lw = left?.winner === "A" ? left.teamA : left?.winner === "B" ? left.teamB : null;
      const rw = right?.winner === "A" ? right.teamA : right?.winner === "B" ? right.teamB : null;
      nm.teamA = lw;
      nm.teamB = rw;
      if (!lw && rw) nm.winner = "B";
      else if (lw && !rw) nm.winner = "A";
    });
  }
  return matches;
}

export const Route = createFileRoute("/bracket")({
  component: BracketPage,
});

function BracketPage() {
  const [state, setState] = useState<BracketState>({ teams: [], matches: [] });
  const [teamInput, setTeamInput] = useState("");

  useEffect(() => { setState(loadBracket()); }, []);
  useEffect(() => { saveBracket(state); }, [state]);

  const addTeam = () => {
    if (!teamInput.trim()) return;
    setState((s) => ({ ...s, teams: [...s.teams, teamInput.trim()] }));
    setTeamInput("");
  };
  const removeTeam = (i: number) => setState((s) => ({ ...s, teams: s.teams.filter((_, idx) => idx !== i) }));
  const generate = () => setState((s) => ({ ...s, matches: buildBracket(s.teams) }));
  const clearAll = () => { if (confirm("Clear bracket and teams?")) setState({ teams: [], matches: [] }); };

  const updateMatch = (id: string, patch: Partial<BracketMatch>) => {
    setState((s) => {
      const matches = s.matches.map((m) => (m.id === id ? { ...m, ...patch } : m));
      return { ...s, matches: propagateWinners(matches) };
    });
  };

  const rounds = state.matches.reduce<Record<number, BracketMatch[]>>((acc, m) => {
    (acc[m.round] = acc[m.round] || []).push(m);
    return acc;
  }, {});
  const roundKeys = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  const roundLabels = ["R64", "R32", "R16", "Quarter", "Semi", "Final", "Champion"];
  const labelFor = (r: number) => {
    const total = roundKeys.length;
    const fromEnd = total - 1 - r;
    if (fromEnd === 0) return "Final";
    if (fromEnd === 1) return "Semi-Final";
    if (fromEnd === 2) return "Quarter-Final";
    return roundLabels[r] || `Round ${r + 1}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.97_0.005_260)] p-6">
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-wide uppercase">Knockout Bracket</h1>
            <p className="text-xs text-muted-foreground">Single-elimination handball tournament</p>
          </div>
          <div className="flex gap-2">
            <Link to="/" className="h-9 px-3 bg-topbar text-white text-xs font-bold uppercase flex items-center gap-2"><ArrowLeft className="h-4 w-4" /> Home</Link>
            <Link to="/standings" className="h-9 px-3 bg-muted text-xs font-bold uppercase flex items-center">Group Standings</Link>
            {state.matches.length > 0 && (
              <button onClick={clearAll} className="h-9 px-3 bg-accent-red text-white text-xs font-bold uppercase">Clear</button>
            )}
          </div>
        </div>

        {/* Team manager */}
        <div className="bg-white border p-4 mb-6">
          <div className="text-xs font-bold uppercase tracking-widest mb-2">Teams ({state.teams.length})</div>
          <div className="flex gap-2 mb-3">
            <input
              value={teamInput}
              onChange={(e) => setTeamInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTeam()}
              placeholder="Add team name…"
              className="flex-1 h-9 px-3 border text-sm"
            />
            <button onClick={addTeam} className="h-9 px-4 bg-tab-done text-white text-xs font-bold uppercase">Add</button>
            <button onClick={generate} disabled={state.teams.length < 2} className="h-9 px-4 bg-accent-orange text-white text-xs font-bold uppercase disabled:opacity-40">Generate Bracket</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {state.teams.map((t, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1 bg-muted text-sm rounded">
                <span className="text-muted-foreground text-xs">#{i + 1}</span>
                <span>{t}</span>
                <button onClick={() => removeTeam(i)} className="text-muted-foreground hover:text-accent-red"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
            {state.teams.length === 0 && <div className="text-xs text-muted-foreground">Add at least 2 teams to generate a bracket.</div>}
          </div>
        </div>

        {state.matches.length > 0 && (
          <div className="overflow-x-auto">
            <div className="flex gap-8 min-w-fit">
              {roundKeys.map((r) => (
                <div key={r} className="flex flex-col justify-around gap-3 min-w-[220px]">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground text-center">{labelFor(r)}</div>
                  {rounds[r].sort((a, b) => a.pos - b.pos).map((m) => (
                    <MatchCard key={m.id} match={m} onUpdate={(p) => updateMatch(m.id, p)} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <AppFooter variant="light" className="mt-auto" />
    </div>
  );
}



function MatchCard({ match, onUpdate }: { match: BracketMatch; onUpdate: (p: Partial<BracketMatch>) => void }) {
  const setScore = (side: "A" | "B", v: string) => {
    const patch: Partial<BracketMatch> = side === "A" ? { scoreA: v } : { scoreB: v };
    onUpdate(patch);
  };
  const decide = () => {
    const a = parseInt(match.scoreA);
    const b = parseInt(match.scoreB);
    if (isNaN(a) || isNaN(b) || a === b) return;
    onUpdate({ winner: a > b ? "A" : "B" });
  };
  return (
    <div className="bg-white border rounded shadow-sm">
      <Side
        team={match.teamA}
        score={match.scoreA}
        winner={match.winner === "A"}
        onScore={(v) => setScore("A", v)}
        onBlur={decide}
        disabled={!match.teamA}
      />
      <div className="border-t" />
      <Side
        team={match.teamB}
        score={match.scoreB}
        winner={match.winner === "B"}
        onScore={(v) => setScore("B", v)}
        onBlur={decide}
        disabled={!match.teamB}
      />
    </div>
  );
}

function Side({ team, score, winner, onScore, onBlur, disabled }: { team: BracketTeam | null; score: string; winner: boolean; onScore: (v: string) => void; onBlur: () => void; disabled: boolean }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 text-sm ${winner ? "bg-tab-done/15 font-bold" : ""} ${disabled ? "text-muted-foreground" : ""}`}>
      <div className="flex items-center gap-2 truncate">
        {team ? (
          <>
            <span className="text-[10px] text-muted-foreground w-4">#{team.seed}</span>
            <span className="truncate">{team.name}</span>
          </>
        ) : (
          <span className="italic">TBD</span>
        )}
      </div>
      <input
        value={score}
        onChange={(e) => onScore(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={onBlur}
        disabled={disabled}
        className="w-10 text-right border h-7 px-1 text-sm tabular-nums disabled:bg-transparent disabled:border-transparent"
      />
    </div>
  );
}
