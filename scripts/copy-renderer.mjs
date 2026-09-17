import fs from "node:fs";
import path from "node:path";

function findRenderer() {
  const candidates = ["dist/client", "dist", ".output/public"];
  return candidates.find((dir) => {
    return fs.existsSync(path.join(dir, "index.html")) || fs.existsSync(path.join(dir, "_shell.html"));
  });
}

const src = findRenderer();
if (!src) {
  console.error("No Vite renderer output with index.html/_shell.html was found (looked in dist/client, dist, .output/public).");
  process.exit(1);
}

const dest = path.join("electron-dist", "renderer");
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
const shell = path.join(dest, "_shell.html");
const index = path.join(dest, "index.html");
if (!fs.existsSync(index) && fs.existsSync(shell)) {
  fs.copyFileSync(shell, index);
}
if (!fs.existsSync(index)) {
  console.error(`Copied ${src} but no index.html was produced.`);
  process.exit(1);
}
console.log(`Copied renderer from ${src} -> ${dest}`);
