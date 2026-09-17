const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const root = path.join(__dirname, "..");
const assetsDir = path.join(root, "assets");
const schemaPath = path.join(root, "electron", "schema.sql");
const dbPath = path.join(assetsDir, "database.db");
const envPath = path.join(root, ".env");

fs.mkdirSync(assetsDir, { recursive: true });

if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const db = new Database(dbPath);
db.exec(fs.readFileSync(schemaPath, "utf8"));
db.close();

let sitePassword = "";
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, "utf8");
  const match = env.match(/^SITE_PASSWORD\s*=\s*"?([^"\r\n]+)"?/m);
  if (match) sitePassword = match[1].trim();
}
fs.writeFileSync(
  path.join(assetsDir, "site-config.json"),
  JSON.stringify({ sitePassword }, null, 2),
);

console.log(`Created ${dbPath}`);
console.log(`Wrote ${path.join(assetsDir, "site-config.json")}`);
