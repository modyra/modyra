/**
 * The development server answers its own page and build, under its own name, and nothing else.
 *
 * Bound to the loopback address it is still reachable from any page the developer has open, so two
 * things are refused: a request naming another host (a site that points its own name at 127.0.0.1),
 * and any path outside the page and `dist` — sources, tests, and `node_modules`, whose links lead into
 * the whole workspace. A link inside `dist` that points elsewhere is refused by where it really leads.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer, request } from "node:http";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { handleRequest } from "../server.mjs";

const here = dirname(fileURLToPath(import.meta.url));
let root;
let server;
let port;

before(async () => {
  // Inside the test folder rather than the system temp directory, and removed afterwards.
  root = mkdtempSync(join(here, ".server-"));
  mkdirSync(join(root, "dist"));
  writeFileSync(join(root, "index.html"), "<p>page</p>");
  writeFileSync(join(root, "dist", "app.js"), "export {};");
  writeFileSync(join(root, "package.json"), "{}");
  writeFileSync(join(root, "secret.txt"), "outside dist");
  symlinkSync(join(root, "secret.txt"), join(root, "dist", "leak.txt"));
  server = createServer((req, res) => handleRequest(req, res, { root, port }));
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  port = server.address().port;
});

after(() => {
  server.close();
  rmSync(root, { recursive: true, force: true });
});

function get(path, host = `127.0.0.1:${port}`) {
  return new Promise((done, fail) => {
    const req = request({ host: "127.0.0.1", port, path, headers: { host } }, (res) => {
      res.resume();
      res.on("end", () => done(res.statusCode));
    });
    req.on("error", fail);
    req.end();
  });
}

test("the page and the build are served under the server's own names", async () => {
  assert.equal(await get("/"), 200);
  assert.equal(await get("/dist/app.js"), 200);
  assert.equal(await get("/dist/app.js", `localhost:${port}`), 200);
});

test("a request naming another host is refused", async () => {
  assert.equal(await get("/", `attacker.example:${port}`), 421);
  assert.equal(await get("/dist/app.js", "127.0.0.1:1"), 421);
});

test("nothing outside the page and dist is served", async () => {
  for (const path of ["/package.json", "/secret.txt", "/src/main.ts", "/dist/../package.json", "/dist/%2e%2e/package.json", "/dist"]) {
    assert.equal(await get(path), 404, path);
  }
});

test("a link inside dist that leads outside it is refused", async () => {
  assert.equal(await get("/dist/leak.txt"), 404);
});
