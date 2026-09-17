import { useEffect, useState } from "react";
import { strengthLabel, type DetectedStrength } from "@/lib/strength";
import type { CourtGeoZone } from "@/lib/court";
import type { LogEntry } from "@/lib/gameStore";

const PRESETS: { label: string; attack: number; defend: number }[] = [
  { label: "6v6", attack: 6, defend: 6 },
  { label: "6v5", attack: 6, defend: 5 },
  { label: "6v4", attack: 6, defend: 4 },
  { label: "5v6", attack: 5, defend: 6 },
  { label: "5v5", attack: 5, defend: 5 },
  { label: "5v4", attack: 5, defend: 4 },
  { label: "7v6", attack: 7, defend: 6 },
  { label: "7v5", attack: 7, defend: 5 },
  { label: "6v7", attack: 6, defend: 7 },
  { label: "4v6", attack: 4, defend: 6 },
];

const ZONES: CourtGeoZone[] = ["6m", "9m", "7m", "Wing"];
type DefenseOpt = NonNullable<LogEntry["defense"]>;
const DEFENSE_OPTIONS: DefenseOpt[] = ["6/0", "5/1", "4/2", "3/3", "M2M", "5/0", "4/1"];

export interface ConfirmResult {
  zone?: CourtGeoZone;              // present when isShot=true
  attack: number;
  defend: number;
  emptyAttack: boolean;
  defense?: DefenseOpt;              // undefined when user skips
}

interface Props {
  open: boolean;
  isShot: boolean;
  detectedZone: CourtGeoZone | null;
  detectedStrength: DetectedStrength | null;
  defendingTeamLabel?: string;
  defendingTeamColor?: string;
  lastDefense?: DefenseOpt | null;
  onCancel: () => void;
  onConfirm: (r: ConfirmResult) => void;
}

export function ConfirmSituationModal({
  open, isShot, detectedZone, detectedStrength,
  defendingTeamLabel, defendingTeamColor, lastDefense,
  onCancel, onConfirm,
}: Props) {
  const [zone, setZone] = useState<CourtGeoZone>(detectedZone || "6m");
  const [attack, setAttack] = useState(6);
  const [defend, setDefend] = useState(6);
  const [emptyAttack, setEmptyAttack] = useState(false);
  const [defense, setDefense] = useState<DefenseOpt | null>(null);

  useEffect(() => {
    if (!open) return;
    if (detectedZone) setZone(detectedZone);
    if (detectedStrength) {
      setAttack(detectedStrength.attack);
      setDefend(detectedStrength.defend);
      setEmptyAttack(detectedStrength.emptyAttack);
    }
    setDefense(lastDefense ?? null);
  }, [open, detectedZone, detectedStrength, lastDefense]);

  if (!open) return null;

  const detectedStrLabel = detectedStrength
    ? strengthLabel(detectedStrength.attack, detectedStrength.defend, detectedStrength.emptyAttack)
    : "—";
  const currentStrLabel = strengthLabel(attack, defend, emptyAttack);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-[460px] max-w-full p-5 border-2 border-black my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">
            Confirm Situation
          </div>
        </div>

        {isShot && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
              Shot Zone <span className="normal-case font-normal">· detected: <b className="text-black">{detectedZone ?? "—"}</b></span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {ZONES.map((z) => {
                const active = zone === z;
                return (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZone(z)}
                    className={`h-11 rounded-md border-2 text-sm font-extrabold transition-colors ${
                      active
                        ? "bg-black text-white border-black"
                        : "bg-white text-black border-black/30 hover:border-black"
                    }`}
                  >
                    {z}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
            Strength Situation
            <span className="normal-case font-normal"> · detected: <b className="text-black">{detectedStrLabel}</b> · selected: <b className="text-black">{currentStrLabel}</b></span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {PRESETS.map((p) => {
              const active = attack === p.attack && defend === p.defend;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => { setAttack(p.attack); setDefend(p.defend); }}
                  className={`h-11 rounded-md border-2 text-sm font-extrabold transition-colors ${
                    active
                      ? "bg-black text-white border-black"
                      : "bg-white text-black border-black/30 hover:border-black"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <label className="mt-2 flex items-center gap-2 cursor-pointer select-none text-xs font-bold uppercase tracking-wider bg-accent-red/10 text-accent-red px-3 py-2 rounded">
            <input
              type="checkbox"
              checked={emptyAttack}
              onChange={(e) => setEmptyAttack(e.target.checked)}
              className="h-4 w-4 cursor-pointer"
            />
            <span>Empty Goal (Attacking Team)</span>
          </label>
        </div>

        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
            Defense Formation
            {defendingTeamLabel && (
              <span className="normal-case font-normal"> · <b style={{ color: defendingTeamColor || "#000" }}>{defendingTeamLabel}</b></span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {DEFENSE_OPTIONS.map((opt) => {
              const active = defense === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setDefense(active ? null : opt)}
                  className={`h-10 rounded-md border-2 text-xs font-bold transition-colors ${
                    active
                      ? "bg-accent-orange text-white border-accent-orange"
                      : "bg-white text-black border-black/30 hover:border-black"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-10 rounded-md border-2 border-black/30 text-xs font-bold uppercase text-black hover:border-black"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm({
                zone: isShot ? zone : undefined,
                attack,
                defend,
                emptyAttack,
                defense: defense ?? undefined,
              })
            }
            className="flex-1 h-10 rounded-md bg-black text-white text-xs font-bold uppercase"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
