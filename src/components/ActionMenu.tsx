import { useState } from "react";
import { MADE_SUBTYPES, FOUL_SUBTYPES, MISSED_SUBTYPES, TURNOVER_SUBTYPES } from "@/lib/handball";

export type ActionGroup = "MADE" | "FOUL" | "MISSED" | "TURNOVER";

export const ACTION_GROUP_LABEL: Record<ActionGroup, string> = {
  MADE: "GOAL",
  MISSED: "MISSED",
  FOUL: "FOUL",
  TURNOVER: "TURNOVER",
};

export interface ActionPick {
  group: ActionGroup;
  subtype: string;
  fb?: boolean; // fast-break flag carried into the shot log
}

interface Props {
  onPick: (p: ActionPick) => void;
  onTimeout?: () => void;
  pendingLabel?: string | null;
  horizontal?: boolean;
  groups?: ActionGroup[];
  showTimeout?: boolean;
  split?: boolean;
}



const GROUP_STYLES: Record<ActionGroup, string> = {
  MADE: "bg-muted text-foreground border border-border",
  FOUL: "bg-muted text-foreground border border-border",
  MISSED: "bg-muted text-foreground border border-border",
  TURNOVER: "bg-muted text-foreground border border-border",
};

export function ActionMenu({
  onPick,
  onTimeout,
  pendingLabel,
  horizontal = false,
  groups,
  showTimeout = true,
  split = false,
}: Props) {
  const [open, setOpen] = useState<ActionGroup | null>(null);
  const [fb, setFb] = useState(false);

  const allButtons: ActionGroup[] = groups ?? ["MADE", "MISSED", "FOUL", "TURNOVER"];
  const leftButtons = split ? allButtons.slice(0, Math.ceil(allButtons.length / 2)) : allButtons;
  const rightButtons = split ? allButtons.slice(Math.ceil(allButtons.length / 2)) : [];

  const SUBS: Record<ActionGroup, readonly string[]> = {
    MADE: MADE_SUBTYPES,
    FOUL: FOUL_SUBTYPES,
    MISSED: MISSED_SUBTYPES,
    TURNOVER: TURNOVER_SUBTYPES,
  };


  const btnClass = horizontal
    ? "h-7 px-3 text-[11px] font-bold uppercase tracking-wider hover:opacity-90"
    : "h-7 w-20 text-[10px] font-bold uppercase tracking-wider hover:opacity-90";

  const renderButton = (g: ActionGroup) => (
    <button
      key={g}
      onClick={() => { setFb(false); setOpen(open === g ? null : g); }}
      className={`${btnClass} ${GROUP_STYLES[g]} ${open === g ? "ring-2 ring-accent-orange" : ""}`}
    >
      {g === "MADE" ? "GOAL" : g}
    </button>
  );

  const inner = split ? (
    <div className="flex justify-center gap-2">
      <div className="flex items-center gap-1">{leftButtons.map(renderButton)}</div>
      <div className="flex items-center gap-1">{rightButtons.map(renderButton)}</div>
    </div>
  ) : (
    <div className={horizontal ? "flex items-center gap-1 relative" : "flex flex-col gap-0.5 relative"}>
      {leftButtons.map(renderButton)}
      {showTimeout && (
        <button
          onClick={() => onTimeout?.()}
          className={`${btnClass} bg-accent-orange/90 text-white`}
        >
          TIME OUT
        </button>
      )}
      {pendingLabel && !horizontal && (
        <div className="mt-1 text-[9px] uppercase font-bold text-center text-accent-orange">{pendingLabel}</div>
      )}
    </div>
  );

  return (
    <div className={split ? "inline-flex" : horizontal ? "flex items-center gap-1 relative" : "flex flex-col gap-0.5 relative"}>
      {inner}


      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setOpen(null)}>
          <div className="bg-white rounded shadow-2xl p-4 min-w-[320px]" onClick={(e) => e.stopPropagation()}>
            <div className={`px-3 py-2 -mx-4 -mt-4 mb-3 font-bold uppercase tracking-wider text-sm ${GROUP_STYLES[open]}`}>
              {ACTION_GROUP_LABEL[open]} — CHOOSE TYPE
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SUBS[open].map((s) => (
                <button
                  key={s}
                  onClick={() => { onPick({ group: open, subtype: s, fb }); setOpen(null); setFb(false); }}
                  className="h-12 px-3 text-xs font-bold uppercase tracking-wider bg-muted hover:bg-accent-orange hover:text-white rounded"
                >
                  {s}
                </button>
              ))}
            </div>
            {(open === "MADE" || open === "MISSED") && (
              <label className="mt-3 flex items-center gap-2 cursor-pointer select-none text-xs font-bold uppercase tracking-wider bg-accent-red/10 text-accent-red px-3 py-2 rounded">
                <input type="checkbox" checked={fb} onChange={(e) => setFb(e.target.checked)} className="h-4 w-4 cursor-pointer" />
                <span>FB · FAST BREAK</span>
              </label>
            )}

            <button onClick={() => { setOpen(null); setFb(false); }} className="w-full mt-3 h-9 text-xs font-bold uppercase tracking-wider bg-muted hover:bg-accent-red hover:text-white rounded">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
