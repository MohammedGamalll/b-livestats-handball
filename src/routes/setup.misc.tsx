import { createFileRoute } from "@tanstack/react-router";
import { useGameStore } from "@/lib/gameStore";
import { HandballCourt } from "@/components/HandballCourt";
import { ArrowLeftRight } from "lucide-react";
import { SetupPanel, SectionTitle } from "@/components/SetupPanel";

export const Route = createFileRoute("/setup/misc")({
  component: MiscPage,
});

function MiscPage() {
  const team1 = useGameStore((s) => s.team1);
  const team2 = useGameStore((s) => s.team2);
  const homeIsTeam1 = useGameStore((s) => s.homeIsTeam1);
  const switchSides = useGameStore((s) => s.switchSides);
  const switchHomeAway = useGameStore((s) => s.switchHomeAway);

  const home = homeIsTeam1 ? team1 : team2;
  const away = homeIsTeam1 ? team2 : team1;

  return (
    <SetupPanel
      title="Misc Configuration"
      subtitle="Choose shooting direction and confirm home / away assignment."
    >
      <div className="space-y-10">
        <div>
          <SectionTitle>Shooting Direction</SectionTitle>
          <div className="mt-5 relative rounded-xl overflow-hidden border border-[color:var(--panel-border)] bg-[color:var(--surface)]/60 p-4">
            <HandballCourt className="w-full" />
            <button
              onClick={switchSides}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-20 w-20 rounded-full bg-topbar text-white flex flex-col items-center justify-center text-[10px] font-semibold shadow-lg ring-4 ring-white/60 hover:bg-brand-green transition-colors"
            >
              <ArrowLeftRight className="h-6 w-6 mb-0.5" /> Switch
            </button>
          </div>
        </div>

        <div>
          <SectionTitle>Home &amp; Away</SectionTitle>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-6 rounded-xl border border-[color:var(--panel-border)] bg-white p-6">
            <TeamSide team={home} label="HOME" align="left" />
            <button
              onClick={switchHomeAway}
              className="h-16 w-16 rounded-full bg-topbar text-white flex flex-col items-center justify-center text-[10px] font-semibold shadow hover:bg-brand-green transition-colors"
            >
              <ArrowLeftRight className="h-5 w-5 mb-0.5" /> Switch
            </button>
            <TeamSide team={away} label="AWAY" align="right" />
          </div>
        </div>
      </div>
    </SetupPanel>
  );
}

function TeamSide({ team, label, align }: { team: any; label: string; align: "left" | "right" }) {
  return (
    <div className={`flex items-center gap-3 ${align === "right" ? "justify-end" : ""}`}>
      <span className="block w-2 h-12 rounded-full" style={{ background: team.color || "#00a040" }} />
      <div>
        <div className="text-lg font-bold tracking-wide">
          {team.shortCode || team.name?.slice(0, 3).toUpperCase() || "—"}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
