import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const feedPath = path.join(root, "electron", "update-feed.json");
const feed = JSON.parse(fs.readFileSync(feedPath, "utf8"));
const owner = process.env.BLIVESTATS_GH_OWNER || feed.owner;
const repo = process.env.BLIVESTATS_GH_REPO || feed.repo || "b-livestats-handball";

if (!owner) {
  console.error(
    "Set GitHub username in electron/update-feed.json (owner) or BLIVESTATS_GH_OWNER, then run again.",
  );
  process.exit(1);
}

const nextFeed = { provider: "github", owner, repo };
fs.writeFileSync(feedPath, `${JSON.stringify(nextFeed, null, 2)}\n`);

const sitePath = path.join(root, "assets", "site-config.json");
if (fs.existsSync(sitePath)) {
  const site = JSON.parse(fs.readFileSync(sitePath, "utf8"));
  site.updates = nextFeed;
  fs.writeFileSync(sitePath, `${JSON.stringify(site, null, 2)}\n`);
}

if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
  console.error("Set GH_TOKEN (GitHub PAT with repo scope) or run: gh auth login");
  process.exit(1);
}

const args = [
  "electron-builder",
  "--win",
  "nsis",
  "--publish",
  "always",
  `--config.publish.provider=github`,
  `--config.publish.owner=${owner}`,
  `--config.publish.repo=${repo}`,
  `--config.publish.releaseType=release`,
];

const child = spawn("npx", args, {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
  },
});

child.on("exit", (code) => process.exit(code ?? 1));
