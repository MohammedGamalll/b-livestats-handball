export type CourtSide = "left" | "right";
export type CourtZone = "6m" | "Wing" | "9m" | "7m" | "FB";
export type CourtGeoZone = "6m" | "Wing" | "9m" | "7m";

export interface CourtShotLike {
  action?: string;
  subtype?: string | null;
  x?: number | null;
  y?: number | null;
  team?: 1 | 2 | null;
  fastBreak?: boolean | null;
  fast_break?: boolean | null;
  zone?: CourtGeoZone | string | null;
}

export function oppositeSide(side: CourtSide): CourtSide {
  return side === "left" ? "right" : "left";
}

export function ownSideForTeam(team: 1 | 2 | null | undefined, team1OwnSide: CourtSide = "left"): CourtSide | null {
  if (team === 1) return team1OwnSide;
  if (team === 2) return oppositeSide(team1OwnSide);
  return null;
}

export function attackSideForTeam(team: 1 | 2 | null | undefined, team1OwnSide: CourtSide = "left"): CourtSide | null {
  const ownSide = ownSideForTeam(team, team1OwnSide);
  return ownSide ? oppositeSide(ownSide) : null;
}

export function isPenaltyShot(e: CourtShotLike): boolean {
  return e.action === "7M" || e.subtype === "PENALTY";
}

export function isFastBreak(e: CourtShotLike): boolean {
  return e.fastBreak === true || e.fast_break === true;
}

const COURT_GOAL_LINE_X: Record<CourtSide, number> = {
  left: 0.057,
  right: 0.943,
};

const COURT_PENALTY_X: Record<CourtSide, number> = {
  left: 0.259,
  right: 0.741,
};

// Radius from the actual goal line to the dashed 9m arc on the displayed court image.
// Per the app's reporting convention, everything from the goal line up to this second
// dashed arc is counted as 6m; anything beyond it is 9m.
const SECOND_ARC_RADIUS = 0.265;
const COURT_Y_ASPECT = 0.5;

export function penaltySpotForSide(side: CourtSide): { x: number; y: number } {
  return { x: COURT_PENALTY_X[side], y: 0.5 };
}

export function penaltySpotForTeam(
  team: 1 | 2 | null | undefined,
  team1OwnSide: CourtSide = "left",
  fallbackX?: number | null,
): { x: number; y: number } {
  const attackSide = attackSideForTeam(team, team1OwnSide);
  if (attackSide) return penaltySpotForSide(attackSide);
  return penaltySpotForSide((fallbackX ?? 0.175) >= 0.5 ? "right" : "left");
}

export function displayShotXY(e: CourtShotLike, team1OwnSide: CourtSide = "left"): { x: number; y: number } {
  if (isPenaltyShot(e)) return penaltySpotForTeam(e.team, team1OwnSide, e.x);
  return { x: e.x ?? 0, y: e.y ?? 0 };
}

// Geographic classification only — returns where the shot was taken from.
// FB is NOT a geographic zone; it is tracked as a parallel counter via `isFastBreak`.
export function classifyShotZone(e: CourtShotLike): CourtGeoZone | null {
  if (isPenaltyShot(e)) return "7m";
  if (e.action !== "GOAL" && e.action !== "SHOT MISSED" && e.action !== "SHOT SAVED") return null;
  if (e.x == null || e.y == null) return null;

  const side: CourtSide = e.x < 0.5 ? "left" : "right";
  const gx = COURT_GOAL_LINE_X[side];
  const rx = Math.abs(e.x - gx);
  const ry = Math.abs(e.y - 0.5) * COURT_Y_ASPECT;
  const r = Math.hypot(rx, ry);

  // Wing = extreme side strips, regardless of radial distance
  if (e.y <= 0.2 || e.y >= 0.8) return "Wing";
  if (r <= SECOND_ARC_RADIUS) return "6m";
  return "9m";
}

// Preferred classifier: honors user-confirmed zone override; falls back to geometry.
export function classifyShotZoneOrOverride(e: CourtShotLike): CourtGeoZone | null {
  if (e.zone === "6m" || e.zone === "9m" || e.zone === "7m" || e.zone === "Wing") {
    return e.zone;
  }
  return classifyShotZone(e);
}
