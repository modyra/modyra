/**
 * Zero-dependency static server for the built examples:
 * `node scripts/serve-example.mjs <react|vue|lit> [port]`.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const example = process.argv[2];
const port = Number(process.argv[3] ?? 4300);
if (!example) {
  console.error("usage: node scripts/serve-example.mjs <react|vue|lit> [port]");
  process.exit(1);
}
const root = join("dist/examples", example);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".map": "application/json" };

createServer(async (req, res) => {
  const path = normalize(req.url === "/" ? "/index.html" : (req.url ?? "/")).replace(/^([/\\])+/, "");
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(port, () => console.log(`Modyra × ${example} → http://localhost:${port}`));
