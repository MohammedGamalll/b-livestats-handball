export type ElectronAPI = {
  listTeams: () => Promise<Array<{
    id: string;
    name: string;
    shortName: string;
    color: string;
    updatedAt: number;
    coaches?: Array<{ name: string; surname: string; role: string; country: string }>;
    players: Array<{
      id: string;
      no: string;
      name: string;
      surname: string;
      height: string;
      position: string;
      addInfo: string;
      captain: boolean;
      playing: boolean;
    }>;
  }>>;
  saveTeam: (data: unknown) => Promise<{ id: string }>;
  deleteTeam: (data: { id: string }) => Promise<{ ok: boolean }>;
  listMatches: () => Promise<Array<{
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
  }>>;
  saveMatch: (data: unknown) => Promise<{ id: string }>;
  deleteMatch: (data: { id: string }) => Promise<{ ok: boolean }>;
  getMatchDetail: (data: { id: string }) => Promise<unknown>;
  listPlayers: () => Promise<Array<{
    teamName: string;
    teamColor: string;
    no: string;
    name: string;
    surname: string;
    position: string;
  }>>;
  getPlayerReport: (data: { teamName: string; playerNo: string }) => Promise<unknown>;
  listSeasonTeams: () => Promise<Array<{ id: string; name: string; color: string }>>;
  getSeasonBoxScore: (data: { teamName: string }) => Promise<unknown>;
  getStandingsConfig: () => Promise<{
    pointsWin: number;
    pointsDraw: number;
    pointsLoss: number;
    bonuses: Record<string, { bonus_08: number; bonus_10: number }>;
  }>;
  updateStandingsPoints: (data: { pointsWin: number; pointsDraw: number; pointsLoss: number }) => Promise<{ ok: boolean }>;
  updateTeamBonus: (data: { teamName: string; bonus_08: number; bonus_10: number }) => Promise<{ ok: boolean }>;
  isUnlocked: () => Promise<{ unlocked: boolean }>;
  unlockSite: (data: { password: string }) => Promise<{ ok: boolean; error?: string }>;
  lockSite: () => Promise<{ ok: boolean }>;
  getDatabaseStatus: () => Promise<{
    matchCount: number;
    playerCount: number;
    teamCount: number;
    empty: boolean;
    onboardingComplete: boolean;
  }>;
  markOnboardingComplete: () => Promise<{ ok: boolean }>;
  exportBackup: () => Promise<{ ok: boolean; canceled?: boolean; filePath?: string; error?: string }>;
  importBackup: () => Promise<{ ok: boolean; canceled?: boolean; error?: string }>;
  getAppVersion: () => Promise<string>;
  getUpdateStatus: () => Promise<{
    configured: boolean;
    version: string;
    state: string;
    message: string;
    updateVersion?: string;
  }>;
  checkForUpdates: () => Promise<{
    configured: boolean;
    version: string;
    state: string;
    message: string;
    updateVersion?: string;
  }>;
  downloadUpdate: () => Promise<{
    configured: boolean;
    version: string;
    state: string;
    message: string;
    updateVersion?: string;
  }>;
  installUpdate: () => Promise<{ ok: boolean }>;
  onUpdateEvent: (callback: (payload: {
    configured: boolean;
    version: string;
    state: string;
    message: string;
    updateVersion?: string;
  }) => void) => () => void;
};

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
