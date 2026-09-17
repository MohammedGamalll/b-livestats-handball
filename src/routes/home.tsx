import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useGameStore } from "@/lib/gameStore";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [{ title: "B LiveStats — Menu" }],
  }),
  component: HomeMenu,
});

function HomeMenu() {
  const nav = useNavigate();
  const reset = useGameStore((s) => s.reset);
  const setupComplete = useGameStore((s) => s.setupComplete);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black px-6 animate-fade-in">
      <div className="w-full max-w-md flex flex-col gap-3">
        <button
          onClick={() => { reset(); nav({ to: "/setup/system-check" }); }}
          className="h-14 rounded font-bold tracking-wide text-white hover:opacity-90 animate-fade-in"
          style={{ background: "#00a040", animationDelay: "60ms" }}
        >
          NEW GAME
        </button>

        {setupComplete && (
          <button
            onClick={() => nav({ to: "/game" })}
            className="h-14 rounded border-2 font-bold tracking-wide hover:bg-[#e00000]/10 animate-fade-in"
            style={{ borderColor: "#e00000", color: "#e00000", animationDelay: "120ms" }}
          >
            RESUME GAME ▶
          </button>
        )}

        <button
          onClick={() => nav({ to: "/standings" })}
          className="h-14 rounded font-bold tracking-wide text-white hover:opacity-90 animate-fade-in"
          style={{ background: "#00a040", animationDelay: "180ms" }}
        >
          STANDINGS
        </button>

        <button
          onClick={() => nav({ to: "/players" })}
          className="h-14 rounded font-bold tracking-wide text-white hover:opacity-90 animate-fade-in"
          style={{ background: "#2563eb", animationDelay: "240ms" }}
        >
          PLAYERS
        </button>

        <button
          onClick={() => nav({ to: "/season" })}
          className="h-14 rounded font-bold tracking-wide text-white hover:opacity-90 animate-fade-in"
          style={{ background: "#f97316", animationDelay: "300ms" }}
        >
          BOX SCORE — SEASON
        </button>

        <button
          onClick={() => nav({ to: "/reports" })}
          className="h-14 rounded font-bold tracking-wide text-white hover:opacity-90 animate-fade-in"
          style={{ background: "#7c3aed", animationDelay: "330ms" }}
        >
          REPORT
        </button>

        <button
          onClick={() => nav({ to: "/settings" })}
          className="h-14 rounded font-bold tracking-wide text-white hover:opacity-90 animate-fade-in"
          style={{ background: "#111827", animationDelay: "360ms" }}
        >
          SETTINGS
        </button>
      </div>
    </div>
  );
}
