import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".map": "application/json",
};

function isInsideRoot(path) {
  return path === root || path.startsWith(root + sep);
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  const relative = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const path = normalize(join(root, relative));

  if (!isInsideRoot(path) || !existsSync(path) || !statSync(path).isFile()) {
    res.writeHead(404);
    res.end();
    return;
  }

  res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
  createReadStream(path).pipe(res);
}).listen(4324, "127.0.0.1", () => console.log("Modyra Plain Preview http://127.0.0.1:4324"));
