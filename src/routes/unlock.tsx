import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { unlockSite } from "@/lib/gate.functions";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/unlock")({
  component: UnlockPage,
});

function UnlockPage() {
  const unlock = unlockSite;
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      const res = await unlock({ data: { password: pw } });
      if (res.ok) {
        window.location.replace("/");
      } else {
        setErr(res.error || "Incorrect password.");
      }
    } catch {
      setErr("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[oklch(0.15_0.02_260)] p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white shadow-2xl rounded-lg p-8">
        <div className="flex items-center justify-center h-14 w-14 rounded-full bg-black mx-auto mb-4">
          <Lock className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-center tracking-wide">B LIVE-STATS</h1>
        <p className="text-sm text-center text-muted-foreground mt-1 mb-6">
          Enter the shared access password to continue.
        </p>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Password"
          className="w-full h-11 px-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
        {err && <div className="text-xs text-red-600 mt-2">{err}</div>}
        <button
          type="submit"
          disabled={loading || !pw}
          className="mt-4 w-full h-11 bg-black text-white text-sm font-bold uppercase tracking-wider rounded-md disabled:opacity-50"
        >
          {loading ? "Unlocking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
