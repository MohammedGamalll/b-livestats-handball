const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

function exists(p) {
  try {
    return Boolean(p) && fs.existsSync(p);
  } catch {
    return false;
  }
}

function loadJson(p) {
  try {
    if (!exists(p)) return {};
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function getAutoUpdater() {
  return require("electron-updater").autoUpdater;
}

function loadUpdateSettings() {
  const fromFeed = loadJson(path.join(__dirname, "update-feed.json"));
  const fromSite = loadJson(
    [
      path.join(process.resourcesPath || "", "site-config.json"),
      path.join(__dirname, "..", "assets", "site-config.json"),
    ].find(exists) || "",
  );
  const updates = { ...fromFeed, ...(fromSite.updates || {}) };
  return updates;
}

function resolveFeed() {
  const updates = loadUpdateSettings();
  const genericUrl = process.env.BLIVESTATS_UPDATE_URL || updates.url;
  if (genericUrl) {
    return { provider: "generic", url: String(genericUrl).replace(/\/?$/, "/") };
  }
  const owner = process.env.BLIVESTATS_GH_OWNER || updates.owner;
  const repo = process.env.BLIVESTATS_GH_REPO || updates.repo;
  if (owner && repo) {
    return { provider: "github", owner: String(owner), repo: String(repo) };
  }
  return null;
}

let lastStatus = {
  configured: false,
  version: "",
  state: "idle",
  message: "",
  updateVersion: "",
};

function broadcast(payload) {
  lastStatus = { ...lastStatus, ...payload, version: app.getVersion() };
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("update:event", lastStatus);
  }
}

function setupAutoUpdater() {
  lastStatus.version = app.getVersion();
  const feed = resolveFeed();
  if (!app.isPackaged) {
    lastStatus = {
      ...lastStatus,
      configured: Boolean(feed),
      state: "dev",
      message: "Updates apply only in the installed app, not in electron:dev.",
    };
    return;
  }
  if (!feed) {
    lastStatus = {
      ...lastStatus,
      configured: false,
      state: "unconfigured",
      message: "Update feed is not set. Put GitHub owner/repo in electron/update-feed.json.",
    };
    return;
  }

  const autoUpdater = getAutoUpdater();
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = console;
  try {
    autoUpdater.setFeedURL(feed);
  } catch (err) {
    lastStatus = {
      ...lastStatus,
      configured: false,
      state: "error",
      message: err instanceof Error ? err.message : String(err),
    };
    return;
  }

  lastStatus.configured = true;
  lastStatus.state = "idle";
  lastStatus.message = "Ready to check for updates.";

  autoUpdater.on("checking-for-update", () => {
    broadcast({ state: "checking", message: "Checking for updates…" });
  });
  autoUpdater.on("update-available", (info) => {
    broadcast({
      state: "available",
      updateVersion: info?.version || "",
      message: `Version ${info?.version || ""} is available.`,
    });
    const win = BrowserWindow.getAllWindows()[0];
    dialog
      .showMessageBox(win, {
        type: "info",
        title: "Update available",
        message: `B LiveStats ${info?.version} is available.`,
        detail: "Download now? You can keep working until you restart.",
        buttons: ["Later", "Download"],
        defaultId: 1,
        cancelId: 0,
      })
      .then((res) => {
        if (res.response === 1) void autoUpdater.downloadUpdate();
      })
      .catch(() => {});
  });
  autoUpdater.on("update-not-available", () => {
    broadcast({ state: "none", message: "You are on the latest version." });
  });
  autoUpdater.on("download-progress", (p) => {
    const pct = Math.round(p.percent || 0);
    broadcast({ state: "downloading", message: `Downloading update… ${pct}%` });
  });
  autoUpdater.on("update-downloaded", (info) => {
    broadcast({
      state: "ready",
      updateVersion: info?.version || lastStatus.updateVersion,
      message: "Update downloaded. Restart to install.",
    });
    const win = BrowserWindow.getAllWindows()[0];
    dialog
      .showMessageBox(win, {
        type: "info",
        title: "Update ready",
        message: "The update was downloaded.",
        detail: "Restart now to install. Finish any live match first.",
        buttons: ["Later", "Restart now"],
        defaultId: 1,
        cancelId: 0,
      })
      .then((res) => {
        if (res.response === 1) autoUpdater.quitAndInstall(false, true);
      })
      .catch(() => {});
  });
  autoUpdater.on("error", (err) => {
    broadcast({ state: "error", message: err instanceof Error ? err.message : String(err) });
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      broadcast({ state: "error", message: err instanceof Error ? err.message : String(err) });
    });
  }, 8000);
}

function registerUpdateIpc() {
  ipcMain.handle("app:version", () => app.getVersion());
  ipcMain.handle("update:status", () => ({ ...lastStatus, version: app.getVersion() }));
  ipcMain.handle("update:check", async () => {
    if (!app.isPackaged) return { ...lastStatus, version: app.getVersion() };
    if (!lastStatus.configured) return lastStatus;
    try {
      await getAutoUpdater().checkForUpdates();
    } catch (err) {
      broadcast({ state: "error", message: err instanceof Error ? err.message : String(err) });
    }
    return lastStatus;
  });
  ipcMain.handle("update:download", async () => {
    try {
      await getAutoUpdater().downloadUpdate();
    } catch (err) {
      broadcast({ state: "error", message: err instanceof Error ? err.message : String(err) });
    }
    return lastStatus;
  });
  ipcMain.handle("update:install", () => {
    getAutoUpdater().quitAndInstall(false, true);
    return { ok: true };
  });
}

module.exports = { setupAutoUpdater, registerUpdateIpc };
