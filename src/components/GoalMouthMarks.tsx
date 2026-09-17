import goalAsset from "@/assets/handball-goal-real.png";

export type GoalMouthShot = {
  action?: string;
  kind?: "save" | "goal" | "post";
  goalX?: number;
  goalY?: number;
};

function markKind(s: GoalMouthShot): "save" | "goal" | "post" | "miss" {
  if (s.kind) return s.kind;
  if (s.action === "GOAL" || s.action === "7M") return "goal";
  if (s.action === "SHOT SAVED") return "save";
  return "miss";
}

export function GoalMouthMarks({
  shots,
  color = "#2563eb",
  emptyLabel = "No goal-mouth markers",
}: {
  shots: GoalMouthShot[];
  color?: string;
  emptyLabel?: string;
}) {
  const placed = shots.filter((s) => s.goalX != null && s.goalY != null);
  return (
    <div className="relative">
      <img src={goalAsset} alt="goal" className="w-full h-auto block" draggable={false} />
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        {placed.map((s, i) => {
          const kind = markKind(s);
          const stroke = kind === "goal" ? "#16a34a" : kind === "save" ? color : "#dc2626";
          return (
            <g
              key={i}
              transform={`translate(${(s.goalX ?? 0) * 100} ${(s.goalY ?? 0) * 100})`}
              stroke={stroke}
              strokeWidth="0.8"
              strokeLinecap="round"
              fill="none"
            >
              {kind === "goal" && (
                <>
                  <line x1="-1.6" y1="0" x2="1.6" y2="0" />
                  <line x1="0" y1="-1.6" x2="0" y2="1.6" />
                </>
              )}
              {kind === "save" && <circle r="1.6" />}
              {(kind === "post" || kind === "miss") && (
                <>
                  <line x1="-1.6" y1="-1.6" x2="1.6" y2="1.6" />
                  <line x1="-1.6" y1="1.6" x2="1.6" y2="-1.6" />
                </>
              )}
            </g>
          );
        })}
      </svg>
      {placed.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}
