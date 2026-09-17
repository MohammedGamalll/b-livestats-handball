import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { SetupPanel } from "@/components/SetupPanel";

export const Route = createFileRoute("/setup/system-check")({
  component: SystemCheck,
});

function SystemCheck() {
  const checks = [
    "Operating System",
    "Display Resolution",
    "Local Storage Available",
    "Browser Compatibility",
    "Network Status",
  ];
  return (
    <div className="max-w-3xl mx-auto">
      <SetupPanel
        title="System Check"
        subtitle="All items should pass before continuing"
      >
        <div className="divide-y divide-[color:var(--panel-border)] border border-[color:var(--panel-border)] rounded-md overflow-hidden">
          {checks.map((c, i) => (
            <div
              key={c}
              className={`flex items-center justify-between px-6 py-4 ${i % 2 === 1 ? "bg-[color:var(--surface)]/60" : "bg-white"}`}
            >
              <span className="font-medium text-foreground">{c}</span>
              <span className="flex items-center gap-2 text-tab-done font-semibold text-sm">
                <CheckCircle2 className="h-5 w-5" /> OK
              </span>
            </div>
          ))}
        </div>
      </SetupPanel>
    </div>
  );
}
