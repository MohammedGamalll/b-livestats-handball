const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const dbApi = require("../electron/db.cjs");

function p(no, name, surname, position, height, extra = {}) {
  return {
    no: String(no),
    name,
    surname,
    position,
    height,
    addInfo: extra.addInfo || "R / EGY",
    captain: Boolean(extra.captain),
    playing: Boolean(extra.playing),
  };
}

const cairoLions = {
  name: "Cairo Lions HC",
  shortName: "LIONS",
  color: "#d62828",
  coaches: [
    { name: "Hany", surname: "El-Masry", role: "Head Coach", country: "EGY" },
    { name: "Karim", surname: "Fouad", role: "Assistant Coach", country: "EGY" },
    { name: "Nader", surname: "Shawky", role: "Team Official", country: "EGY" },
  ],
  players: [
    p(1, "Omar", "Hassan", "GK", "192", { playing: true, addInfo: "R / EGY / starter" }),
    p(12, "Youssef", "Kamal", "GK", "188", { addInfo: "L / EGY" }),
    p(16, "Mostafa", "Adel", "GK", "195", { addInfo: "R / EGY" }),
    p(2, "Ali", "Nabil", "LW", "182", { playing: true }),
    p(7, "Tarek", "Samir", "LW", "180"),
    p(3, "Mahmoud", "Farouk", "LB", "194", { playing: true }),
    p(8, "Ibrahim", "Lotfy", "LB", "191"),
    p(4, "Ahmed", "Zaki", "CB", "186", { playing: true, captain: true, addInfo: "R / EGY / captain" }),
    p(10, "Sherif", "Hatem", "CB", "184"),
    p(5, "Khaled", "Amin", "RB", "193", { playing: true }),
    p(11, "Amr", "Selim", "RB", "190"),
    p(6, "Hassan", "Younes", "RW", "181", { playing: true }),
    p(13, "Fady", "Ramy", "RW", "179"),
    p(9, "Walid", "Mansour", "P", "198", { playing: true }),
    p(14, "Bassem", "Gaber", "P", "196"),
    p(15, "Sami", "Refaat", "P", "200"),
  ],
};

const alexSharks = {
  name: "Alexandria Sharks HC",
  shortName: "SHARKS",
  color: "#1565c0",
  coaches: [
    { name: "Tamer", surname: "Abdallah", role: "Head Coach", country: "EGY" },
    { name: "Maged", surname: "Helmy", role: "Assistant Coach", country: "EGY" },
    { name: "Ramy", surname: "Osman", role: "Team Official", country: "EGY" },
  ],
  players: [
    p(1, "Seif", "El-Din", "GK", "190", { playing: true, addInfo: "R / EGY / starter" }),
    p(12, "Hossam", "Fathy", "GK", "193", { addInfo: "R / EGY" }),
    p(16, "Badr", "Maher", "GK", "187", { addInfo: "L / EGY" }),
    p(2, "Marwan", "Said", "LW", "178", { playing: true }),
    p(7, "Ziad", "Ashraf", "LW", "183"),
    p(3, "Ehab", "Nasser", "LB", "196", { playing: true }),
    p(8, "Karim", "Galal", "LB", "192"),
    p(4, "Yassin", "Mostafa", "CB", "185", { playing: true, captain: true, addInfo: "R / EGY / captain" }),
    p(10, "Adham", "Sherif", "CB", "187"),
    p(5, "Nour", "Hany", "RB", "194", { playing: true }),
    p(11, "Othman", "Wael", "RB", "189"),
    p(6, "Hamza", "Kamel", "RW", "180", { playing: true }),
    p(13, "Anas", "Tawfik", "RW", "182"),
    p(9, "Gaber", "Soliman", "P", "199", { playing: true }),
    p(14, "Loay", "Reda", "P", "197"),
    p(15, "Hazem", "Salah", "P", "201"),
  ],
};

function seedPath(dbPath) {
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const bundled = path.join(__dirname, "..", "assets", "database.db");
    if (fs.existsSync(bundled) && path.resolve(bundled) !== path.resolve(dbPath)) {
      fs.copyFileSync(bundled, dbPath);
    }
  }
  dbApi.initDatabase(dbPath);
  const a = dbApi.saveTeam(cairoLions);
  const b = dbApi.saveTeam(alexSharks);
  const teams = dbApi.listTeams();
  dbApi.closeDatabase();
  console.log(`Seeded ${dbPath}`);
  console.log(`  Cairo Lions HC  ${a.id}  (${teams.find((t) => t.id === a.id)?.players.length || 0} players)`);
  console.log(`  Alexandria Sharks HC  ${b.id}  (${teams.find((t) => t.id === b.id)?.players.length || 0} players)`);
}

const targets = [
  path.join(__dirname, "..", "assets", "database.db"),
  path.join(os.homedir(), "AppData", "Roaming", "B LiveStats Handball", "database.db"),
];

for (const dbPath of targets) {
  try {
    seedPath(dbPath);
  } catch (err) {
    console.error(`Failed ${dbPath}:`, err instanceof Error ? err.message : err);
  }
}
