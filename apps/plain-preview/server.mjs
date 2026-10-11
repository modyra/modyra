import { createReadStream, realpathSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));
const PORT = 4324;
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".map": "application/json",
};

/**
 * What this server answers: the page, and what the build put in `dist`. Nothing else in the app
 * folder is for a browser — sources, tests, and `node_modules`, whose links lead out of the folder
 * into the whole workspace.
 */
function servedFile(pathname, root) {
  if (pathname === "/" || pathname === "/index.html") return join(root, "index.html");
  const dist = join(root, "dist");
  const path = normalize(join(root, pathname.slice(1)));
  if (!path.startsWith(dist + sep)) return null;
  // The real location, links followed: a link inside `dist` that points elsewhere is refused.
  try {
    const real = realpathSync(path);
    return real.startsWith(realpathSync(dist) + sep) && statSync(real).isFile() ? real : null;
  } catch {
    return null;
  }
}

/**
 * Whether a request names this server. Bound to the loopback address, it is still reachable by any
 * page the developer has open: a hostile site can point its own name at 127.0.0.1 and read
 * responses as same-origin. That site's name is in the Host header, so only this server's own names
 * are answered.
 */
function addressedHere(host, port) {
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

export function handleRequest(req, res, { root = appRoot, port = PORT } = {}) {
  if (!addressedHere(req.headers.host, port)) {
    res.writeHead(421);
    res.end();
    return;
  }
  const url = new URL(req.url ?? "/", "http://x");
  const path = servedFile(url.pathname, root);
  if (path === null) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
  const stream = createReadStream(path);
  stream.on("error", () => {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
  res.on("close", () => stream.destroy());
  stream.pipe(res);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer((req, res) => handleRequest(req, res))
    .listen(PORT, "127.0.0.1", () => console.log(`Modyra Plain Preview http://127.0.0.1:${PORT}`));
}
