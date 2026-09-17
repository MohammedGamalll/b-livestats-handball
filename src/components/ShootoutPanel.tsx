import { useGameStore } from "@/lib/gameStore";

interface Props { open: boolean; onClose: () => void; onFinish?: () => void }

export function ShootoutPanel({ open, onClose, onFinish }: Props) {

  const team1 = useGameStore((s) => s.team1);
  const team2 = useGameStore((s) => s.team2);
  const score1 = useGameStore((s) => s.score1);
  const score2 = useGameStore((s) => s.score2);
  const shootoutRounds = useGameStore((s) => s.shootoutRounds);
  const setShootoutRound = useGameStore((s) => s.setShootoutRound);
  const setShootoutPlayer = useGameStore((s) => s.setShootoutPlayer);
  const addShootoutRound = useGameStore((s) => s.addShootoutRound);
  const removeShootoutRound = useGameStore((s) => s.removeShootoutRound);

  if (!open) return null;

  const goals1 = shootoutRounds.reduce((a, r) => a + (r.t1 === "G" ? 1 : 0), 0);
  const goals2 = shootoutRounds.reduce((a, r) => a + (r.t2 === "G" ? 1 : 0), 0);

  const players1 = team1.players.filter((p) => p.no);
  const players2 = team2.players.filter((p) => p.no);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-[760px] max-w-full max-h-[90vh] overflow-auto">
        <div className="bg-accent-red text-white px-4 py-2 font-bold uppercase tracking-wider text-sm flex justify-between items-center sticky top-0">
          <span>Penalty Shootout (7-Meter)</span>
          <button onClick={onClose} className="text-white">✕</button>
        </div>
        <div className="p-4">
          <div className="flex justify-between mb-3 text-xl font-bold">
            <div style={{ color: team1.color }}>{team1.name || "Team 1"} <span className="font-mono ml-2">{score1}+{goals1}</span></div>
            <div style={{ color: team2.color }}>{team2.name || "Team 2"} <span className="font-mono ml-2">{score2}+{goals2}</span></div>
          </div>
          <table className="w-full text-center text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="py-1 w-8">#</th>
                <th>{team1.shortCode || "T1"}</th>
                <th>{team2.shortCode || "T2"}</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {shootoutRounds.map((r, i) => (
                <tr key={i} className="border-b align-middle">
                  <td className="py-2 font-mono">{i + 1}</td>
                  <td className="py-2">
                    <div className="flex flex-col items-center gap-1">
                      <select
                        value={r.t1Player ?? ""}
                        onChange={(e) => setShootoutPlayer(i, "t1", e.target.value)}
                        className="text-xs border px-1 py-1 w-40"
                      >
                        <option value="">— Shooter —</option>
                        {players1.map((p) => (
                          <option key={p.id} value={p.no}>#{p.no} {p.name} {p.surname}</option>
                        ))}
                      </select>
                      <div>
                        <button onClick={() => setShootoutRound(i, "t1", "G")} className={`mx-1 px-2 py-1 rounded text-xs font-bold ${r.t1 === "G" ? "bg-tab-done text-white" : "bg-muted"}`}>GOAL</button>
                        <button onClick={() => setShootoutRound(i, "t1", "M")} className={`mx-1 px-2 py-1 rounded text-xs font-bold ${r.t1 === "M" ? "bg-accent-red text-white" : "bg-muted"}`}>MISS</button>
                      </div>
                    </div>
                  </td>
                  <td className="py-2">
                    <div className="flex flex-col items-center gap-1">
                      <select
                        value={r.t2Player ?? ""}
                        onChange={(e) => setShootoutPlayer(i, "t2", e.target.value)}
                        className="text-xs border px-1 py-1 w-40"
                      >
                        <option value="">— Shooter —</option>
                        {players2.map((p) => (
                          <option key={p.id} value={p.no}>#{p.no} {p.name} {p.surname}</option>
                        ))}
                      </select>
                      <div>
                        <button onClick={() => setShootoutRound(i, "t2", "G")} className={`mx-1 px-2 py-1 rounded text-xs font-bold ${r.t2 === "G" ? "bg-tab-done text-white" : "bg-muted"}`}>GOAL</button>
                        <button onClick={() => setShootoutRound(i, "t2", "M")} className={`mx-1 px-2 py-1 rounded text-xs font-bold ${r.t2 === "M" ? "bg-accent-red text-white" : "bg-muted"}`}>MISS</button>
                      </div>
                    </div>
                  </td>
                  <td>
                    <button onClick={() => removeShootoutRound(i)} className="text-muted-foreground hover:text-accent-red text-lg" title="Remove round">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between items-center mt-4 gap-3">
            <button onClick={addShootoutRound} className="px-3 py-2 bg-muted text-xs font-bold uppercase">+ Add Round</button>
            <div className="text-sm font-bold flex-1 text-center">
              {goals1 !== goals2 && shootoutRounds.length > 0 && (
                <span style={{ color: (goals1 > goals2 ? team1.color : team2.color) }}>
                  Winner: {goals1 > goals2 ? (team1.name || "Team 1") : (team2.name || "Team 2")} ({score1 + goals1} - {score2 + goals2})
                </span>
              )}
            </div>
            {onFinish && (
              <button
                onClick={onFinish}
                disabled={shootoutRounds.length === 0 || goals1 === goals2}
                className="px-4 py-2 bg-tab-done text-white text-xs font-bold uppercase disabled:opacity-40"
              >
                End Game &amp; Save
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
