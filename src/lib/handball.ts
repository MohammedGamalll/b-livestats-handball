export const POSITIONS = ["GK", "LW", "LB", "CB", "RB", "RW", "P"] as const;
export type Position = (typeof POSITIONS)[number];

export const OFFICIAL_ROLES = [
  "Referee 1",
  "Referee 2",
  "Scorekeeper",
  "Timekeeper",
  "Delegate",
] as const;

export const COACH_ROLES = ["Head Coach", "Assistant Coach", "Team Official"] as const;

export const GAME_TYPES = ["Handball"] as const;

export const COMPETITION_OPTIONS = [
  "League",
  "Cup",
  "Super Cup",
  "Super League",
  "Friendly",
  "Zone",
  "Arab",
  "Africa",
  "World Cup",
] as const;

export const TEAM_COLORS = [
  "#d62828", "#2a9d3f", "#e8842a", "#1565c0",
  "#1a1a1a", "#bdbdbd", "#f5c518", "#2bb3b3",
  "#7b3fbf", "#6b3e1f", "#e85ba7", "#0d2c5c",
  "#a8e23b", "#7a1f2e", "#5a5a5a", "#0e6e96",
];

export const STARTERS_REQUIRED = 7; // Handball: 6 outfield + 1 GK
export const MAX_SQUAD = 16;

export type ActionType =
  | "GOAL"
  | "SHOT MISSED"
  | "SHOT SAVED"
  | "7M"
  | "ASSIST"
  | "STEAL"
  | "TURNOVER"
  | "BLOCK"
  | "YELLOW"
  | "2-MIN"
  | "RED"
  | "BLUE"
  | "FOUL"
  | "TIMEOUT"
  | "THROW-OFF"
  | "SUBSTITUTION"
  | "COACH";

export const ACTIONS: { key: ActionType; tone: "score" | "miss" | "foul" | "neutral" }[] = [
  { key: "GOAL", tone: "score" },
  { key: "SHOT MISSED", tone: "miss" },
  { key: "SHOT SAVED", tone: "neutral" },
  { key: "7M", tone: "score" },
  { key: "ASSIST", tone: "neutral" },
  { key: "STEAL", tone: "neutral" },
  { key: "TURNOVER", tone: "miss" },
  { key: "BLOCK", tone: "neutral" },
  { key: "YELLOW", tone: "foul" },
  { key: "2-MIN", tone: "foul" },
  { key: "RED", tone: "foul" },
  { key: "BLUE", tone: "foul" },
  { key: "FOUL", tone: "foul" },
  { key: "THROW-OFF", tone: "neutral" },
  { key: "SUBSTITUTION", tone: "neutral" },
];

// Sub-option presets for the 4-button action menu
export const MADE_SUBTYPES = [
  "LOP",
  "SHOT FROM UP",
  "SHOT FROM MIDDLE",
  "SHOT FROM DOWN",
  "SPIRAL",
  "TURN AROUND",
  "PENALTY",
  "BREAK THROUGH",
  "EMPTY GOAL",
] as const;

export const FOUL_SUBTYPES = [
  "2M",
  "YELLOW CARD",
  "RED CARD",
  "BLUE CARD",
  "7M",
] as const;


export const MISSED_SUBTYPES = [
  "SAVE",
  "POST",
  "OUT",
  "BLOCK",
  "PENALTY",
] as const;


export const TURNOVER_SUBTYPES = [
  "TRAVEL",
  "OFFENSIVE FOUL",
  "LINE",
  "BALL HANDLING",
  "BAD PASS",
  "DOUBLE DRIBBLE",
  "WRONG SUB",
  "NEGATIVE",
] as const;

