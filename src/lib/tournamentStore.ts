// Legacy zustand-persist store — retained only for type export compatibility.
// All tournament & team library state now lives in the database via
// src/lib/db.functions.ts. This file remains so imports do not break; it
// contains no live logic.
import type { Player } from "./gameStore";

export interface SavedMatch {
  id: string;
  ts: number;
  date: string;
  competition: string;
  team1: string;
  team1Code: string;
  team1Color: string;
  team2: string;
  team2Code: string;
  team2Color: string;
  score1: number;
  score2: number;
}

export interface SavedTeam {
  name: string;
  shortName?: string;
  color: string;
  players: Player[];
  updatedAt: number;
}
