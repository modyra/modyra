/**
 * Zero-dependency static server for any built directory:
 * `node scripts/serve-static.mjs <dir> [port]`.
 * Used by the Playwright smoke test to serve `dist/demo`.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const dir = process.argv[2];
const port = Number(process.argv[3] ?? 4173);
if (!dir) {
  console.error("usage: node scripts/serve-static.mjs <dir> [port]");
  process.exit(1);
}
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

createServer(async (req, res) => {
  const path = normalize(req.url === "/" ? "/index.html" : (req.url ?? "/")).replace(/^([/\\])+/, "");
  try {
    const body = await readFile(join(dir, path));
    res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    // SPA fallback: unknown paths serve the app shell.
    try {
      const body = await readFile(join(dir, "index.html"));
      res.writeHead(200, { "content-type": "text/html" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  }
}).listen(port, () => console.log(`Serving ${dir} → http://localhost:${port}`));
