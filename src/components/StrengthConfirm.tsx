import { useEffect, useState } from "react";
import { strengthLabel, type DetectedStrength } from "@/lib/strength";

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

export interface StrengthChoice {
  attack: number;
  defend: number;
  emptyAttack: boolean;
  emptyDefend: boolean;
}

interface Props {
  open: boolean;
  detected: DetectedStrength | null;
  onCancel: () => void;
  onConfirm: (choice: StrengthChoice) => void;
}

export function StrengthConfirm({ open, detected, onCancel, onConfirm }: Props) {
  const [attack, setAttack] = useState(6);
  const [defend, setDefend] = useState(6);
  const [emptyAttack, setEmptyAttack] = useState(false);

  useEffect(() => {
    if (open && detected) {
      setAttack(detected.attack);
      setDefend(detected.defend);
      setEmptyAttack(detected.emptyAttack);
    }
  }, [open, detected]);

  if (!open) return null;

  const detectedLabel = detected
    ? strengthLabel(detected.attack, detected.defend, detected.emptyAttack)
    : "—";
  const currentLabel = strengthLabel(attack, defend, emptyAttack);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-[420px] p-5 border-2 border-black"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">
            Confirm Strength Situation
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Detected: <span className="font-bold text-black">{detectedLabel}</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Selected: <span className="font-bold text-black">{currentLabel}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-5 gap-2">
          {PRESETS.map((p) => {
            const active = attack === p.attack && defend === p.defend;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setAttack(p.attack);
                  setDefend(p.defend);
                }}
                className={`h-12 rounded-md border-2 text-sm font-extrabold transition-colors ${
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

        <label className="mt-4 flex items-center gap-2 cursor-pointer select-none text-xs font-bold uppercase tracking-wider bg-accent-red/10 text-accent-red px-3 py-2 rounded">
          <input
            type="checkbox"
            checked={emptyAttack}
            onChange={(e) => setEmptyAttack(e.target.checked)}
            className="h-4 w-4 cursor-pointer"
          />
          <span>Empty Goal (Attacking Team)</span>
        </label>

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
                attack,
                defend,
                emptyAttack,
                emptyDefend: false,
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
