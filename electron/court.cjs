const COURT_GOAL_LINE_X = { left: 0.057, right: 0.943 };
const SECOND_ARC_RADIUS = 0.265;
const COURT_Y_ASPECT = 0.5;

function isPenaltyShot(e) {
  return e.action === "7M" || e.subtype === "PENALTY";
}

function classifyShotZone(e) {
  if (isPenaltyShot(e)) return "7m";
  if (e.action !== "GOAL" && e.action !== "SHOT MISSED" && e.action !== "SHOT SAVED") return null;
  if (e.x == null || e.y == null) return null;
  const side = e.x < 0.5 ? "left" : "right";
  const gx = COURT_GOAL_LINE_X[side];
  const rx = Math.abs(e.x - gx);
  const ry = Math.abs(e.y - 0.5) * COURT_Y_ASPECT;
  const r = Math.hypot(rx, ry);
  if (e.y <= 0.2 || e.y >= 0.8) return "Wing";
  if (r <= SECOND_ARC_RADIUS) return "6m";
  return "9m";
}

function classifyShotZoneOrOverride(e) {
  if (e.zone === "6m" || e.zone === "9m" || e.zone === "7m" || e.zone === "Wing") return e.zone;
  return classifyShotZone(e);
}

module.exports = { classifyShotZoneOrOverride };
