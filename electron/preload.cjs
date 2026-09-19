const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  listTeams: () => ipcRenderer.invoke("db:listTeams"),
  saveTeam: (data) => ipcRenderer.invoke("db:saveTeam", data),
  deleteTeam: (data) => ipcRenderer.invoke("db:deleteTeam", data),
  listMatches: () => ipcRenderer.invoke("db:listMatches"),
  saveMatch: (data) => ipcRenderer.invoke("db:saveMatch", data),
  deleteMatch: (data) => ipcRenderer.invoke("db:deleteMatch", data),
  getMatchDetail: (data) => ipcRenderer.invoke("db:getMatchDetail", data),
  listPlayers: () => ipcRenderer.invoke("db:listPlayers"),
  getPlayerReport: (data) => ipcRenderer.invoke("db:getPlayerReport", data),
  listSeasonTeams: () => ipcRenderer.invoke("db:listSeasonTeams"),
  getSeasonBoxScore: (data) => ipcRenderer.invoke("db:getSeasonBoxScore", data),
  getStandingsConfig: () => ipcRenderer.invoke("db:getStandingsConfig"),
  updateStandingsPoints: (data) => ipcRenderer.invoke("db:updateStandingsPoints", data),
  updateTeamBonus: (data) => ipcRenderer.invoke("db:updateTeamBonus", data),
  isUnlocked: () => ipcRenderer.invoke("gate:isUnlocked"),
  unlockSite: (data) => ipcRenderer.invoke("gate:unlock", data),
  lockSite: () => ipcRenderer.invoke("gate:lock"),
  getDatabaseStatus: () => ipcRenderer.invoke("db:status"),
  markOnboardingComplete: () => ipcRenderer.invoke("db:markOnboardingComplete"),
  exportBackup: () => ipcRenderer.invoke("export-backup"),
  importBackup: () => ipcRenderer.invoke("import-backup"),
  getAppVersion: () => ipcRenderer.invoke("app:version"),
  getUpdateStatus: () => ipcRenderer.invoke("update:status"),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  getLiveState: (name) => ipcRenderer.invoke("live:get", name),
  setLiveState: (name, value) => ipcRenderer.invoke("live:set", { name, value }),
  removeLiveState: (name) => ipcRenderer.invoke("live:remove", name),
  onLiveStateChanged: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("live:changed", listener);
    return () => ipcRenderer.removeListener("live:changed", listener);
  },
  onUpdateEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("update:event", listener);
    return () => ipcRenderer.removeListener("update:event", listener);
  },
});
