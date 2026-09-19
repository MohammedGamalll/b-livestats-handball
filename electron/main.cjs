const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const crypto = require("node:crypto");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

if (!app.isPackaged) {
  app.setPath("userData", path.join(app.getPath("appData"), "B-LiveStats-Handball-dev"));
}

const dbApi = require("./db.cjs");
const { setupAutoUpdater, registerUpdateIpc } = require("./updater.cjs");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
};

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function resolveBundledDatabase() {
  const candidates = [
    path.join(process.resourcesPath || "", "database.db"),
    path.join(__dirname, "..", "assets", "database.db"),
  ];
  return candidates.find(exists);
}

function ensureUserDatabase() {
  const destDir = app.getPath("userData");
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, "database.db");
  if (!exists(dest)) {
    const src = resolveBundledDatabase();
    if (!src) throw new Error("Bundled assets/database.db is missing.");
    fs.copyFileSync(src, dest);
  }
  return dest;
}

function loadSitePassword() {
  if (process.env.SITE_PASSWORD) return process.env.SITE_PASSWORD;
  const candidates = [
    path.join(process.resourcesPath || "", "site-config.json"),
    path.join(__dirname, "..", "assets", "site-config.json"),
  ];
  for (const p of candidates) {
    if (!exists(p)) continue;
    try {
      const json = JSON.parse(fs.readFileSync(p, "utf8"));
      if (json.sitePassword) return String(json.sitePassword);
    } catch {
      /* ignore */
    }
  }
  return "";
}

function passwordMatches(input, expected) {
  const a = crypto.createHash("sha256").update(String(input).trim(), "utf8").digest();
  const b = crypto.createHash("sha256").update(String(expected).trim(), "utf8").digest();
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function findRendererRoot() {
  const candidates = [
    path.join(process.resourcesPath || "", "renderer"),
    path.join(process.resourcesPath || "", "renderer", "client"),
    path.join(app.getAppPath(), "dist", "client"),
    path.join(app.getAppPath(), "dist"),
    path.join(app.getAppPath(), ".output", "public"),
    path.join(__dirname, "..", "dist", "client"),
    path.join(__dirname, "..", "dist"),
    path.join(__dirname, "..", ".output", "public"),
  ];
  return candidates.find((d) => exists(path.join(d, "index.html")) || exists(path.join(d, "_shell.html")));
}

function startStaticServer(root) {
  const rootResolved = path.resolve(root);
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url || "/", "http://127.0.0.1");
        let rel = decodeURIComponent(url.pathname);
        if (rel === "/") rel = "/index.html";
        let file = path.resolve(rootResolved, `.${rel}`);
        const inside = file === rootResolved || file.startsWith(rootResolved + path.sep);
        if (!inside || !exists(file) || fs.statSync(file).isDirectory()) {
          const index = path.join(rootResolved, "index.html");
          const shell = path.join(rootResolved, "_shell.html");
          file = exists(index) ? index : shell;
        }
        const ext = path.extname(file).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        fs.createReadStream(file).pipe(res);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err && err.message ? err.message : err));
      }
    });
    server.on("error", reject);
    server.listen(18765, "127.0.0.1", () => resolve(server));
  });
}

function iconPath() {
  const candidates = [
    path.join(__dirname, "..", "assets", "icon.ico"),
    path.join(process.resourcesPath || "", "icon.ico"),
  ];
  return candidates.find(exists);
}

function sidecarPaths(dbPath) {
  return [dbPath + "-wal", dbPath + "-shm"];
}

function removeSidecars(dbPath) {
  for (const extra of sidecarPaths(dbPath)) {
    if (exists(extra)) fs.unlinkSync(extra);
  }
}

function liveStatePath(name) {
  const safe = String(name || "b-livestats").replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(app.getPath("userData"), `${safe}.json`);
}

function backupDateStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function exportBackup(event) {
  const win = BrowserWindow.fromWebContents(event.sender) || undefined;
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: "Export database backup",
    defaultPath: `LiveStats_Backup_${backupDateStamp()}.bak`,
    filters: [
      { name: "LiveStats Backup", extensions: ["bak"] },
      { name: "SQLite Database", extensions: ["db"] },
    ],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    dbApi.checkpoint();
    fs.copyFileSync(dbApi.getDatabasePath(), filePath);
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to export backup." };
  }
}

async function importBackup(event) {
  const win = BrowserWindow.fromWebContents(event.sender) || undefined;
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: "Restore database backup",
    properties: ["openFile"],
    filters: [
      { name: "LiveStats Backup", extensions: ["bak", "db"] },
    ],
  });
  if (canceled || !filePaths?.[0]) return { ok: false, canceled: true };
  const src = filePaths[0];
  try {
    dbApi.validateBackupFile(src);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid backup file." };
  }
  const dest = dbApi.getDatabasePath();
  try {
    dbApi.closeDatabase();
    fs.copyFileSync(src, dest);
    removeSidecars(dest);
  } catch (err) {
    try {
      dbApi.initDatabase(dest);
    } catch {
      /* relaunch will recover */
    }
    return { ok: false, error: err instanceof Error ? err.message : "Failed to restore backup." };
  }
  app.relaunch();
  app.exit(0);
  return { ok: true };
}

