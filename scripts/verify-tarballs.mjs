#!/usr/bin/env node
/**
 * Packs every publishable package, installs the tarballs into an empty project, and resolves every
 * subpath each one declares.
 *
 * What this catches that nothing else does: a package whose `exports` names a subpath the tarball
 * does not contain. The repository resolves those paths through the workspace, where the source sits
 * beside the manifest whether or not `files` ships it — so every import in this tree succeeds while
 * the published artefact has nothing at that path. Six versions went out grey that way.
 *
 * The tarballs are installed **together**, because a package that depends on a sibling must resolve
 * it from what was packed rather than from the workspace. Installing one at a time would take the
 * sibling from the registry — the previous release — and pass while the new pair does not fit.
 *
 * `pnpm pack` rather than `npm pack`: a workspace dependency is written `workspace:*` in the manifest
 * and only the workspace's own packer rewrites it to a version. An `npm pack` tarball carries the
 * protocol through and cannot be installed anywhere.
 *
 * **Resolution is the claim; loading is not.** The defect being hunted is a declared subpath with
 * nothing behind it, and `require.resolve` answers exactly that. Loading a module additionally needs
 * its peers present — an Angular entry point cannot execute without `@angular/core` — so a probe that
 * imports everything reports a package as broken for a dependency the consumer is required to bring.
 * That is the instrument failing toward "there is a hole", which is the direction that wastes a day.
 * So: every subpath is resolved, and only a package that declares no peer is also imported.
 *
 * A `.css` or `.json` subpath is resolved and never imported: both are real entries a consumer names
 * and a missing one is the same defect, but neither is a module.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

/** Every package that publishes, and the directory its manifest lives in. */
function publishable() {
  const out = [];
  for (const dir of readdirSync(join(ROOT, "packages"))) {
    const manifest = join(ROOT, "packages", dir, "package.json");
    if (!existsSync(manifest)) continue;
    const json = JSON.parse(readFileSync(manifest, "utf8"));
    if (json.private) continue;
    out.push({ name: json.name, dir: join(ROOT, "packages", dir), exports: json.exports ?? { ".": true },
      peers: Object.keys(json.peerDependencies ?? {}) });
  }
  // Built by ng-packagr into a directory of its own, with a manifest ng-packagr writes. It is not
  // under `packages/*` as a manifest, so every sweep that walks that glob misses it — and it is the
  // package whose `dist` is stalest by construction.
  const angular = join(ROOT, "packages", "angular", "dist");
  if (existsSync(join(angular, "package.json"))) {
    const json = JSON.parse(readFileSync(join(angular, "package.json"), "utf8"));
    out.push({ name: json.name, dir: angular, exports: json.exports ?? { ".": true },
      peers: Object.keys(json.peerDependencies ?? {}) });
  }
  return out;
}

const packages = publishable();
if (packages.length === 0) {
  console.error("verify-tarballs: no publishable package found, which is a broken run rather than a clean one");
  process.exit(2);
}

const work = mkdtempSync(join(tmpdir(), "mdy-tarballs-"));
const tarballs = [];
const weights = [];

try {
  for (const one of packages) {
    const name = run("pnpm", ["pack", "--pack-destination", work], one.dir).trim().split("\n").pop().trim();
    const file = name.startsWith("/") ? name : join(work, name);
    tarballs.push(file);
    weights.push({ name: one.name, kb: statSync(file).size / 1000 });
  }

  writeFileSync(join(work, "package.json"), JSON.stringify({ name: "mdy-tarball-probe", private: true, type: "module" }, null, 2));
  run("npm", ["install", "--no-audit", "--no-fund", ...tarballs], work);

  const missing = [];
  let asked = 0;
  let unloadable = 0;
  for (const one of packages) {
    for (const sub of Object.keys(one.exports)) {
      const specifier = sub === "." ? one.name : `${one.name}/${sub.replace(/^\.\//, "")}`;
      asked += 1;
      const asset = /\.(css|json)$/.test(specifier);
      const loadable = !asset && one.peers.length === 0;
      const probe = `import("node:module").then(async (m) => {`
        + ` const r = m.createRequire(${JSON.stringify(join(work, "probe.js"))});`
        + ` r.resolve(${JSON.stringify(specifier)});`
        + (loadable ? ` await import(${JSON.stringify(specifier)});` : "")
        + ` }).catch((e) => { console.error(e && e.message ? e.message : String(e)); process.exit(1); })`;
      try {
        run(process.execPath, ["-e", probe], work);
        if (!loadable) unloadable += 1;
      } catch (error) {
        const said = String(error.stderr ?? error).trim().split("\n").filter(Boolean).pop() ?? "did not resolve";
        missing.push(`${specifier} — ${said}`);
      }
    }
  }

  console.log(`tarballs: ${packages.length} packed and installed together`);
  for (const w of weights.sort((a, b) => b.kb - a.kb)) console.log(`  ${w.name.padEnd(28)} ${w.kb.toFixed(1)} kB`);
  console.log(`subpaths asked: ${asked} — ${asked - unloadable} resolved and loaded, `
    + `${unloadable} resolved only (an asset, or a package whose peers a consumer brings)`);

  if (missing.length > 0) {
    console.error(`\n${missing.length} subpath(s) a consumer can name do not resolve from the tarball:`);
    for (const m of missing) console.error(`  ${m}`);
    console.error("\nThe workspace resolves these from source beside the manifest; the published artefact has nothing there.");
    process.exit(1);
  }
  console.log("EVERY DECLARED SUBPATH RESOLVES FROM ITS TARBALL");
} finally {
  rmSync(work, { recursive: true, force: true });
}
