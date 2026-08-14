/**
 * Typing the first letter of a label that is on screen, and finding nothing.
 *
 * Two public surfaces answer "does what the user typed match this option": `typeaheadMatch`, which
 * jumps to an option in a closed list, and `filterOptionsByQuery`, which narrows an open one. Both
 * compare with `toLowerCase()` and `startsWith`.
 *
 * That is correct for case and it is not enough for text. `É` has two encodings — one code point, or
 * `E` followed by a combining acute — and they render identically. A label carrying the second and a
 * query carrying the first are the same word on screen and different strings in memory, so the match
 * fails and the list empties while the label the user is reading sits right there.
 *
 * The two sides come from different places, which is why they disagree. Labels arrive from a CMS, an
 * API or a file listing, and macOS in particular hands back decomposed text; a browser's keyboard
 * input is composed. So this is not a contrived pairing, it is the ordinary one for any application
 * whose option labels were not typed into the same field the user is typing into now.
 *
 * `String.prototype.normalize` is the whole of the fix and it applies to both sides of both
 * comparisons.
 *
 * What is deliberately *not* claimed here: that `e` should reach `École`. Folding accents away is a
 * different decision with real costs — it makes `resume` and `résumé` the same option — and the
 * current behaviour of keeping them apart is defensible. The claim is only that two spellings of the
 * *same* character are the same character.
 */

import { filterOptionsByQuery, typeaheadMatch } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** The same word, encoded the two ways a browser and a file system produce it. */
const COMPOSED = "École".normalize("NFC");
const DECOMPOSED = "École".normalize("NFD");

battle(
  {
    claims: ["LOC-002"],
    title: "a label and a query that read the same match each other",
    environments: ["node"],
  },
  async (ctx) => {
    // The control, and the premise: these are different strings that a reader cannot tell apart.
    ctx.log.note("one word, two encodings", {
      composedLength: COMPOSED.length,
      decomposedLength: DECOMPOSED.length,
      equal: COMPOSED === DECOMPOSED,
    });

    expectClaim(COMPOSED !== DECOMPOSED && COMPOSED.normalize("NFD") === DECOMPOSED, {
      claimIds: ["LOC-002"],
      what: "the two encodings this battle compares are not two encodings of one word",
    });

    // A jump-to-option, with the label decomposed and the query composed.
    const options = [{ label: DECOMPOSED }, { label: "Espagne" }];
    for (const query of [COMPOSED.slice(0, 1), COMPOSED.slice(0, 3)]) {
      const found = typeaheadMatch(options, query);
      ctx.log.note("typing into a closed list", { query, found: found?.label ?? null });

      expectEqual(found?.label ?? null, DECOMPOSED, {
        claimIds: ["LOC-002"],
        what: `typing ${JSON.stringify(query)} did not reach the label the user can see`,
        detail: JSON.stringify({ query, labels: options.map((option) => option.label) }),
      });
    }

    // And the same both ways round, because either side can be the decomposed one.
    const swapped = [{ label: COMPOSED }, { label: "Espagne" }];
    expectEqual(typeaheadMatch(swapped, DECOMPOSED.slice(0, 2))?.label ?? null, COMPOSED, {
      claimIds: ["LOC-002"],
      what: "a decomposed query did not reach a composed label",
    });
  },
);

battle(
  {
    claims: ["LOC-002"],
    title: "a search narrows to the options a reader would expect it to",
    environments: ["node"],
  },
  async (ctx) => {
    const options = [
      { value: "fr", label: DECOMPOSED },
      { value: "es", label: "Espagne" },
    ];

    const narrowed = filterOptionsByQuery(options, COMPOSED.slice(0, 2));
    ctx.log.note("narrowing an open list with a composed query", {
      kept: narrowed.map((option) => option.label),
    });

    expectEqual(narrowed.map((option) => option.value), ["fr"], {
      claimIds: ["LOC-002"],
      what: "a search hid the one option whose label starts with what was typed",
      detail: JSON.stringify({ kept: narrowed.map((option) => option.label) }),
    });
  },
);

battle(
  {
    claims: ["LOC-002"],
    title: "the matching that already works keeps working",
    environments: ["node"],
  },
  async (ctx) => {
    // The boundary of any fix. Normalising must not fold anything else together, and these are the
    // behaviours a careless `normalize("NFKD")` or an accent-stripping pass would change.
    const options = [{ label: "Andorra" }, { label: "Canada" }, { label: "Espagne" }, { label: COMPOSED }];
    ctx.log.note("matching that is correct today", { labels: options.map((option) => option.label) });

    // Prefix, not substring — `an` reaches Andorra rather than Canada — and case-insensitive.
    for (const [query, expected] of [["an", "Andorra"], ["AN", "Andorra"], ["can", "Canada"]]) {
      expectEqual(typeaheadMatch(options, query)?.label ?? null, expected, {
        claimIds: ["LOC-002"],
        what: `${JSON.stringify(query)} no longer reaches ${expected}`,
      });
    }

    // An accent is still a different letter from the one underneath it. Folding them would make
    // `resume` and `résumé` the same option, which is a separate decision and not this one.
    expectEqual(typeaheadMatch(options, "e")?.label ?? null, "Espagne", {
      claimIds: ["LOC-002"],
      what: "an unaccented query folded onto an accented label, which changes which options are distinct",
    });

    // An empty query selects nothing rather than the first option.
    expectEqual(typeaheadMatch(options, ""), null, {
      claimIds: ["LOC-002"],
      what: "an empty query matched an option",
    });

    // And a query nothing starts with finds nothing.
    expectEqual(typeaheadMatch(options, "zz"), null, {
      claimIds: ["LOC-002"],
      what: "a query no label starts with matched an option anyway",
    });
  },
);
