import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, copyFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const files = [
  "index.html", "styles.css", "game.js", "offline.js", "manifest.webmanifest",
  ...[1, 2, 3, 4].map((n) => `assets/wolf-pos-${n}.webp`),
  ...[180, 192, 512].map((n) => `assets/icon-${n}.png`),
];
const template = await readFile(path.join(root, "scripts/service-worker.js"), "utf8");
const hash = createHash("sha256").update(template);
for (const file of files) hash.update(file).update(await readFile(path.join(root, file)));
const version = hash.digest("hex").slice(0, 20);
const worker = template.replace("__VERSION__", version)
  .replace("__FILES__", JSON.stringify(files.map((file) => `./${file}`), null, 2));
await writeFile(path.join(root, "sw.js"), worker);
const dist = path.join(root, "dist");
await rm(dist, { recursive: true, force: true });
for (const file of [...files, "sw.js", ".nojekyll"]) {
  await mkdir(path.dirname(path.join(dist, file)), { recursive: true });
  await copyFile(path.join(root, file), path.join(dist, file));
}
console.log(`Built ${files.length + 2} local files; offline version ${version}`);
