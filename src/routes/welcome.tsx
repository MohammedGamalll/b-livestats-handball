import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FolderUp, Sparkles, AlertTriangle } from "lucide-react";
import { markOnboardingComplete } from "@/lib/db.functions";
import { RestoreConfirmDialog, useRestoreBackup } from "@/components/RestoreConfirmDialog";

export const Route = createFileRoute("/welcome")({
  head: () => ({ meta: [{ title: "Welcome — B LiveStats" }] }),
  component: WelcomePage,
});

function WelcomePage() {
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const restore = useRestoreBackup((message) => setError(message));

  const startFresh = async () => {
    setStarting(true);
    setError(null);
    try {
      await markOnboardingComplete();
      nav({ to: "/home" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a new system.");
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black px-6">
      <div className="w-full max-w-xl">
        <h1 className="text-3xl font-bold tracking-wide text-white text-center uppercase">Welcome</h1>
        <p className="text-sm text-white/70 text-center mt-2 mb-8">
          No matches or players were found. Start a new system, or restore a previous backup.
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={startFresh}
            disabled={starting}
            className="h-16 rounded font-bold tracking-wide text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-3"
            style={{ background: "#00a040" }}
          >
            <Sparkles className="h-5 w-5" />
            {starting ? "Starting…" : "Start Fresh (New System)"}
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              restore.setOpen(true);
            }}
            className="h-16 rounded border-2 font-bold tracking-wide hover:bg-white/5 flex items-center justify-center gap-3"
            style={{ borderColor: "#e00000", color: "#e00000" }}
          >
            <FolderUp className="h-5 w-5" />
            Restore from Backup
          </button>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-400 flex items-start gap-2 justify-center">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </p>
        )}
      </div>

      <RestoreConfirmDialog
        open={restore.open}
        onOpenChange={restore.setOpen}
        onConfirm={restore.runRestore}
        loading={restore.loading}
        description="This will load the selected backup, overwrite the empty database, and restart the app. Continue?"
      />
    </div>
  );
}
