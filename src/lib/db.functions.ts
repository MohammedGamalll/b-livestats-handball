import type { LogEntry, Player, TeamSetup } from "./gameStore";

function api() {
  const electronAPI = window.electronAPI;
  if (!electronAPI) {
    throw new Error("Desktop API is unavailable. Launch the app with Electron.");
  }
  return electronAPI;
}

export async function listTeams() {
  return api().listTeams();
}

export async function saveTeam({ data }: { data: { name: string; shortName?: string; color?: string; players: Player[] } }) {
  return api().saveTeam(data);
}

export async function deleteTeam({ data }: { data: { id: string } }) {
  return api().deleteTeam(data);
}

export interface SavedMatchDTO {
  id: string;
  date: string;
  competition: string;
  team1Name: string;
  team2Name: string;
  team1Color: string;
  team2Color: string;
  score1: number;
  score2: number;
  shootout1: number | null;
  shootout2: number | null;
  finishedAt: number;
}

export async function listMatches(): Promise<SavedMatchDTO[]> {
  return api().listMatches();
}

export async function saveMatch({ data }: { data: {
  info: { competition?: string; season?: string; date?: string; venue?: string; city?: string; country?: string; halves?: number; halfLength?: number };
  team1: TeamSetup; team2: TeamSetup;
  score1: number; score2: number;
  shootout1?: number | null; shootout2?: number | null;
  log: LogEntry[];
} }) {
  return api().saveMatch(data);
}

export async function deleteMatch({ data }: { data: { id: string } }) {
  return api().deleteMatch(data);
}

export interface MatchDetailDTO {
  id: string;
  info: {
    gameNumber: string;
    competition: string;
    season: string;
    date: string;
    time: string;
    venue: string;
    city: string;
    country: string;
    court: string;
    spectators: string;
    gameType: string;
    halves: number;
    halfLength: number;
    otLength: number;
    officials: unknown[];
  };
  team1: TeamSetup;
  team2: TeamSetup;
  score1: number;
  score2: number;
  shootout1: number | null;
  shootout2: number | null;
  log: LogEntry[];
}

export async function getMatchDetail({ data }: { data: { id: string } }): Promise<MatchDetailDTO | null> {
  return api().getMatchDetail(data) as Promise<MatchDetailDTO | null>;
}

export interface ZoneMA { g: number; a: number }
export interface PlayerCareerMatch {
  matchId: string;
  date: string;
  competition: string;
  ownTeam: string;
  opponent: string;
  ownScore: number;
  oppScore: number;
  ownShootout: number | null;
  oppShootout: number | null;
  result: "W" | "D" | "L";
  goals: number;
  shots: number;
  assists: number;
  twoMin: number;
  yellow: number;
  red: number;
  blue: number;
  turnovers: number;
  steals: number;
  blocks: number;
  z6m: ZoneMA;
  z9m: ZoneMA;
  zWing: ZoneMA;
  zFB: ZoneMA;
  bt: ZoneMA;
  eg: ZoneMA;
  pen: number;
  penAtt: number;
  r7m: number;
  p7m: number;
  rf: number;
  halves: number;
  gkSaves: number;
  gkConceded: number;
  gkPosts: number;
  gkFaced: number;
  gkMinutes: number;
  gkShareSaves: number;
  gkShareFaced: number;
  gkPeriods: number[];
}

export interface GkShotEvent {
  matchId: string;
  date: string;
  opponent: string;
  half: number;
  action: string;
  kind?: "save" | "goal" | "post";
  goalX?: number;
  goalY?: number;
  missZone?: string;
}

export interface PlayerCareer {
  no: string;
  name: string;
  surname: string;
  position: string;
  teamName: string;
  teamColor: string;
  isGK: boolean;
  matches: PlayerCareerMatch[];
  gk: { saves: number; conceded: number; posts: number; faced: number; minutes: number; savePct: number; shotEvents: GkShotEvent[] };
  totals: {
    played: number;
    wins: number; draws: number; losses: number;
    goals: number; shots: number; missed: number; saved: number;
    pen: number; penAtt: number;
    assists: number; steals: number; turnovers: number; blocks: number;
    yellow: number; twoMin: number; red: number;
    shootingPct: number;
  };
  shotEvents: Array<{ team?: 1 | 2; x?: number; y?: number; goalX?: number; goalY?: number; action: string; subtype?: string; matchId: string }>;
}

export async function listPlayers() {
  return api().listPlayers();
}

export async function getPlayerReport({ data }: { data: { teamName: string; playerNo: string } }): Promise<PlayerCareer | null> {
  return api().getPlayerReport(data);
}

export interface SeasonPlayerRow {
  no: string;
  name: string;
  surname: string;
  position: string;
  played: number;
  goals: number; shots: number; missed: number; saved: number;
  z6m: ZoneMA; z9m: ZoneMA; zWing: ZoneMA; zFB: ZoneMA;
  bt: ZoneMA; eg: ZoneMA;
  pen: number; penAtt: number;
  assists: number; steals: number; turnovers: number; blocks: number;
  yellow: number; twoMin: number; red: number;
  r7m: number; p7m: number; rf: number;
}

export interface SeasonMatchLine {
  matchId: string;
  date: string;
  competition: string;
  opponent: string;
  ownScore: number;
  oppScore: number;
  ownShootout: number | null;
  oppShootout: number | null;
  result: "W" | "D" | "L";
}

export interface SeasonBoxScore {
  teamName: string;
  teamColor: string;
  matchesCount: number;
  wins: number; draws: number; losses: number;
  goalsFor: number; goalsAgainst: number;
  totals: SeasonPlayerRow;
  players: SeasonPlayerRow[];
  matches: SeasonMatchLine[];
  shotEvents: Array<{ x?: number; y?: number; goalX?: number; goalY?: number; action: string; subtype?: string; playerNo?: string; matchId: string }>;
}

export async function listSeasonTeams() {
  return api().listSeasonTeams();
}

export async function getSeasonBoxScore({ data }: { data: { teamName: string } }): Promise<SeasonBoxScore | null> {
  return api().getSeasonBoxScore(data);
}

export interface StandingsConfigDTO {
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  bonuses: Record<string, { bonus_08: number; bonus_10: number }>;
}

export async function getStandingsConfig(): Promise<StandingsConfigDTO> {
  return api().getStandingsConfig();
}

export async function updateStandingsPoints({ data }: { data: { pointsWin: number; pointsDraw: number; pointsLoss: number } }) {
  return api().updateStandingsPoints(data);
}

export async function updateTeamBonus({ data }: { data: { teamName: string; bonus_08: number; bonus_10: number } }) {
  return api().updateTeamBonus(data);
}

export async function getDatabaseStatus() {
  if (typeof window === "undefined" || !window.electronAPI) {
    return { matchCount: 0, playerCount: 0, teamCount: 0, empty: false, onboardingComplete: true };
  }
  return api().getDatabaseStatus();
}

export async function markOnboardingComplete() {
  return api().markOnboardingComplete();
}

export async function exportBackup() {
  return api().exportBackup();
}

export async function importBackup() {
  return api().importBackup();
}
