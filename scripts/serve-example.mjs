/**
 * Zero-dependency static server for the built examples:
 * `node scripts/serve-example.mjs <plain|lit> [port]`.
 *
 * It also brings up the Rust form API the demos talk to, and holds a lease on it while it runs. A
 * demo that needs a server it cannot start is a demo that shows a hole and blames the person
 * looking at it.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { extname, join, normalize } from "node:path";

const example = process.argv[2];
const port = Number(process.argv[3] ?? 4300);
if (!example) {
  console.error("usage: node scripts/serve-example.mjs <plain|lit> [port]");
  process.exit(1);
}

const API = "http://127.0.0.1:3000";
const CLIENT = `demo-${example}`;

/** Whether the API is answering, and in which regime. `null` when nothing is there. */
async function health() {
  try {
    const response = await fetch(`${API}/health`, { signal: AbortSignal.timeout(700) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

/**
 * Hold this demo's lease open.
 *
 * The lease is named, so restarting this demo renews one rather than stacking two, and the API
 * counts demos rather than requests. Renewed at the interval the API itself names — a number
 * written here would be a second copy of the server's TTL, free to drift from it.
 */
async function holdLease() {
  const open = async () => {
    try {
      const response = await fetch(`${API}/lease`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client: CLIENT }),
        signal: AbortSignal.timeout(700),
      });
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    }
  };
  const first = await open();
  if (!first) return;
  const every = Math.max(1, Number(first.renewWithinSeconds) || 10) * 1000;
  const timer = setInterval(open, every);
  timer.unref?.();
}

/**
 * Start the API if nothing is answering, linked to this demo's life.
 *
 * `--linked` is what makes it leave with the demos. Started by hand without the flag it stays, and
 * this sees a healthy server and simply borrows it — the arrival order does not decide anybody's
 * fate, which is the whole point of the flag being the launcher's word rather than a guess.
 */
async function ensureApi() {
  const running = await health();
  if (running) {
    console.log(`Modyra form API already up (${running.mode}) → ${API}`);
    return;
  }
  console.log("Modyra form API not running — starting it, linked to this demo…");
  const child = spawn(
    "cargo",
    ["run", "--quiet", "-p", "modyra-axum-form-server-example", "--", "--linked"],
    { cwd: "sdk/rust", stdio: "inherit", detached: false },
  );
  child.on("error", (error) => {
    console.warn(`could not start the form API (${error.message}). The checkout section will say so.`);
  });
  // Building it the first time is not instant, and a demo that gave up after a second would report
  // "no server" while one was compiling.
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (await health()) {
      console.log(`Modyra form API → ${API}`);
      return;
    }
  }
  console.warn("the form API did not come up in 60s; the checkout section will say so.");
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
}).listen(port, async () => {
  console.log(`Modyra × ${example} → http://localhost:${port}`);
  await ensureApi();
  await holdLease();
});
