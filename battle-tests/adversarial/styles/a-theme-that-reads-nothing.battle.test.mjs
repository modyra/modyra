/**
 * Eight published stylesheets, and the properties they read.
 *
 * A theme is CSS a consumer links, and everything it draws with comes from a custom property. Two
 * ways of reading one are not the same:
 *
 *   var(--mdy-input-bg)              nothing defines it → the declaration is dropped
 *   var(--mdy-input-bg, #fff)        nothing defines it → the fallback is used
 *
 * The first is the one that costs. A control whose background declaration is dropped is not obviously
 * broken in a screenshot — it inherits, or it is white on white, or it is fine on the page that was
 * looked at and wrong on the one that was not.
 *
 * So this asks the only question that has one answer: **every property a stylesheet reads without a
 * fallback is defined by that sheet, by the base sheet, or by the core one it ships beside.** Reads
 * that carry a fallback are not asked about — a fallback is the author saying they know it may be
 * absent.
 *
 * The published files are read rather than the sources, because `files: ["dist"]` is what a consumer
 * installs, and a property that exists only before a build is a property they do not have.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const STYLES = resolve(HERE, "..", "..", "..", "packages", "styles", "dist");

/** `--mdy-name:` — a definition, wherever it appears. */
const DEFINED = /(--mdy-[a-z0-9-]+)\s*:/g;
/** `var(--mdy-name)` closed with no comma — a read with nothing to fall back on. */
const READ_BARE = /var\((--mdy-[a-z0-9-]+)\s*\)/g;

const namesIn = (text, pattern) => new Set([...text.matchAll(pattern)].map((match) => match[1]));

battle(
  {
    claims: ["STY-001", "UI-001"],
    title: "every property a stylesheet reads without a fallback is one something defines",
    environments: ["node"],
  },
  async (ctx) => {
    const sheets = readdirSync(STYLES).filter((name) => name.endsWith(".css")).sort();

    // The control: the published directory is there and holds the sheets the package advertises.
    expectClaim(sheets.length >= 6, {
      claimIds: ["STY-001"],
      what: "the published stylesheets were not found, so this battle read nothing",
      detail: `${STYLES}: ${sheets.join(", ")}`,
    });

    /**
     * What a sheet has alongside it, followed from its own `@import`s rather than named here.
     *
     * A hardcoded pair was true until a third sheet joined the system: the scale went into its own
     * file, `modyra.css` imported it, and this battle reported every step as undefined — a stale
     * fixture in the suite that exists to catch stale fixtures. Reading the imports means the next
     * file to arrive is followed too, and a sheet that stops importing one is caught rather than
     * quietly forgiven.
     */
    const definitionsReachableFrom = (entry, seen = new Set()) => {
      if (seen.has(entry)) return new Set();
      seen.add(entry);
      let text;
      try { text = readFileSync(join(STYLES, entry), "utf8"); } catch { return new Set(); }
      const names = new Set(namesIn(text, DEFINED));
      for (const found of text.matchAll(/@import\s+['"]\.\/([^'"]+)['"]/g)) {
        for (const name of definitionsReachableFrom(found[1], seen)) names.add(name);
      }
      return names;
    };

    // Two sheets a consumer always has alongside a theme, plus everything they pull in.
    const shared = new Set([
      ...definitionsReachableFrom("modyra-base.css"),
      ...definitionsReachableFrom("modyra.css"),
    ]);
    ctx.log.note("what the shared sheets define", { count: shared.size });

    expectClaim(shared.size > 100, {
      claimIds: ["STY-001"],
      what: "the base and core sheets define almost nothing, so the comparison below is against an empty set",
    });

    const dangling = [];
    for (const sheet of sheets) {
      const text = readFileSync(join(STYLES, sheet), "utf8");
      const bare = namesIn(text, READ_BARE);
      const known = new Set([...namesIn(text, DEFINED), ...shared]);
      const missing = [...bare].filter((name) => !known.has(name)).sort();
      ctx.log.note("a published stylesheet", { sheet, bareReads: bare.size, missing: missing.length });
      if (missing.length > 0) dangling.push({ sheet, missing: missing.slice(0, 8) });
    }

    expectEqual(dangling, [], {
      claimIds: ["STY-001", "UI-001"],
      what: "a stylesheet reads a custom property with no fallback that nothing defines, so the declaration is dropped wherever it is used",
    });
  },
);

battle(
  {
    claims: ["STY-001"],
    title: "the check can tell a bare read from one with a fallback",
    environments: ["node"],
  },
  async (ctx) => {
    // The battle above passes, so the patterns it rests on are shown separating the two forms — a
    // check that matched both would report nothing whatever the sheets said.
    const sample = ":root{--mdy-a:1}.x{color:var(--mdy-a);background:var(--mdy-nowhere, #fff);border:var(--mdy-missing)}";
    ctx.log.note("what each pattern finds in a sample", {
      defined: [...namesIn(sample, DEFINED)],
      bare: [...namesIn(sample, READ_BARE)],
    });

    expectEqual([...namesIn(sample, DEFINED)].sort(), ["--mdy-a"], {
      claimIds: ["STY-001"],
      what: "the definition pattern does not find a definition, or finds a read as one",
    });

    // `--mdy-nowhere` has a fallback and must not be reported; `--mdy-missing` has none and must be.
    expectEqual([...namesIn(sample, READ_BARE)].sort(), ["--mdy-a", "--mdy-missing"], {
      claimIds: ["STY-001"],
      what: "the bare-read pattern counts a read that has a fallback, or misses one that does not",
    });
  },
);
