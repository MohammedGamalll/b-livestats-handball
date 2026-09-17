import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { useGameStore } from "@/lib/gameStore";

const TABS = [
  { to: "/setup/system-check", label: "System Check" },
  { to: "/setup/game-info", label: "Game Information" },
  { to: "/setup/teams", label: "Teams" },
  { to: "/setup/players", label: "Players" },
] as const;

export function WizardTabs() {
  const loc = useLocation();
  const nav = useNavigate();
  const reset = useGameStore((s) => s.reset);
  const setSetupComplete = useGameStore((s) => s.setSetupComplete);

  const currentIdx = TABS.findIndex((t) => loc.pathname.startsWith(t.to));
  const isLast = currentIdx === TABS.length - 1;

  const handleNext = () => {
    if (isLast) {
      setSetupComplete(true);
      nav({ to: "/game" });
    } else {
      nav({ to: TABS[currentIdx + 1].to });
    }
  };
  const handleDiscard = () => {
    if (confirm("Discard all setup data?")) {
      reset();
      nav({ to: "/" });
    }
  };

  return (
    <div className="flex h-12 bg-tabbar border-b border-border">
      <div className="flex flex-1">
        {TABS.map((t, i) => {
          const active = i === currentIdx;
          const done = i < currentIdx;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`relative flex-1 flex items-center justify-center text-sm font-medium transition-colors ${
                active
                  ? "bg-white text-foreground"
                  : done
                  ? "bg-tabbar text-foreground/80 hover:bg-white/50"
                  : "bg-tabbar text-muted-foreground/70 hover:bg-white/30"
              }`}
            >
              <span
                className={`absolute top-0 left-0 right-0 h-1 ${
                  done ? "bg-tab-done" : active ? "bg-tab-current" : "bg-transparent"
                }`}
              />
              {t.label}
            </Link>
          );
        })}
      </div>
      <button
        onClick={handleDiscard}
        className="px-6 bg-[oklch(0.25_0.02_260)] text-white text-sm font-medium flex items-center gap-3 hover:bg-[oklch(0.3_0.02_260)]"
      >
        Discard &amp; Close
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15">
          <X className="h-3 w-3" />
        </span>
      </button>
      <button
        onClick={handleNext}
        className="px-6 bg-muted text-foreground text-sm font-medium flex items-center gap-3 hover:bg-muted/70"
      >
        {isLast ? "Save & Confirm" : "Save & Next"}
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-orange text-white">
          <Check className="h-3 w-3" />
        </span>
      </button>
    </div>
  );
}
