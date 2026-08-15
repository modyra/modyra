/**
 * An option value that is also the name of something every object already has.
 *
 * An option's value is whatever the option list holds — the value contracts say so, and the select
 * controller's type parameter is unconstrained for the same reason. So the set of strings an option
 * may carry is every string, and `"__proto__"` is a string a document supplies for the ordinary
 * reason that some domain's identifier is that word, or for the other reason, which is that the
 * document came from somewhere that is not the application.
 *
 * The parser is strict about option lists and this battle establishes where that strictness stops:
 * a malformed list drops the whole field with a named diagnostic, and a well-formed list whose
 * values happen to be dangerous words is kept, because there is nothing malformed about it. That is
 * the right division — the value is data, not a path — and it makes such a field one a renderer will
 * be asked to draw.
 *
 * What a renderer then does with it is measured in
 * `browser/a-list-emptied-by-one-of-its-own-choices.spec.ts`. This battle is the premise: the form
 * can be built.
 */

import { defaultOptionKey } from "@modyra/widgets";
import { parseDynamicFields } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Words every plain object answers to, whether or not anybody put them there. */
const INHERITED = Object.freeze(["__proto__", "constructor", "prototype", "toString", "valueOf"]);

battle(
  {
    claims: ["SEC-001", "UI-003"],
    title: "an option list is kept when its values are dangerous words and dropped when it is malformed",
    environments: ["node"],
  },
  async (ctx) => {
    for (const word of INHERITED) {
      const parsed = parseDynamicFields([{
        name: "x",
        kind: "select",
        label: "X",
        options: [{ value: word, label: "W" }, { value: "a", label: "A" }],
      }]);
      ctx.log.note("a document offering a choice named like a prototype member", {
        word,
        kept: parsed.length === 1 ? parsed[0].options.map((each) => each.value) : null,
      });

      expectClaim(parsed.length === 1 && parsed[0].options.length === 2, {
        claimIds: ["UI-003"],
        what: `a well-formed option list was dropped because one value was ${JSON.stringify(word)}`,
        detail: JSON.stringify(parsed),
      });

      // The key a widget identifies the option by is the word itself, which is what makes it reach
      // anything that stores options by key.
      expectEqual(defaultOptionKey(word), word, {
        claimIds: ["UI-003"],
        what: `the option key for ${JSON.stringify(word)} is not the value`,
      });
    }

    // The control, and the boundary: a list that is actually malformed loses the whole field, with
    // a diagnostic naming it. So the acceptance above is a decision about data rather than an
    // absence of checking.
    for (const malformed of ["not a list", 42, {}, null, [{ label: "no value" }], [{ value: "a" }, "loose"]]) {
      const parsed = parseDynamicFields([{ name: "x", kind: "select", label: "X", options: malformed }]);
      expectEqual(parsed.length, 0, {
        claimIds: ["SEC-001"],
        what: `a select with options ${JSON.stringify(malformed)} survived parsing`,
        detail: JSON.stringify(parsed),
      });
    }
  },
);
