/**
 * Two option values, one generated id.
 *
 * An option's id is built from its **value**, and a value is data — a city, a plan name, something a
 * CMS or a CSV import produced. `idSafeKey` spells the characters an id may not carry, and says why
 * it spells them rather than replacing them:
 *
 *   Percent-encoded rather than replaced: `%` goes first so the encoding stays reversible, and the
 *   delimiter is encoded because an id carrying it a second time cannot be taken apart again.
 *
 * **Reversible is the word that does not hold.** Every whitespace character is written as the same
 * escape:
 *
 *     .replace(/[\t\n\f\r ]/g, "%20")
 *
 * So a space, a tab and a newline are one character once encoded, and three distinct values become
 * one id:
 *
 *     "a b"    ->  w__option__a%20b
 *     "a\tb"   ->  w__option__a%20b
 *     "a\nb"   ->  w__option__a%20b
 *
 * This is the defect `an-option-that-never-appears` describes, reached from the other side. There it
 * was two options declared with the *same* value; here it is two options with **different** values
 * that the id factory makes the same. The browser is happy to hold two elements with one id, so
 * `getElementById`, `label[for]` and every ARIA IDREF stop being deterministic, and
 * `aria-activedescendant` points at whichever the document happens to reach first.
 *
 * A tab or a newline inside an option's value is what a paste from a spreadsheet produces. Nothing
 * refuses it — an option's value is data, and refusing it would refuse the document that declared it,
 * which is the reasoning that made this function spell rather than reject.
 *
 * The repair is inside the same sentence the function already wrote: spell each character as its own
 * code — `%09`, `%0A`, `%0C`, `%0D`, `%20` — and the encoding is reversible, as claimed.
 *
 * Green when two distinct values never produce one id, and every id still splits back into exactly
 * its three parts.
 */

import { defaultWidgetIdFactory, MDY_ID_DELIMITER } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Values a document can legitimately carry, chosen where the encoding has to work hardest. */
const VALUES = Object.freeze([
  "a b", "a\tb", "a\nb", "a\rb", "a\fb", "a  b", "a b ", " a b",
  "a%20b", "a%2520b", "a__b", "a%5F%5Fb", "%", "%25", "a%",
  "New York", "New%20York", "", "0", "00", "é", "ß",
]);

battle(
  {
    claims: ["UI-003", "A11Y-001"],
    title: "two option values never make one id",
    environments: ["node"],
  },
  async (ctx) => {
    const byId = new Map();
    const collisions = [];

    for (const value of VALUES) {
      const id = defaultWidgetIdFactory.item("w", "option", value);
      const already = byId.get(id);
      if (already !== undefined && already !== value) {
        collisions.push(`${JSON.stringify(already)} and ${JSON.stringify(value)} both make ${JSON.stringify(id)}`);
      } else {
        byId.set(id, value);
      }
    }
    ctx.log.note("values encoded into ids", { values: VALUES.length, distinctIds: byId.size });

    // The control: the factory is producing ids at all, and the values really are distinct — a list
    // with a repeat in it would collide honestly and prove nothing.
    expectClaim(new Set(VALUES).size === VALUES.length && byId.size > 1, {
      claimIds: ["UI-003"],
      what: "the probe values are not distinct, or the factory made no ids, so a collision would mean nothing",
      detail: `${new Set(VALUES).size} distinct values, ${byId.size} distinct ids`,
    });

    expectEqual(collisions, [], {
      claimIds: ["UI-003", "A11Y-001"],
      what: "two options a document can declare are given one id, so one of them cannot be pointed at",
    });

    // And the half the encoding exists for: an id still comes apart into its three pieces.
    const unsplittable = VALUES
      .map((value) => [value, defaultWidgetIdFactory.item("w", "option", value)])
      .filter(([, id]) => id.split(MDY_ID_DELIMITER).length !== 3)
      .map(([value, id]) => `${JSON.stringify(value)} -> ${JSON.stringify(id)}`);

    expectEqual(unsplittable, [], {
      claimIds: ["A11Y-001"],
      what: "an id no longer comes apart into the widget, the part and the key",
    });
  },
);