function registerIpc() {
  const wrap = (fn) => async (_event, payload) => fn(payload);

  ipcMain.handle("db:listTeams", () => dbApi.listTeams());
  ipcMain.handle("db:saveTeam", wrap(dbApi.saveTeam));
  ipcMain.handle("db:deleteTeam", wrap(dbApi.deleteTeam));
  ipcMain.handle("db:listMatches", () => dbApi.listMatches());
  ipcMain.handle("db:saveMatch", wrap(dbApi.saveMatch));
  ipcMain.handle("db:deleteMatch", wrap(dbApi.deleteMatch));
  ipcMain.handle("db:getMatchDetail", wrap(dbApi.getMatchDetail));
  ipcMain.handle("db:listPlayers", () => dbApi.listPlayers());
  ipcMain.handle("db:getPlayerReport", wrap(dbApi.getPlayerReport));
  ipcMain.handle("db:listSeasonTeams", () => dbApi.listSeasonTeams());
  ipcMain.handle("db:getSeasonBoxScore", wrap(dbApi.getSeasonBoxScore));
  ipcMain.handle("db:getStandingsConfig", () => dbApi.getStandingsConfig());
  ipcMain.handle("db:updateStandingsPoints", wrap(dbApi.updateStandingsPoints));
  ipcMain.handle("db:updateTeamBonus", wrap(dbApi.updateTeamBonus));

  ipcMain.handle("gate:isUnlocked", () => ({ unlocked: dbApi.getSetting("unlocked") === "1" }));
  ipcMain.handle("gate:unlock", (_event, data) => {
    const expected = loadSitePassword();
    if (!expected) return { ok: false, error: "Site password is not configured." };
    const password = typeof data?.password === "string" ? data.password.trim() : "";
    if (!password) return { ok: false };
    if (!passwordMatches(password, expected)) return { ok: false };
    dbApi.setSetting("unlocked", "1");
    return { ok: true };
  });
  ipcMain.handle("gate:lock", () => {
    dbApi.setSetting("unlocked", "0");
    return { ok: true };
  });

  ipcMain.handle("db:status", () => dbApi.getDatabaseStatus());
  ipcMain.handle("db:markOnboardingComplete", () => dbApi.markOnboardingComplete());
  ipcMain.handle("export-backup", (event) => exportBackup(event));
  ipcMain.handle("import-backup", (event) => importBackup(event));
  ipcMain.handle("live:get", (_event, name) => {
    const file = liveStatePath(name);
    if (!exists(file)) return null;
    try {
      return fs.readFileSync(file, "utf8");
    } catch {
      return null;
    }
  });
  ipcMain.handle("live:set", (event, payload) => {
    const name = payload?.name || "b-livestats";
    const value = typeof payload?.value === "string" ? payload.value : "";
    const file = liveStatePath(name);
    if (exists(file) && value) {
      try {
        const prev = JSON.parse(fs.readFileSync(file, "utf8"));
        const incoming = JSON.parse(value);
        const prevRev = prev?.state?.persistRev ?? 0;
        const nextRev = incoming?.state?.persistRev ?? 0;
        if (nextRev < prevRev) return { ok: false, skipped: true };
        if (nextRev === prevRev) {
          const prevLog = JSON.stringify(prev?.state?.log ?? []);
          const nextLog = JSON.stringify(incoming?.state?.log ?? []);
          if (prevLog !== nextLog) return { ok: false, skipped: true };
        }
      } catch {
        /* overwrite unreadable files */
      }
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value, "utf8");
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.webContents.id !== event.sender.id) {
        win.webContents.send("live:changed", name);
      }
    }
    return { ok: true };
  });
  ipcMain.handle("live:remove", (_event, name) => {
    const file = liveStatePath(name);
    if (exists(file)) fs.unlinkSync(file);
    return { ok: true };
  });
  registerUpdateIpc();
}

function createWindow(startUrl) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: "B LiveStats Handball",
    icon: iconPath(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost")) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 1280,
          height: 800,
          icon: iconPath(),
          webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
          },
        },
      };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.once("ready-to-show", () => win.show());
  win.loadURL(startUrl);
  return win;
}

async function resolveStartUrl() {
  if (!app.isPackaged) return "http://127.0.0.1:8080";
  const root = findRendererRoot();
  if (!root) throw new Error("Packaged renderer (index.html) was not found.");
  const server = await startStaticServer(root);
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

app.whenReady().then(async () => {
  const dbPath = ensureUserDatabase();
  dbApi.initDatabase(dbPath);
  registerIpc();
  const startUrl = await resolveStartUrl();
  createWindow(startUrl);
  setupAutoUpdater();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(await resolveStartUrl());
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
