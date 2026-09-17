import courtAsset from "@/assets/handball-court-purple.png";
import { displayShotXY, isPenaltyShot, type CourtSide } from "@/lib/court";
import type { LogEntry } from "@/lib/gameStore";
import { useMemo, useRef } from "react";

export interface FormationToken {
  team: 1 | 2;
  playerId: string;
  no: string;
  name?: string;
  color: string;
  x: number;
  y: number;
  isGK?: boolean;
}

interface Props {
  className?: string;
  shots?: LogEntry[];
  team1Color?: string;
  team2Color?: string;
  pending?: boolean;
  heatmap?: boolean;
  onCourtClick?: (x: number, y: number) => void;
  formation?: FormationToken[];
  onPlayerDrop?: (playerId: string, team: 1 | 2, x: number, y: number) => void;
  onPlayerRemove?: (playerId: string, team: 1 | 2) => void;
  onPlayerSelect?: (playerId: string, team: 1 | 2, no: string) => void;
  selectedPlayerId?: string | null;
  colorForShot?: (s: LogEntry) => string;
  team1Direction?: CourtSide;
}

export function HandballCourt({
  className = "",
  shots = [],
  team1Color = "#d62828",
  team2Color = "#1565c0",
  pending = false,
  heatmap = false,
  onCourtClick,
  formation = [],
  onPlayerDrop,
  onPlayerRemove,
  onPlayerSelect,
  selectedPlayerId,
  colorForShot,
  team1Direction = "left",
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const coordsFromEvent = (clientX: number, clientY: number) => {
    const el = rootRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onCourtClick) return;
    const { x, y } = coordsFromEvent(e.clientX, e.clientY);
    onCourtClick(x, y);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!onPlayerDrop) return;
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain")) as { playerId: string; team: 1 | 2 };
      if (!data?.playerId) return;
      const { x, y } = coordsFromEvent(e.clientX, e.clientY);
      onPlayerDrop(data.playerId, data.team, x, y);
    } catch {}
  };

  const heatCells = useMemo(() => {
    if (!heatmap) return [];
    const COLS = 24, ROWS = 12;
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    const pts = shots.filter((s) => isPenaltyShot(s) || (s.x != null && s.y != null));
    pts.forEach((s) => {
      const { x, y } = displayShotXY(s, team1Direction);
      const cx = x * COLS, cy = y * ROWS;
      const weight = s.action === "GOAL" || s.action === "7M" ? 2 : 1;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const d2 = (c + 0.5 - cx) ** 2 + (r + 0.5 - cy) ** 2;
        grid[r][c] += weight * Math.exp(-d2 / 2.2);
      }
    });
    let max = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] > max) max = grid[r][c];
    if (max === 0) return [];
    const cells: { x: number; y: number; w: number; h: number; a: number; hue: number }[] = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const v = grid[r][c] / max;
      if (v < 0.05) continue;
      cells.push({
        x: (c / COLS) * 100, y: (r / ROWS) * 100,
        w: 100 / COLS, h: 100 / ROWS,
        a: Math.min(0.85, v * 0.9), hue: 60 - v * 60,
      });
    }
    return cells;
  }, [shots, heatmap, team1Direction]);

  return (
    <div
      ref={rootRef}
      className={`relative w-full h-full ${pending ? "cursor-crosshair ring-4 ring-accent-orange" : ""} ${className}`}
      onClick={handleClick}
      onDragOver={(e) => { if (onPlayerDrop) e.preventDefault(); }}
      onDrop={handleDrop}
    >
      <img src={courtAsset} alt="Handball court" className="w-full h-full object-contain pointer-events-none select-none" draggable={false} />
      {pending && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-accent-orange text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded shadow z-10 pointer-events-none">
          Click court to place shot
        </div>
      )}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        {heatmap && heatCells.map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} fill={`hsl(${c.hue} 95% 50%)`} opacity={c.a} style={{ mixBlendMode: "multiply" }} />
        ))}
        {!heatmap && shots.filter((s) => isPenaltyShot(s) || (s.x != null && s.y != null)).map((s) => {
          const color = colorForShot ? colorForShot(s) : (s.team === 1 ? team1Color : team2Color);
          const isGoal = s.action === "GOAL" || s.action === "7M";
          const isMiss = s.action === "SHOT MISSED";
          const isSave = s.action === "SHOT SAVED";
          const { x, y } = displayShotXY(s, team1Direction);
          return (
            <g key={s.id} transform={`translate(${x * 100} ${y * 100})`}>
              {isGoal && <circle r="1.6" fill={color} stroke="#fff" strokeWidth="0.3" />}
              {isMiss && (
                <g stroke={color} strokeWidth="0.5" fill="none">
                  <line x1="-1.4" y1="-1.4" x2="1.4" y2="1.4" />
                  <line x1="-1.4" y1="1.4" x2="1.4" y2="-1.4" />
                </g>
              )}
              {isSave && <circle r="1.4" fill="none" stroke={color} strokeWidth="0.5" strokeDasharray="0.6 0.4" />}
            </g>
          );
        })}
      </svg>

      {/* Formation tokens */}
      {formation.map((tok) => {
        const isSel = selectedPlayerId === tok.playerId;
        return (
          <div
            key={tok.playerId}
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.setData("text/plain", JSON.stringify({ playerId: tok.playerId, team: tok.team, from: "court" }));
              e.dataTransfer.effectAllowed = "move";
            }}
            onClick={(e) => { e.stopPropagation(); onPlayerSelect?.(tok.playerId, tok.team, tok.no); }}
            onDoubleClick={(e) => { e.stopPropagation(); onPlayerRemove?.(tok.playerId, tok.team); }}
            title={`#${tok.no} ${tok.name || ""} — drag to move, double-click to remove`}
            className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing select-none rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md border-2 ${isSel ? "ring-4 ring-accent-orange border-white" : "border-white/80"} ${tok.isGK ? "rounded-md" : ""}`}
            style={{
              left: `${tok.x * 100}%`,
              top: `${tok.y * 100}%`,
              width: 28, height: 28,
              background: tok.color,
            }}
          >
            {tok.no || "—"}
          </div>
        );
      })}
    </div>
  );
}
