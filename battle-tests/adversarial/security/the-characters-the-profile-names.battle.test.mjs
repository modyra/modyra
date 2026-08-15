/**
 * The invisible characters the `text` profile names, and the ones it does not.
 *
 * The security guide is precise about it, in a table: `"text"` strips control characters (except tab
 * and newline), DEL/C1, **zero-width characters (`U+200B–200D`, `U+FEFF`)**, **bidi
 * overrides/isolates (`U+202A–202E`, `U+2066–2069`)** and line/paragraph separators — *all legitimate
 * text, accents, emoji, CJK, newlines, is preserved*.
 *
 * Those ranges are what makes the profile worth having: `"admin‮"` looks like `admin` and is
 * not, and that is the attack the guide names. They are exactly the ranges it removes.
 *
 * What it does not remove is what the ranges do not name: `U+200E` and `U+200F`, the bidi *marks*,
 * and `U+00AD` and `U+2060`, invisible but not bidi. That is the contract, and this battle holds it
 * as it is — both halves, so a widening is a decision somebody takes rather than a drift, and a
 * narrowing shows up as the attack coming back.
 *
 * One guide says it less precisely, and that is recorded in the register rather than asserted here:
 * a battle that demanded more than the contract states would be inventing a requirement.
 */

import { createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 50));

/** What one character does when it is pasted into a field under `profile`. */
async function survives(profile, character) {
  const form = createForm({ a: field("") }, { security: { sanitize: profile }, devWarnings: false });
  form.f.a.set(`a${character}b`);
  await settled();
  const held = form.getValue().a;
  form.destroy();
  return held.includes(character);
}

const codePoint = (hex) => String.fromCodePoint(Number.parseInt(hex, 16));

battle(
  {
    claims: ["SEC-003"],
    title: "the text profile removes the characters its contract names, and keeps legitimate text",
    environments: ["node"],
  },
  async (ctx) => {
    // The ranges the contract names, one representative from each, plus the character the guide uses
    // to explain why the profile exists.
    const named = [
      ["U+200B zero width space", "200B"],
      ["U+200C zero width non-joiner", "200C"],
      ["U+200D zero width joiner", "200D"],
      ["U+FEFF byte order mark", "FEFF"],
      ["U+202A left-to-right embedding", "202A"],
      ["U+202B right-to-left embedding", "202B"],
      ["U+202C pop directional formatting", "202C"],
      ["U+202D left-to-right override", "202D"],
      ["U+202E right-to-left override", "202E"],
      ["U+2066 left-to-right isolate", "2066"],
      ["U+2067 right-to-left isolate", "2067"],
      ["U+2068 first strong isolate", "2068"],
      ["U+2069 pop directional isolate", "2069"],
    ];

    for (const profile of ["text", "strict"]) {
      const left = [];
      for (const [what, hex] of named) {
        if (await survives(profile, codePoint(hex))) left.push(what);
      }
      ctx.log.note("what the profile left behind", { profile, left });

      expectEqual(left, [], {
        claimIds: ["SEC-003"],
        what: `the ${profile} profile kept a character its contract names as removed`,
        detail: JSON.stringify(left),
      });
    }

    // The control, and half the reason the profile is usable: legitimate text survives it whole.
    const keeps = createForm({ a: field("") }, { security: { sanitize: "text" }, devWarnings: false });
    keeps.f.a.set("Café — 日本語 — 🎉\nsecond line\tand a tab");
    await settled();
    const held = keeps.getValue().a;
    keeps.destroy();
    ctx.log.note("what legitimate text becomes", { held });

    expectEqual(held, "Café — 日本語 — 🎉\nsecond line\tand a tab", {
      claimIds: ["SEC-003"],
      what: "the text profile changed legitimate text — accents, CJK, emoji, a newline or a tab",
    });

    // And the other half, held as it is rather than as a wider sentence elsewhere reads: the bidi
    // *marks* and two other invisibles are outside the ranges the contract names, and survive.
    // Asserting this is what makes a future widening a decision rather than a drift.
    const outside = [
      ["U+200E left-to-right mark", "200E"],
      ["U+200F right-to-left mark", "200F"],
      ["U+00AD soft hyphen", "00AD"],
      ["U+2060 word joiner", "2060"],
    ];
    const stillThere = [];
    for (const [what, hex] of outside) {
      if (await survives("text", codePoint(hex))) stillThere.push(what);
    }
    ctx.log.note("what the contract does not name", { stillThere });

    expectEqual(stillThere.length, outside.length, {
      claimIds: ["SEC-003"],
      what: "the profile now removes a character its contract does not name — a widening worth recording deliberately",
      detail: JSON.stringify(stillThere),
    });
  },
);
