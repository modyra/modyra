/**
 * A rule that reasons about a class and asks a question about tags.
 *
 * `:first-of-type`, `:last-of-type` and `:nth-of-type` count **elements of the same tag among their
 * siblings**. They know nothing about classes. So `.thing:last-of-type` does not mean *the last thing*
 * — it means *an element carrying the class `thing`, which also happens to be the last element of its
 * tag among its siblings*, and those two are the same only while nothing else shares the tag and
 * nothing wraps anything.
 *
 * Both conditions are outside the rule's control and both change for reasons that have nothing to do
 * with it. Three instances in one day:
 *
 *   - a chip's later move control took `:last-of-type`, and the last button in a chip is the one that
 *     **removes** it — so the rule never matched, and both arrows drew the same chevron;
 *   - a stepper nearly took `:first-of-type` for the same reason and was caught before it shipped;
 *   - a date range's two inputs take `:first-of-type` and `:nth-of-type`, and each input sits inside
 *     its own sizing wrapper — so **each is the first of its type**, both match the first rule, and
 *     the pair's outer corners are flat where one should be rounded. Measured on the page: both
 *     inputs report a radius of zero.
 *
 * None of the three is a typo. Each is a rule asking a question whose answer depends on markup the
 * rule does not own, and each broke when somebody added a sibling or a wrapper for an unrelated
 * reason — which is the definition of a coupling nobody declared.
 *
 * **The sibling combinators say what these rules mean.** `.thing ~ .thing` is *a thing with a thing
 * before it*, and it is indifferent to tags, wrappers and anything else in between. Where the
 * question really is about tags — a bare element selector with no class — this battle says nothing,
 * because there the counter and the subject are the same set.
 *
 * @source-inspection — the selector is the thing under test, and a browser has resolved it into a
 * matched set by the time anything is rendered. Whether a rule matched what it meant to cannot be
 * asked of a page: a rule that matches nothing and a rule that was never written look identical
 * there.
 *
 * Claims under attack: UI-005.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const SHEET = join(resolve(HERE, "..", "..", ".."), "packages", "styles", "src", "modyra.css");

/** A positional counter attached to a compound that carries a class or an id. */
const COUNTS_TAGS_ABOUT_A_CLASS = /([.#][A-Za-z0-9_-]+(?:[.#:][A-Za-z0-9_()-]+)*?):(?:first|last|only|nth)-(?:of-type)\b/;

battle(
  {
    claims: ["UI-005"],
    title: "a positional rule counts the set it is about",
    environments: ["node"],
  },
  async (ctx) => {
    // Comments first: a selector is whatever precedes a brace, and a comment sitting above a rule
    // arrives glued to it — which is how the first run of this battle reported `flat right */` as
    // part of a selector.
    const css = readFileSync(SHEET, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
    const wrong = new Set();
    let selectors = 0;

    for (const rule of css.matchAll(/([^{}]+)\{/g)) {
      for (const part of rule[1].split(",")) {
        const selector = part.trim();
        // Comments and at-rules come through this split; neither is a selector.
        if (selector === "" || selector.startsWith("@")) continue;
        selectors += 1;
        const found = COUNTS_TAGS_ABOUT_A_CLASS.exec(selector);
        if (found === null) continue;
        wrong.add(selector.replace(/\s+/g, " ").slice(0, 100));
      }
    }

    // The action is the sweep across every selector the sheet declares, which is what happened
    // whether or not one of them counts the wrong set. Recorded here so a sheet with no positional
    // misuse left reports a scan rather than an empty battle.
    ctx.log.note("selectors swept for a positional rule", { selectors });

    // A sheet with no selectors would report no misuse for the wrong reason.
    expectEqual(selectors > 200, true, {
      claimIds: ["UI-005"],
      what: `this sheet has ${selectors} selector(s) — too few to have measured anything`,
    });

    expectEqual([...wrong].sort(), [], {
      claimIds: ["UI-005"],
      what: `${wrong.size} rule(s) count elements of a tag while reasoning about a class: `
        + `${[...wrong].join("; ")}. Each holds only while nothing else shares the tag and nothing `
        + "wraps anything, and both are outside the rule's control",
    });
  },
);
