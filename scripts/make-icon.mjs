import fs from "node:fs";
import path from "node:path";
import pngToIco from "png-to-ico";

const root = path.resolve("assets");
const png = path.join(root, "icon.png");
const ico = path.join(root, "icon.ico");
const buf = await pngToIco(png);
fs.writeFileSync(ico, buf);
console.log(`Wrote ${ico}`);
