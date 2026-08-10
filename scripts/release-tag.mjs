#!/usr/bin/env node
/**
 * The tag names what was released.
 *
 * A release is whatever `changeset version` just bumped, which is not always `@modyra/core`: the
 * packages version independently, and a fix confined to one adapter moves that adapter alone. A tag
 * derived from core's version then either repeats a tag that already exists — the release stops
 * half-done, after the version commit — or claims a core release that contains nothing.
 *
 * So: core is the release when core moved, and every other package that moved carries its own tag.
 * All of them start with `v`, which is what the release workflow listens for.
 *
 *   node scripts/release-tag.mjs [<package.json path> …]
 *
 * With no arguments it reads the staged manifests, which is what it has to work with between
 * `git add` and `git commit`.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);

const staged = () =>
  execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((path) => /^packages\/[^/]+\/package\.json$/.test(path));

const paths = process.argv.slice(2).length > 0 ? process.argv.slice(2) : staged();

const released = paths.flatMap((path) => {
  const manifest = JSON.parse(readFileSync(resolve(ROOT, path), "utf8"));
  // `@modyra/angular` is private in source and published from its ng-packagr output, the same
  // exception `publish-workspace.mjs` and the tarball audit make.
  const published = manifest.private !== true || manifest.name === "@modyra/angular";
  if (!published || !manifest.version) return [];
  return [{ name: manifest.name, version: manifest.version }];
});

if (released.length === 0) {
  console.error("release-tag: nothing versioned — no publishable package changed");
  process.exit(1);
}

const core = released.find((pkg) => pkg.name === "@modyra/core");
const tags = core
  ? [`v${core.version}`]
  : released.map((pkg) => `v${pkg.name.replace("@modyra/", "")}-${pkg.version}`);

console.log(tags.join("\n"));
