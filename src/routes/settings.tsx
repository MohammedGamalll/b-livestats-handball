import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  DatabaseBackup,
  FolderDown,
  FolderUp,
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
  Download,
  RotateCcw,
} from "lucide-react";
import { exportBackup } from "@/lib/db.functions";
import { RestoreConfirmDialog, useRestoreBackup } from "@/components/RestoreConfirmDialog";

type UpdateStatus = {
  configured: boolean;
  version: string;
  state: string;
  message: string;
  updateVersion?: string;
};

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — B LiveStats" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [appVersion, setAppVersion] = useState<string>("");
  const [update, setUpdate] = useState<UpdateStatus | null>(null);
  const restore = useRestoreBackup((message) => setError(message));
  const api = typeof window !== "undefined" ? window.electronAPI : undefined;

  useEffect(() => {
    if (!api) return;
    void api.getAppVersion().then(setAppVersion);
    void api.getUpdateStatus().then(setUpdate);
    return api.onUpdateEvent((payload) => setUpdate(payload));
  }, [api]);

  const onExport = async () => {
    setError(null);
    setStatus(null);
    setExporting(true);
    try {
      const res = await exportBackup();
      if (res.canceled) return;
      if (!res.ok) {
        setError(res.error || "Backup failed.");
        return;
      }
      setStatus(res.filePath ? `Backup saved to ${res.filePath}` : "Backup saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup failed.");
    } finally {
      setExporting(false);
    }
  };

  const busy = update?.state === "checking" || update?.state === "downloading";

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.97_0.005_260)] p-6">
      <div className="max-w-2xl mx-auto w-full space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-wide uppercase">Settings</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Backup, restore, and app updates{appVersion ? ` · v${appVersion}` : ""}
            </p>
          </div>
          <Link
            to="/home"
            className="h-9 px-3 bg-black text-white text-xs font-bold uppercase flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </div>

        {api && (
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-full bg-black text-white flex items-center justify-center">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">App updates</h2>
                <p className="text-sm text-muted-foreground">
                  {update?.message || "Check GitHub Releases for a newer installer."}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={busy || !update?.configured}
                onClick={() => void api.checkForUpdates()}
                className="h-12 px-4 rounded-md bg-black text-white font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
                Check for updates
              </button>
              {update?.state === "available" && (
                <button
                  type="button"
                  onClick={() => void api.downloadUpdate()}
                  className="h-12 px-4 rounded-md bg-[#00a040] text-white font-bold uppercase tracking-wide hover:opacity-90 flex items-center justify-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download {update.updateVersion}
                </button>
              )}
              {update?.state === "ready" && (
                <button
                  type="button"
                  onClick={() => void api.installUpdate()}
                  className="h-12 px-4 rounded-md bg-[#00a040] text-white font-bold uppercase tracking-wide hover:opacity-90 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Restart and install
                </button>
              )}
            </div>
          </div>
        )}

        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-11 w-11 rounded-full bg-black text-white flex items-center justify-center">
              <DatabaseBackup className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Database backup</h2>
              <p className="text-sm text-muted-foreground">
                Save a complete copy of the local SQLite file, or replace it from a previous backup.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onExport}
              disabled={exporting}
              className="h-12 px-4 rounded-md bg-[#00a040] text-white font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <FolderDown className="h-4 w-4" />
              {exporting ? "Saving…" : "Backup Database"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStatus(null);
                restore.setOpen(true);
              }}
              className="h-12 px-4 rounded-md border-2 font-bold uppercase tracking-wide hover:bg-[#e00000]/10 flex items-center justify-center gap-2"
              style={{ borderColor: "#e00000", color: "#e00000" }}
            >
              <FolderUp className="h-4 w-4" />
              Restore Database
            </button>
          </div>

          {status && <p className="mt-4 text-sm text-green-700">{status}</p>}
          {error && (
            <p className="mt-4 text-sm text-red-600 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </p>
          )}
        </div>
      </div>

      <RestoreConfirmDialog
        open={restore.open}
        onOpenChange={restore.setOpen}
        onConfirm={restore.runRestore}
        loading={restore.loading}
      />
    </div>
  );
}
