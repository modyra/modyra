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
 * disagree. Pages that quote a *former* or *broken* import on purpose are excluded — a changelog, a
 * changeset, and this suite's own register of findings.
 *
 * Green when every value-imported name in the tracked markdown is a runtime export of the package
 * the line names.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { battle } from "../harness/battle.mjs";
import { expectClaim, expectEqual } from "../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, "..", "..");

/** `import { a, type B, c as d } from "@modyra/x"` — the whole clause, so the `type` prefix is visible. */
const IMPORT_CLAUSE = /import\s*(type\s+)?\{([^}]*)\}\s*from\s*["'](@modyra\/[a-z0-9-]+(?:\/[a-z0-9/-]+)?)["']/g;

/**
 * The names an entry point exports, read without evaluating it.
 *
 * The fallback for a module a plain node process cannot evaluate: Angular's entry points reach
 * `PlatformLocation` and fail with "needs to be compiled using the JIT compiler" before any export
 * is visible, and skipping them would mean the names behind those doors are checked by nothing.
 *
 * `null` when the file carries `export * from "…"`, which names nothing a static read can see: a
 * set that is missing names reports sound imports as wrong, so the honest answer there is that this
 * instrument cannot say, which the caller turns into a failure rather than into a pass. A named
 * `export { a, b } from "…"` is not lossy — every name it forwards is written on the line.
 */
function declaredExports(file) {
  const source = readFileSync(file, "utf8");
  if (/^export\s*\*/m.test(source)) return null;
  const names = new Set();
  for (const match of source.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const piece of match[1].split(",")) {
      const written = piece.trim();
      if (!written) continue;
      const parts = written.split(/\s+as\s+/);
      names.add((parts[1] ?? parts[0]).trim());
    }
  }
  for (const match of source.matchAll(/^export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    names.add(match[1]);
  }
  return names.size > 0 ? names : null;
}

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

/**
 * Whether the package behind a specifier has been built at all.
 *
 * This tier builds core, the adapters, plain and studio; `@modyra/angular` is built by the step that
 * runs the Angular battles, which is after this one. A specifier whose package has no `dist` is one
 * this run cannot answer for — and saying so is different from saying the names are wrong, which is
 * what an unreadable-but-built package means.
 */
function isBuilt(specifier, known) {
  const slash = specifier.indexOf("/", specifier.indexOf("/") + 1);
  const found = known.get(slash === -1 ? specifier : specifier.slice(0, slash));
  return found ? existsSync(join(found.dir, "dist")) : false;
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
    const readHow = new Map();

    /**
     * Three reads, in falling order of fidelity: the bare specifier a consumer writes, the entry
     * point named by the package's own manifest — not every workspace package is linked at the
     * repository root, and one that is not would otherwise be skipped — and finally the export
     * statements of that file, for a module this process cannot evaluate.
     */
    const runtimeExports = async (specifier) => {
      if (exportsOf.has(specifier)) return exportsOf.get(specifier);
      const entry = entryOf(specifier, known);
      let names = null;
      let how = "not read";
      try {
        names = new Set(Object.keys(await import(specifier)));
        how = "imported";
      } catch {
        // The resolver runs without evaluating anything, so a module that throws on import still
        // says where it is — which is the only way to see the names behind a door that cannot open.
        let resolved = null;
        try { resolved = fileURLToPath(import.meta.resolve(specifier)); } catch { /* unlinked */ }
        const file = resolved ?? entry;
        if (file) {
          try {
            names = new Set(Object.keys(await import(pathToFileURL(file).href)));
            how = "imported from its entry point";
          } catch {
            names = declaredExports(file);
            if (names) how = "read from its export statements, unevaluated";
          }
        }
      }
      ctx.log.note("a package was asked what it exports", { specifier, how, names: names?.size ?? 0 });
      readHow.set(specifier, how);
      exportsOf.set(specifier, names);
      return names;
    };

    // A changelog and a changeset record what was true at a version, so a name a release removed
    // belongs in both. This suite's own register quotes the broken line of every finding it holds,
    // which is the same thing one step closer: a page that reports a defect is not a page that has
    // one, and reading it as one would make filing a finding here the way to break this battle.
    const pages = tracked("*.md").filter((file) =>
      !file.includes("CHANGELOG")
      && !file.startsWith(".changeset/")
      && !file.startsWith("battle-tests/reports/"));

    const wrong = [];
    const unreadable = new Set();
    const unbuilt = new Set();
    let checked = 0;

    for (const page of pages) {
      const text = readFileSync(join(REPO, page), "utf8");
      let onThisPage = 0;
      for (const match of text.matchAll(IMPORT_CLAUSE)) {
        const [, typeOnly, clause, pkg] = match;
        if (typeOnly) continue;
        const names = await runtimeExports(pkg);
        if (!names) { (isBuilt(pkg, known) ? unreadable : unbuilt).add(pkg); continue; }
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
    // Built and still unreadable is a finding; never built is this tier's own boundary, reported so
    // that the names behind it are known to be unchecked rather than assumed sound.
    expectEqual([...unreadable].sort(), [], {
      claimIds: ["DOC-001"],
      what: "every package a guide imports from could be loaded and asked what it exports",
    });
    if (unbuilt.size > 0) ctx.log.note("not built in this tier, so not checked here", [...unbuilt].sort());

    // Reading a module's export statements is the weakest of the three reads and the one that
    // cannot notice a name the module fails to actually define. It is a fallback, so most doors must
    // still open: an environment where every import throws would otherwise go green on static text.
    const evaluated = [...readHow.values()].filter((how) => how.startsWith("imported")).length;
    expectClaim(evaluated >= readHow.size - 2 && evaluated >= 5, {
      claimIds: ["DOC-001"],
      what: "the packages were read by importing them, bar the few that cannot be evaluated here",
      detail: [...readHow].map(([specifier, how]) => `${specifier}: ${how}`).sort().join("; "),
    });

    expectEqual(wrong, [], {
      claimIds: ["DOC-001"],
      what: "every value-imported name in the guides is a runtime export of the package named",
    });
  },
);
