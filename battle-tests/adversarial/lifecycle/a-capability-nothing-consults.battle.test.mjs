/**
 * A dimension a renderer is invited to report, and the question a battle can ask without guessing.
 *
 * `MdyWidgetRuntimeCapabilities.hydrated` is declared, set to `false` by `ssrRuntimeCapabilities`,
 * computed by `browserRuntimeCapabilities({ hydrated })`, and documented at length: *"the one
 * dimension no global can answer — a browser that has parsed server markup but not yet attached to it
 * is indistinguishable from one that has … a renderer that knows it is still hydrating says so."*
 *
 * Finding 37 recorded that saying so changes nothing, and deliberately did not battle it: what the
 * capability *should* change is the decision, and a battle asserting a particular effect would encode
 * that decision rather than test it.
 *
 * There is a smaller question that guesses nothing. A capability a renderer is invited to report has
 * to be **read by something**, somewhere, or the invitation is to fill in a field nobody opens. That
 * is a fact about the sources rather than an opinion about behaviour, and it is what this holds: every
 * mention of `hydrated` in the packages' own sources is inside the file that declares it.
 *
 * It goes green the moment any consumer consults it, whatever it then does — so it closes itself when
 * the decision is taken, in either direction, without this battle having taken a side.
 *
 * @source-inspection — whether any module *reads* a declared capability is a fact about the sources
 * and about nothing else: a capability nobody consults behaves identically to one everybody does,
 * so no public door can tell them apart. The walk asserts what is written, never what it means.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const PACKAGES = resolve(HERE, "..", "..", "..", "packages");

/** The file that declares the capability; everything else is a reader. */
const DECLARING = "runtime.ts";

function sourcesNaming(word) {
  const hits = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "dist") continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts") && readFileSync(path, "utf8").includes(word)) {
        hits.push(path.slice(PACKAGES.length + 1));
      }
    }
  };
  for (const pkg of readdirSync(PACKAGES)) {
    const src = join(PACKAGES, pkg, "src");
    try {
      if (statSync(src).isDirectory()) walk(src);
    } catch {
      // a package without sources is not this battle's subject
    }
  }
  return hits;
}

battle(
  {
    claims: ["REA-002"],
    title: "a capability a renderer is invited to report is read by something",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the search finds a word that is certainly there, in more than one package. Without
    // it, a walk that reached no files would report every capability as unread.
    const widelyUsed = sourcesNaming("createForm");
    expectClaim(widelyUsed.length > 2, {
      claimIds: ["REA-002"],
      what: "the source walk found almost nothing, so an empty result below is the walk rather than the capability",
      detail: () => JSON.stringify(widelyUsed.slice(0, 5)),
    });

    const naming = sourcesNaming("hydrated");
    const readers = naming.filter((path) => !path.endsWith(DECLARING));
    ctx.log.note("where the capability is named", { naming, readers });

    // The premise: it is declared at all. A capability that had been removed would make the assertion
    // below pass by having nothing to read.
    expectClaim(naming.some((path) => path.endsWith(DECLARING)), {
      claimIds: ["REA-002"],
      what: "no source declares the capability any more, so there is nothing for a consumer to read",
      detail: () => JSON.stringify(naming),
    });

    expectClaim(readers.length > 0, {
      claimIds: ["REA-002"],
      what: "the capability is named only by the file that declares it — a renderer is invited to report something nothing consults",
      detail: () => JSON.stringify({ naming, readers }),
    });
  },
);
