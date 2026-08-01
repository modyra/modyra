/**
 * This package knows nothing of the packages derived from it.
 *
 * `@modyra/widgets` is the framework-agnostic contract; `@modyra/angular`, `@modyra/lit` and
 * `@modyra/plain` consume it. The import graph has always been clean, and that is not the whole
 * rule: a file named after an adapter, or a comment citing one as the reference the contract
 * follows, inverts the responsibility just as surely and is not caught by any bundler.
 *
 * It had happened. An `angular-ui.json` recording one adapter's rendered surface, and an
 * `angular-dom/` beside it, sat in this package's `contract-baseline/` — the directory that holds
 * what the *catalogue* declares. Nothing imported them, so nothing complained.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const ADAPTERS = ["angular", "lit", "plain"];
const SKIP = new Set(["node_modules", "dist", "coverage"]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(root);

test("no file in this package is named after a package derived from it", () => {
  const named = files
    .map((file) => file.slice(root.length))
    .filter((file) => ADAPTERS.some((adapter) => file.toLowerCase().includes(adapter)));
  assert.deepEqual(named, [], "an adapter's own material belongs in that adapter's package");
});

test("no comment here cites a derived package as the contract's reference", () => {
  const offenders = [];
  for (const file of files) {
    if (!/\.(ts|mjs|js)$/.test(file) || file.includes("independence.spec")) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (!/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      // "plain" is an ordinary English word — "a plain button", "a plain array" — so only the
      // package spelling counts against it.
      if (/\bAngular\b/.test(line) || /@modyra\/(angular|lit|plain)/.test(line) || /\bLit\b/.test(line)) {
        offenders.push(`${file.slice(root.length)}:${index + 1}`);
      }
    });
  }
  assert.deepEqual(offenders, [], "describe the contract, not who consumes it");
});
