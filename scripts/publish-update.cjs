const { spawn, execSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const outDir = path.join(root, "release-publish");
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

function ghToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execSync("gh auth token", { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const token = ghToken();
if (!token) {
  console.error("Set GH_TOKEN or run: gh auth login");
  process.exit(1);
}

try {
  execSync(`gh repo view ${owner}/${repo}`, { stdio: "ignore" });
} catch {
  console.log(`Creating public repo ${owner}/${repo}…`);
  execSync(`gh repo create ${owner}/${repo} --public --description "B LiveStats Handball updates"`, {
    stdio: "inherit",
  });
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = pkg.version;
const tag = `v${version}`;
const setupName = "B-LiveStats-Handball-Setup.exe";
const setupPath = path.join(outDir, setupName);

function sha512File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha512");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("base64")));
  });
}

async function writeLatestYml() {
  const sha512 = await sha512File(setupPath);
  const size = fs.statSync(setupPath).size;
  const yml = [
    `version: ${version}`,
    "files:",
    `  - url: ${setupName}`,
    `    sha512: ${sha512}`,
    `    size: ${size}`,
    `path: ${setupName}`,
    `sha512: ${sha512}`,
    `releaseDate: '${new Date().toISOString()}'`,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "latest.yml"), yml);
}

function gh(args) {
  execSync(`gh ${args}`, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, GH_TOKEN: token, GITHUB_TOKEN: token },
  });
}

async function uploadRelease() {
  if (!fs.existsSync(setupPath)) {
    console.error(`Missing ${setupPath}. Build the installer first.`);
    process.exit(1);
  }
  await writeLatestYml();
  const assets = [setupPath, `${setupPath}.blockmap`, path.join(outDir, "latest.yml")]
    .filter((p) => fs.existsSync(p))
    .map((p) => `"${p}"`)
    .join(" ");
  let exists = false;
  try {
    execSync(`gh release view ${tag} --repo ${owner}/${repo}`, { stdio: "ignore" });
    exists = true;
  } catch {
    exists = false;
  }
  if (exists) {
    gh(`release upload ${tag} ${assets} --repo ${owner}/${repo} --clobber`);
  } else {
    gh(`release create ${tag} ${assets} --repo ${owner}/${repo} --title ${version} --notes "B LiveStats Handball ${version}"`);
  }
  console.log(`Published ${tag} → https://github.com/${owner}/${repo}/releases/tag/${tag}`);
}

const skipBuild = process.argv.includes("--upload-only");
if (skipBuild) {
  void uploadRelease().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  const args = [
    "electron-builder",
    "--win",
    "nsis",
    `--config.directories.output=release-publish`,
    "--publish",
    "never",
  ];
  const child = spawn("npx", args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, GH_TOKEN: token },
  });
  child.on("exit", (code) => {
    if (code) process.exit(code);
    void uploadRelease().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });
}
