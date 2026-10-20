import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const port = Number(process.env.WOLF_PORT || 4173);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp" };
http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    let pathname = decodeURIComponent(url.pathname).replace(/^\/wolf-game\//, "/");
    if (pathname === "/") pathname = "/index.html";
    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(root)) { response.writeHead(403).end(); return; }
    const bytes = await readFile(file);
    response.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    response.end(bytes);
  } catch { response.writeHead(404).end("Not found"); }
}).listen(port, "127.0.0.1", () => console.log(`Preview: http://localhost:${port}/wolf-game/`));
