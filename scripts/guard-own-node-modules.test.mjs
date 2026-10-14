/**
 * The install guard refuses a node_modules shared with another tree and passes one the checkout owns.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import assert from "node:assert/strict";

const GUARD = new URL("./guard-own-node-modules.mjs", import.meta.url).pathname;
const work = mkdtempSync(join(tmpdir(), "modyra-guard-"));
after(() => rmSync(work, { recursive: true, force: true }));

const run = (dir, env = {}) => {
  const { MODYRA_ALLOW_SHARED_NODE_MODULES: _, ...rest } = process.env;
  try {
    execFileSync(process.execPath, [GUARD, dir], { env: { ...rest, ...env }, stdio: "pipe" });
    return 0;
  } catch (error) {
    return error.status;
  }
};

const tree = (name, ...dirs) => {
  const root = join(work, name);
  for (const dir of ["", ...dirs]) mkdirSync(join(root, dir), { recursive: true });
  return root;
};

const shared = tree("shared", ".bin", ".pnpm");

test("a checkout with its own node_modules, or none, passes", () => {
  assert.equal(run(tree("own", "node_modules/.bin", "node_modules/.pnpm")), 0);
  assert.equal(run(tree("empty")), 0);
});

test("a node_modules that is a symlink to another tree is refused", () => {
  const root = tree("linked");
  symlinkSync(shared, join(root, "node_modules"), "dir");
  assert.equal(run(root), 1);
  assert.equal(run(root, { MODYRA_ALLOW_SHARED_NODE_MODULES: "1" }), 0);
});

test("a real node_modules whose .bin is a symlink to another tree is refused", () => {
  const root = tree("partial", "node_modules/.pnpm");
  symlinkSync(join(shared, ".bin"), join(root, "node_modules/.bin"), "dir");
  assert.equal(run(root), 1);
});
