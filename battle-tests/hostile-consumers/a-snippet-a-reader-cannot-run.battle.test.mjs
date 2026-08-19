/**
 * The imports the guides show, resolved against what the packages actually export.
 *
 * A guide's code block is not illustration: it is the first code a consumer runs, copied whole. So
 * every name it imports as a **value** has to be a value the package exports — a type imported
 * without the `type` keyword compiles under a plain `tsc`, which erases it, and then fails in the
 * two places a reader is most likely to be:
 *
 *     verbatimModuleSyntax   TS1484 — "is a type and must be imported using a type-only import"
 *     a plain .mjs / .js     SyntaxError: does not provide an export named '<name>'
 *
 * `docs/examples/feature-tour/feature-tour.test.mjs` runs one page's snippets and its own header
 * records two of them being wrong when they were written. This asks the smaller question of every
 * page at once: not whether the snippet works, only whether the names in its import lines exist.
 *
 * Read from the built packages rather than from a list, because a list is a third surface that can
 * disagree. `CHANGELOG.md` and `.changeset/` are excluded: they record what was true at a version,
 * and a name a release removed is meant to still be named there.
 *
 * Green when every value-imported name in the tracked markdown is a runtime export of the package
 * the line names.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { battle } from "../harness/battle.mjs";
import { expectClaim, expectEqual } from "../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, "..", "..");

/** `import { a, type B, c as d } from "@modyra/x"` — the whole clause, so the `type` prefix is visible. */
const IMPORT_CLAUSE = /import\s*(type\s+)?\{([^}]*)\}\s*from\s*["'](@modyra\/[a-z0-9-]+(?:\/[a-z0-9/-]+)?)["']/g;

/**
 * The entry points a plain node process cannot load, and why.
 *
 * Angular's `adapter` and `ui` pull in `PlatformLocation`, which needs a compiled platform — the
 * import fails with "needs to be compiled using the JIT compiler" before any export is visible.
 * The names behind those two doors are the angular tier's to check; skipping them here is stated in
 * an assertion below so that a *new* unloadable specifier fails instead of joining them.
 */
const NOT_LOADABLE_IN_NODE = new Set(["@modyra/angular/adapter", "@modyra/angular/ui"]);

const tracked = (pattern) =>
  execFileSync("git", ["ls-files", pattern], { cwd: REPO, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);

/**
 * Where a package's runtime entry point is, read from its own manifest.
 *
 * A bare specifier is tried first, because that is what a consumer writes. Not every package in the
 * workspace is linked into the repository root, and one that is not would otherwise be silently
 * skipped — which would make this battle pass by checking less.
 */
function manifests() {
  const found = new Map();
  for (const manifest of tracked("*/*/package.json")) {
    const json = JSON.parse(readFileSync(join(REPO, manifest), "utf8"));
    if (json.name) found.set(json.name, { dir: dirname(join(REPO, manifest)), json });
  }
  return found;
}

function entryOf(specifier, known) {
  const slash = specifier.indexOf("/", specifier.indexOf("/") + 1);
  const pkg = slash === -1 ? specifier : specifier.slice(0, slash);
  const subpath = slash === -1 ? "." : `.${specifier.slice(slash)}`;
  const found = known.get(pkg);
  if (!found) return null;
  const { dir, json } = found;
  const entry = subpath === "." ? (json.exports?.["."] ?? json.exports) : json.exports?.[subpath];
  const candidate =
    (typeof entry === "string" ? entry : entry?.import?.default ?? entry?.import ?? entry?.default)
    ?? json.module
    ?? json.main;
  if (typeof candidate !== "string") return null;
  const file = resolve(dir, candidate);
  return existsSync(file) ? file : null;
}

battle(
  {
    claims: ["DOC-001"],
    title: "every name a guide imports is one the package exports",
    environments: ["node"],
  },
  async (ctx) => {
    const known = manifests();
    const exportsOf = new Map();

    const runtimeExports = async (pkg) => {
      if (NOT_LOADABLE_IN_NODE.has(pkg)) return new Set();
      if (exportsOf.has(pkg)) return exportsOf.get(pkg);
      let names = null;
      try {
        names = new Set(Object.keys(await import(pkg)));
      } catch {
        const entry = entryOf(pkg, known);
        if (entry) {
          try {
            names = new Set(Object.keys(await import(pathToFileURL(entry).href)));
          } catch { /* recorded below as unreadable rather than as a pass */ }
        }
      }
      exportsOf.set(pkg, names);
      return names;
    };

    const pages = tracked("*.md").filter(
      (file) => !file.includes("CHANGELOG") && !file.startsWith(".changeset/"),
    );

    const wrong = [];
    const unreadable = new Set();
    const skipped = new Set();
    let checked = 0;

    for (const page of pages) {
      const text = readFileSync(join(REPO, page), "utf8");
      let onThisPage = 0;
      for (const match of text.matchAll(IMPORT_CLAUSE)) {
        const [, typeOnly, clause, pkg] = match;
        if (typeOnly) continue;
        if (NOT_LOADABLE_IN_NODE.has(pkg)) { skipped.add(pkg); continue; }
        const names = await runtimeExports(pkg);
        if (!names) { unreadable.add(pkg); continue; }
        const line = text.slice(0, match.index).split("\n").length;
        for (const piece of clause.split(",")) {
          const written = piece.trim();
          if (!written || written.startsWith("type ")) continue;
          const name = written.split(/\s+as\s+/)[0].trim();
          if (!name) continue;
          checked += 1;
          onThisPage += 1;
          if (!names.has(name)) wrong.push(`${page}:${line} ${name} from ${pkg}`);
        }
      }
      if (onThisPage > 0) ctx.log.note("imports read from a page", { page, names: onThisPage });
    }

    // Two controls, because a sweep that read nothing is the failure mode a sweep has. The pages
    // have to have yielded imports, and every package they name has to have been loadable — a
    // package that would not load is a name never checked, which is not the same as a name that
    // was checked and found.
    expectClaim(checked > 100, {
      claimIds: ["DOC-001"],
      what: "the guides yielded value imports to check",
      detail: `${checked} name(s) across ${pages.length} page(s)`,
    });
    expectEqual([...unreadable].sort(), [], {
      claimIds: ["DOC-001"],
      what: "every package a guide imports from could be loaded and asked what it exports",
    });
    // The exclusion is stated rather than silent: what is skipped is fixed, and a new specifier
    // that cannot load lands in `unreadable` above instead of quietly joining it.
    expectEqual([...skipped].sort(), [...NOT_LOADABLE_IN_NODE].sort(), {
      claimIds: ["DOC-001"],
      what: "the entry points this tier cannot load are the declared two and no others",
    });

    expectEqual(wrong, [], {
      claimIds: ["DOC-001"],
      what: "every value-imported name in the guides is a runtime export of the package named",
    });
  },
);
