/**
 * A consumer reading one part across two kinds finds it under one name.
 *
 * The part catalogue is what a consumer reads instead of the DOM. Its whole value is that a question
 * asked of one kind can be asked of another — *where is this control's option list* — and answered the
 * same way. When two kinds spell that part differently, the question has to be asked twice and the
 * wrong spelling answers `undefined`.
 *
 * **`undefined` is indistinguishable from "this kind has no such part."** That is ADR 0121's shape, and
 * it is not hypothetical here: a battle asked a multiselect for a part called `listbox`, got nothing,
 * read it as *declares no semantics*, and reported an S1 defect against code that was correct. The
 * part had been renamed to `options` in a redesign.
 *
 * What this asserts is **the name**, not the element. A select's option list is a `listbox` and a
 * multiselect's chips are a group of toggles, and that difference is deliberate and recorded. Two
 * kinds may declare different semantics for the same anatomical part; they must not give the part two
 * different names.
 *
 * The pairs are derived from the catalogue rather than listed here: any two kinds that declare an
 * `option` are asked to agree on what they call the thing their options sit in. A kind added tomorrow
 * is compared without this file being touched.
 *
 * **A calendar is not in the comparison, and that is a decision rather than an oversight.** A
 * datepicker and a daterange both call their popup's contents `grid`, and a grid of days is not a list
 * of options — it has no `option` part, its cells are addressed by two axes, and calling it by the
 * same name as a select's list would be the mistake this battle exists to catch, in reverse. The first
 * version of this file compared every popup's container and reported three spellings where there are
 * two.
 */
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectEqual } from "../../harness/assertions.mjs";

/** The part each kind uses for the list of options inside its popup, by any of the names in use. */
const LIST_NAMES = ["options", "listbox", "grid", "menu"];

battle(
  {
    claims: ["API-001"],
    title: "a part two kinds spell differently is a part one of them cannot be asked for",
    environments: ["node"],
  },
  async (ctx) => {
    // A kind that offers options is one that declares an `option`. That is the catalogue's own way of
    // saying so, and it separates a list of choices from a calendar's grid without either being named
    // in this file.
    const withOptions = Object.entries(MDY_WIDGET_CONTRACTS)
      .filter(([, contract]) => contract.parts.popup !== undefined && contract.parts.option !== undefined)
      .map(([kind, contract]) => [kind, LIST_NAMES.filter((name) => contract.parts[name] !== undefined)]);

    ctx.log.note("what each kind that offers options calls the list they sit in", {
      spellings: Object.fromEntries(withOptions),
    });

    const listed = withOptions.filter(([, names]) => names.length > 0);

    // The premise: there are two to compare. One kind cannot disagree with itself, and this battle
    // would pass on a catalogue that had lost all but one popup.
    expectEqual(listed.length >= 2, true, {
      claimIds: ["API-001"],
      what: "fewer than two kinds declare a list inside a popup, so nothing here is being compared",
      detail: JSON.stringify(withOptions),
    });

    const spellings = [...new Set(listed.flatMap(([, names]) => names))].sort();
    expectEqual(spellings, [spellings[0]], {
      claimIds: ["API-001"],
      what: "two kinds name the same anatomical part differently, so a consumer asking one kind's name of the other gets `undefined` and cannot tell it from a kind that has no such part",
      detail: JSON.stringify(Object.fromEntries(listed)),
    });
  },
);
