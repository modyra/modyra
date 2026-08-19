/**
 * A name a package exports twice, and the one a consumer gets.
 *
 * `export *` yields to a local declaration, silently and by specification. So a package whose entry
 * re-exports a subdirectory *and* declares a name that subdirectory also exports ships two different
 * functions under one identifier, and a consumer can reach exactly one of them — with nothing in a
 * build objecting, because nothing is wrong.
 *
 * Finding 92 recorded it for `useMdyField`: `react/src/widgets/index.ts` exports the text-field
 * controller hook, `react/src/index.ts` declares the field-state hook, the package has one entry
 * point, and what arrives is the local one. `preact` is the same file twice over.
 *
 * What is asserted takes no side on which hook should win — renaming either, or exporting the
 * subdirectory under its own subpath, or dropping one, all satisfy it. The property is that **a name
 * is not declared in one module and star-exported from another**, because that is the shape in which
 * one of them disappears without anybody choosing.
 *
 * Read from the sources rather than from the built package: at runtime only the survivor exists, so
 * the shadowing is invisible from the outside — which is the whole reason it goes unnoticed.
 *
 * @source-inspection — a name declared in one module and star-exported from another is a property of
 * the source graph. From outside, the shadowed export is simply absent, which is indistinguishable
 * from never having existed. The walk asserts what the files declare, not what they do.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const PACKAGES = resolve(HERE, "..", "..", "..", "packages");

/** Adapters whose package.json offers a single entry, where a shadowed name has nowhere else to live. */
const ADAPTERS = Object.freeze(["react", "preact", "vue", "svelte", "solid", "lit"]);

const sourceFiles = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) out.push(path);
  }
  return out;
};

/** Names a module declares and exports itself, rather than passing along. */
const declaredExports = (text) => [
  ...text.matchAll(/^export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/gm),
].map((match) => match[1]);

/** Names a module re-exports by name from elsewhere. */
const namedReExports = (text) => [
  ...text.matchAll(/^export\s*\{([^}]+)\}\s*from/gm),
].flatMap((match) => match[1].split(",").map((part) => part.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop().trim()));

battle(
  {
    claims: ["API-001"],
    title: "a name a package exports is not shadowed by one it declares",
    environments: ["node"],
  },
  async (ctx) => {
    const shadowed = [];
    let scanned = 0;

    for (const adapter of ADAPTERS) {
      const src = join(PACKAGES, adapter, "src");
      let files;
      try {
        files = sourceFiles(src);
      } catch {
        continue;
      }
      scanned += files.length;

      const entry = join(src, "index.ts");
      let entryText;
      try {
        entryText = readFileSync(entry, "utf8");
      } catch {
        continue;
      }
      const local = new Set(declaredExports(entryText));
      if (local.size === 0) continue;

      for (const file of files) {
        if (file === entry) continue;
        const text = readFileSync(file, "utf8");
        for (const name of [...declaredExports(text), ...namedReExports(text)]) {
          if (local.has(name)) shadowed.push(`${adapter}: ${name} (${file.slice(PACKAGES.length + 1)})`);
        }
      }
    }

    ctx.log.note("names an entry declares that another module also exports", { scanned, shadowed });

    // The control: the scan read sources at all. A walk that found nothing would report no shadowing
    // for the same reason it would report no exports.
    expectClaim(scanned > 20, {
      claimIds: ["API-001"],
      what: "the source walk read almost nothing, so an empty result below is the walk rather than the packages",
      detail: () => String(scanned),
    });

    expectEqual([...new Set(shadowed)].sort(), [], {
      claimIds: ["API-001"],
      what: "a package declares a name another of its modules also exports, so one of the two is unreachable",
    });
  },
);
