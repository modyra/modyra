#!/usr/bin/env node
/**
 * An install writes only into its own checkout's `node_modules`.
 *
 * pnpm follows a symlinked `node_modules` (or a symlinked `.bin` / `.pnpm` inside it) and writes
 * through it: an install run in one git worktree then rewrites another checkout's shims and store
 * links so they point into the worktree, and that other checkout breaks as soon as the worktree
 * moves or changes. Runs as `pnpm:devPreinstall`, before pnpm links anything, and refuses the
 * install when any of those directories is a symlink or resolves outside the checkout.
 *
 * Only reads: it never deletes, relinks or repairs. A path that does not exist passes.
 * `MODYRA_ALLOW_SHARED_NODE_MODULES=1` skips the check for an install that means to share.
 *
 * Only the checkout's root `node_modules` is checked. The `node_modules` entries inside each
 * workspace package are symlinks into the root's `.pnpm` by design, and refusing them would refuse
 * every install.
 *
 * What it does not cover: pnpm decides whether to purge `node_modules` (after a store or layout
 * change) before it runs `devPreinstall`, so a purge prompt can appear before this check does, and
 * accepting it empties the directory the symlink points at — the other tree's install. Answer no.
 * `setup` runs this script before calling pnpm at all, which covers that path when it is the entry.
 *
 *   node scripts/guard-own-node-modules.mjs [<checkout dir>]
 *
 * With no argument it checks the checkout this script belongs to.
 */
import { lstatSync, readlinkSync, realpathSync } from "node:fs";
import { join, relative, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const OVERRIDE = "MODYRA_ALLOW_SHARED_NODE_MODULES";

if (process.env[OVERRIDE] === "1") process.exit(0);

const root = realpathSync(resolve(process.argv[2] ?? fileURLToPath(new URL("..", import.meta.url))));
const inside = (path) => {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

const problems = [];
for (const name of ["node_modules", "node_modules/.bin", "node_modules/.pnpm"]) {
  const path = join(root, name);
  let stat;
  try {
    stat = lstatSync(path);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") continue;
    throw error;
  }
  if (stat.isSymbolicLink()) {
    let target;
    try {
      target = realpathSync(path);
    } catch {
      target = `${readlinkSync(path)} (dangling)`;
    }
    problems.push(`${name} is a symlink to ${target}`);
    if (name === "node_modules") break;
    continue;
  }
  const real = realpathSync(path);
  if (!inside(real)) problems.push(`${name} resolves to ${real}, outside ${root}`);
}

if (problems.length > 0) {
  console.error(`Refusing to install: this checkout's node_modules is shared with another tree.`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(`An install here would rewrite that tree's links. Give this checkout its own node_modules,`);
  console.error(`or set ${OVERRIDE}=1 if sharing is intended.`);
  process.exit(1);
}
