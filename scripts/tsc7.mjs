/**
 * Compiles the given projects with the native TypeScript 7 compiler, in the order they are listed.
 *
 * Build scripts name the compiler through this file rather than calling `tsc`, because the bin that
 * name resolves to is decided by the package manager: with both `typescript` and the `typescript7`
 * alias installed, `node_modules/.bin/tsc` is whichever one pnpm linked last. Resolving the module
 * by name is deterministic, so the compiler that emits the published artifacts is a stated fact
 * rather than an artefact of install order.
 *
 * `MODYRA_TSC=typescript` compiles everything with the primary dependency instead — the fallback if
 * an emit difference is ever found, and the way to compare the two compilers on the same sources.
 *
 * Angular is not compiled here: ng-packagr and jest-preset-angular load the `typescript` module
 * directly, and their peer ranges stop below 7.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const dependency = process.env.MODYRA_TSC ?? "typescript7";
const projects = process.argv.slice(2);

if (projects.length === 0) {
  console.error("usage: node scripts/tsc7.mjs <tsconfig.json…>");
  process.exit(1);
}

let bin;
try {
  bin = resolve(dirname(require.resolve(`${dependency}/package.json`, { paths: [root] })), "bin/tsc");
} catch {
  console.error(`${dependency} is not installed; run pnpm install`);
  process.exit(1);
}

const version = execFileSync(process.execPath, [bin, "--version"], { encoding: "utf8" })
  .trim()
  .replace(/^Version\s+/, "");

// The default compiler is pinned to a major: an install that silently resolved something else would
// otherwise change what ships without changing a single line of this repository.
if (dependency === "typescript7" && !version.startsWith("7.")) {
  console.error(`typescript7 resolves to ${version}; the libraries are compiled with the 7.x line`);
  process.exit(1);
}

for (const project of projects) {
  try {
    execFileSync(process.execPath, [bin, "-p", project], { cwd: root, stdio: "inherit" });
  } catch (error) {
    console.error(`TypeScript ${version} failed on ${project}`);
    process.exit(error.status ?? 1);
  }
}
