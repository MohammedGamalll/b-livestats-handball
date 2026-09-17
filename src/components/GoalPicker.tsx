import goalAsset from "@/assets/handball-goal-real.png";
import { useRef } from "react";

interface Props {
  open: boolean;
  mode: "placement" | "miss"; // placement = click inside goal; miss = click where ball hit/missed
  action: string; // GOAL / SHOT SAVED / SHOT MISSED / 7M
  onCancel: () => void;
  onPlace?: (gx: number, gy: number) => void;
  onMiss?: (gx: number, gy: number) => void;
}

export function GoalPicker({ open, mode, action, onCancel, onPlace, onMiss }: Props) {
  const imgRef = useRef<HTMLDivElement>(null);
  if (!open) return null;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = imgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const gy = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    if (mode === "placement" && onPlace) onPlace(gx, gy);
    else if (mode === "miss" && onMiss) onMiss(gx, gy);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded shadow-2xl max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-2 bg-topbar text-white flex items-center justify-between">
          <div className="text-sm font-bold uppercase tracking-wider">
            {action} — {mode === "placement" ? "Click where ball ended in goal" : "Click where the ball missed"}
          </div>
          <button onClick={onCancel} className="text-white/80 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="p-4">
          <div
            ref={imgRef}
            onClick={handleClick}
            className="relative w-full select-none cursor-crosshair"
            style={{ aspectRatio: "4 / 3" }}
          >
            <img src={goalAsset} alt="Handball goal" className="w-full h-full object-contain pointer-events-none" draggable={false} />
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button onClick={onCancel} className="px-4 h-9 text-xs font-bold uppercase tracking-wider bg-muted hover:bg-accent-red hover:text-white rounded">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
