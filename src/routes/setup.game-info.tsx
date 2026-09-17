import { createFileRoute } from "@tanstack/react-router";
import { useGameStore } from "@/lib/gameStore";
import { GAME_TYPES, OFFICIAL_ROLES, COMPETITION_OPTIONS } from "@/lib/handball";
import { User } from "lucide-react";
import { SetupPanel, SectionTitle } from "@/components/SetupPanel";

export const Route = createFileRoute("/setup/game-info")({
  component: GameInfoPage,
});

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <label className="w-32 text-right text-sm text-black font-bold border-2 border-black rounded px-2 py-1 bg-white flex items-center justify-end">
        {required && <span className="text-accent-red mr-0.5">*</span>}
        {label}
      </label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function GameInfoPage() {
  const info = useGameStore((s) => s.info);
  const setInfo = useGameStore((s) => s.setInfo);
  const setOfficial = useGameStore((s) => s.setOfficial);

  return (
    <SetupPanel
      title="Game Information"
      subtitle="Start a new game by entering all information below."
      actions={<span className="text-xs text-accent-red">*Mandatory fields</span>}
    >
      <div className="grid grid-cols-2 gap-x-12 gap-y-5">
        <div className="space-y-4">
          <Field label="Game Number" required>
            <input className="bls-input" value={info.gameNumber} onChange={(e) => setInfo({ gameNumber: e.target.value })} />
          </Field>
          <Field label="Competition" required>
            <select className="bls-input" value={info.competition} onChange={(e) => setInfo({ competition: e.target.value })}>
              <option value="">— Select —</option>
              {COMPETITION_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Season">
            <input className="bls-input" placeholder="e.g. 2025/2026" value={info.season} onChange={(e) => setInfo({ season: e.target.value })} />
          </Field>
          <Field label="Date & Time" required>
            <div className="flex gap-2">
              <input type="time" className="bls-input" value={info.time} onChange={(e) => setInfo({ time: e.target.value })} />
              <input type="date" className="bls-input" value={info.date} onChange={(e) => setInfo({ date: e.target.value })} />
            </div>
          </Field>
          <Field label="Venue">
            <input className="bls-input" value={info.venue} onChange={(e) => setInfo({ venue: e.target.value })} />
          </Field>
          <Field label="City">
            <input className="bls-input" value={info.city} onChange={(e) => setInfo({ city: e.target.value })} />
          </Field>
        </div>
        <div className="space-y-4">
          <Field label="Game Type" required>
            <div className="flex flex-wrap gap-2">
              {GAME_TYPES.map((g) => {
                const active = info.gameType === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setInfo({ gameType: g })}
                    className={`px-3 h-9 rounded-md text-xs font-semibold border transition-colors ${
                      active
                        ? "bg-brand-green text-white border-brand-green"
                        : "bg-white text-foreground border-[color:var(--panel-border)] hover:border-brand-green"
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="No. of Halves" required>
            <input type="number" className="bls-input" value={info.halves} onChange={(e) => setInfo({ halves: +e.target.value })} />
          </Field>
          <Field label="Half Length" required>
            <input type="number" className="bls-input" value={info.halfLength} onChange={(e) => setInfo({ halfLength: +e.target.value })} />
          </Field>
          <Field label="OT Length" required>
            <input type="number" className="bls-input" value={info.otLength} onChange={(e) => setInfo({ otLength: +e.target.value })} />
          </Field>
          <Field label="Court">
            <input className="bls-input" value={info.court} onChange={(e) => setInfo({ court: e.target.value })} />
          </Field>
          <Field label="Country">
            <input className="bls-input" value={info.country} onChange={(e) => setInfo({ country: e.target.value })} />
          </Field>
        </div>
      </div>

      <div className="mt-10">
        <SectionTitle>Officials</SectionTitle>
        <div className="mt-3 space-y-2">
          {info.officials.map((o, i) => (
            <div key={i} className="flex items-stretch border border-[color:var(--panel-border)] rounded-md overflow-hidden bg-white">
              <input placeholder="NAME" className="flex-1 px-3 py-2 text-sm text-black font-bold border-r border-[color:var(--panel-border)] focus:outline-none focus:bg-[color:var(--surface)]/60" value={o.name} onChange={(e) => setOfficial(i, { name: e.target.value })} />
              <input placeholder="SURNAME" className="flex-1 px-3 py-2 text-sm text-black font-bold border-r border-[color:var(--panel-border)] focus:outline-none focus:bg-[color:var(--surface)]/60" value={o.surname} onChange={(e) => setOfficial(i, { surname: e.target.value })} />
              <div className="flex-1 border-r border-[color:var(--panel-border)] px-3 py-1">
                <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Role</div>
                <select className="w-full text-sm bg-transparent outline-none font-medium text-brand-green" value={o.role} onChange={(e) => setOfficial(i, { role: e.target.value })}>
                  {OFFICIAL_ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <input placeholder="COUNTRY" className="flex-1 px-3 py-2 text-sm text-black font-bold border-r border-[color:var(--panel-border)] focus:outline-none focus:bg-[color:var(--surface)]/60" value={o.country} onChange={(e) => setOfficial(i, { country: e.target.value })} />
              <input placeholder="SHIRTNO" className="w-24 px-3 py-2 text-sm text-black font-bold border-r border-[color:var(--panel-border)] focus:outline-none focus:bg-[color:var(--surface)]/60" value={o.shirtNo} onChange={(e) => setOfficial(i, { shirtNo: e.target.value })} />
              <button className="w-20 bg-[color:var(--surface)] flex flex-col items-center justify-center text-[10px] text-muted-foreground hover:bg-muted">
                <User className="h-4 w-4" /> More
              </button>
            </div>
          ))}
        </div>
      </div>
    </SetupPanel>
  );
}
