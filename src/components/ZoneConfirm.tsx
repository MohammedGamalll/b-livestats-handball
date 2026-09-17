import { useEffect, useState } from "react";
import type { CourtGeoZone } from "@/lib/court";

const ZONES: CourtGeoZone[] = ["6m", "9m", "7m", "Wing"];

interface Props {
  open: boolean;
  detected: CourtGeoZone | null;
  onCancel: () => void;
  onConfirm: (zone: CourtGeoZone) => void;
}

export function ZoneConfirm({ open, detected, onCancel, onConfirm }: Props) {
  const [choice, setChoice] = useState<CourtGeoZone>(detected || "6m");
  useEffect(() => {
    if (open) setChoice(detected || "6m");
  }, [open, detected]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-[360px] p-5 border-2 border-black"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">
            Confirm Shot Zone
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Detected: <span className="font-bold text-black">{detected ?? "—"}</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {ZONES.map((z) => {
            const active = choice === z;
            return (
              <button
                key={z}
                type="button"
                onClick={() => setChoice(z)}
                className={`h-14 rounded-md border-2 text-sm font-extrabold transition-colors ${
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
            onClick={() => onConfirm(choice)}
            className="flex-1 h-10 rounded-md bg-black text-white text-xs font-bold uppercase"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
