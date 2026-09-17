import { useState } from "react";
import { TEAM_COLORS } from "@/lib/handball";

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-14 w-20 flex items-center justify-center text-white font-bold text-xl shadow"
        style={{
          background: value
            ? value
            : "repeating-linear-gradient(45deg, #333 0 8px, #999 8px 16px)",
        }}
      >
        88
      </button>
      {open && (
        <div className="absolute z-30 top-full mt-1 grid grid-cols-4 gap-2 bg-white p-3 border shadow-xl">
          {TEAM_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { onChange(c); setOpen(false); }}
              className="h-14 w-14 flex items-center justify-center text-white font-bold text-lg"
              style={{ background: c }}
            >88</button>
          ))}
        </div>
      )}
    </div>
  );
}
