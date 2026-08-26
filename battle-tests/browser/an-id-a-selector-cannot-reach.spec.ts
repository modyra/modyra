/**
 * An id a contract publishes can be reached by the selector a consumer would write.
 *
 * The parts a widget publishes carry ids, and an id exists to be used: an `aria-controls` points at
 * one, a stylesheet selects one, a consumer's own `aria-describedby` names one. Two of those are exact
 * string matches and survive anything; **a selector is not**, and `#` , `.` , `"` and a space each
 * mean something to a CSS parser.
 *
 * An option's id embeds the option's value, so a value with ordinary punctuation in it produces an id
 * that `document.getElementById` resolves and `document.querySelector("#" + id)` cannot — and for two
 * of the four characters below, **throws** rather than returning nothing, so a caller that handles
 * *not found* still gets an exception.
 *
 * **This asserts the property and not the repair, which is why it can exist before the repair is
 * chosen.** Hashing the value, numbering the options and escaping the punctuation are three different
 * contracts and this file is satisfied by all three: it never looks at what the id contains, only at
 * whether the selector a consumer would write reaches the element the id names. A spec that pinned one
 * of the three would be choosing for whoever fixes it — which is the mistake that nearly cost a
 * renderer a button built to satisfy a regular expression.
 *
 * Nothing an assistive technology does is broken by this, and that is exactly why it needs a check.
 * `aria-activedescendant` resolves, `getElementById` resolves, every reader is served — so it survives
 * review, and the only path it breaks is the one a person writes by hand.
 *
 * Claims under attack: API-001, UI-011.
 */

import { expect, test } from "@playwright/test";
import { flattenDynamicSchema } from "@modyra/core";

import { HOSTS } from "./bench";

/** Ordinary values, each carrying one character a CSS parser reads as syntax. */
const PUNCTUATED = [
  { value: "with space", label: "With space" },
  { value: "hash#one", label: "Hash" },
  { value: "dot.two", label: "Dot" },
  { value: "quote\"three", label: "Quote" },
  { value: "plain", label: "Plain" },
];

for (const host of HOSTS) {
  test(`every id a control publishes is reachable by a selector, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api, options }) => {
      (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)[api]
        // **`searchable`, because that is the shape that has ids at all.**
        // [ADR 0139](../../docs/architecture/0139-a-select-has-two-shapes.md) records that a select
        // is two controls, and that `options` and `popup` hold only in the combobox one: a native
        // `<option>` carries no id by construction, because the platform draws that list. Without
        // this flag two of the three renderers failed the premise — *published no ids for a select* —
        // which reads as a defect and is the contract working.
        //
        // That record names a gate for exactly this: a check reading those parts must say which
        // shape it means. This is the check saying so.
        .mountFields("ids", [{ name: "pick", kind: "select", label: "S", searchable: true, options }] as never);
    }, { api: host.api, options: PUNCTUATED });
    await page.waitForTimeout(400);
    // Open it: the option ids do not exist until the list is built.
    await page.locator('[data-form="ids"] button, [data-form="ids"] [aria-haspopup]')
      .first().click({ timeout: 4_000 }).catch(() => undefined);
    await page.waitForTimeout(350);

    const read = await page.evaluate(() => {
      const everyId = Array.from(document.querySelectorAll('[data-form="ids"] [id], [role="option"][id]'))
        .map((element) => element.id);
      // The contract spells a published id `<widget>__<part>__<key>`, and ADR 0146 puts a form's
      // scope in front of it joined by `-`. So the widget's spelling is matched where it sits rather
      // than at the start: `f3p5mzl-pick__option__a` is the same id under a scope.
      //
      // An id in neither shape is not this battle's subject — but it is also not nothing, and the
      // premise below says which of the two it found, because "published no ids" sent a reader
      // looking for a missing feature when what was there was a renderer minting them its own way.
      const inContractSpelling = (id: string) => /(?:^|-)pick__/.test(id);
      (window as never as Record<string, unknown>).__otherScheme = everyId.filter((id) => !inContractSpelling(id));
      const ids = everyId.filter(inContractSpelling);
      return ids.map((id) => {
        let reached: boolean | "throws";
        try {
          reached = document.querySelector(`#${id}`) !== null;
        } catch {
          reached = "throws";
        }
        return { id, byId: document.getElementById(id) !== null, reached };
      });
    });

    const otherScheme = await page.evaluate(() => (window as never as Record<string, string[]>).__otherScheme ?? []);

    // The premise: this control published ids at all. A renderer that publishes none has a different
    // defect and a different file — nothing here would be measuring it.
    expect(
      read.length,
      otherScheme.length > 0
        ? `${host.name} published ${otherScheme.length} id(s) for a select and none in the contract's ` +
          `spelling: ${JSON.stringify(otherScheme.slice(0, 4))}. The contract spells a published id ` +
          "`<widget>__<part>__<key>`, and a renderer minting them another way publishes something no " +
          "consumer reading the contract can predict — which is a finding of its own, not this one"
        : `${host.name} published no ids for a select, so nothing here is being reached for`,
    ).toBeGreaterThan(2);

    // And the premise behind the premise: the values really did carry punctuation into the ids. If a
    // renderer numbered its options the ids would be plain, this would pass, and it would be right.
    expect(
      read.every((entry) => entry.byId),
      `an id this control published does not resolve by \`getElementById\` either, which is a broken ` +
        `id rather than an unreachable one`,
    ).toBe(true);

    const unreachable = read.filter((entry) => entry.reached !== true);
    expect(
      unreachable.map((entry) => `${entry.id} → ${entry.reached === "throws" ? "throws" : "no match"}`),
      `${unreachable.length} of ${read.length} published ids cannot be reached by \`querySelector\`, ` +
        `and ${unreachable.filter((entry) => entry.reached === "throws").length} of those throw rather ` +
        `than miss — so a consumer who handles "not found" still gets an exception. Every reader is ` +
        `served, which is why this survives review: the only path it breaks is the one a person writes`,
    ).toEqual([]);
  });
}

/**
 * The same property, with nobody supplying anything unusual.
 *
 * The check above needs a caller to put punctuation in a value. This one needs nothing: **a form
 * inside a form produces the punctuation by itself.**
 *
 * A repeatable collection is flattened to indexed paths — `righe.0.nome`, `righe.1.nome` — and that
 * is the right answer to the question a collection actually poses, which is how two rows of one
 * document avoid claiming each other's ids. The index disambiguates them, and a per-form id scope
 * could not have: two rows are the *same form*.
 *
 * But the separator that does the disambiguating is `.`, and a widget id is built from the path. So
 * the id of an ordinary field, in an ordinary document, with a plain ASCII name, is
 * `righe.0.nome__label` — which `getElementById` resolves and `querySelector("#" + id)` throws on,
 * because a CSS parser reads `.0` as a class and `0` cannot begin one.
 *
 * `isValidWidgetId` refuses the id delimiter and refuses whitespace, and the reasoning beside it
 * applies to both: *"forbidding costs nothing: an id built from a name containing the delimiter was
 * never deterministic in the first place"*. **The dot is not on that list**, and it is the one
 * character the path scheme itself emits.
 *
 * So this is the first check that does not need a hostile input to fire. The one above can be read as
 * a caller's problem — do not put a quote in a value. There is no such reading here: nesting is the
 * feature, and the feature writes the character.
 *
 * **Robust to the id scope arriving, and to the id scheme changing.** What is asserted is that every
 * id this form publishes can be reached by a selector — not what the ids look like. A scope prefix, a
 * different separator, an escape of the path's punctuation: any of them satisfies this file, and that
 * is the point. The names are taken from `flattenDynamicSchema` rather than written out, so the
 * document under test follows the path scheme rather than restating it.
 */

/** A document with a collection in it: two rows, each holding one ordinary field. */
const NESTED = {
  node: "group",
  children: {
    intestazione: { node: "field", field: { kind: "text", label: "Titolo" } },
    righe: {
      node: "array",
      label: "Righe",
      initialValue: [{}, {}],
      item: { node: "group", children: { nome: { node: "field", field: { kind: "text", label: "Nome" } } } },
    },
  },
} as never;

for (const host of HOSTS) {
  test(`a nested document's own ids are reachable by a selector, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const flat = flattenDynamicSchema(NESTED) as ReadonlyArray<{ name: string }>;
    const fields = flat.map((field) => ({ ...field, supportingText: "aiuto" }));

    // The premise behind everything below: flattening really did put a dot in a name. If the path
    // scheme changed to something a selector can reach, this file has nothing to say and should say
    // that rather than pass as though it had checked.
    const dotted = fields.filter((field) => field.name.includes("."));
    expect(
      dotted.map((field) => field.name),
      "flattening a document with a collection produced no name containing a `.`, so the case this "
      + "file is about does not arise and nothing below is measuring it",
    ).not.toEqual([]);

    await page.evaluate(({ api, fields }) => {
      (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)[api]
        .mountFields("nested", fields as never);
    }, { api: host.api, fields });
    await page.waitForTimeout(500);

    const read = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('[data-form="nested"] [id]')).map((element) => element.id);
      return ids.map((id) => {
        let reached: boolean | "throws";
        try {
          reached = document.querySelector(`#${id}`) !== null;
        } catch {
          reached = "throws";
        }
        return { id, byId: document.getElementById(id) !== null, reached };
      });
    });

    // Published anything at all, and published it for the fields inside the collection rather than only
    // for the one that sits outside it.
    //
    // **Asked of the page, not of the punctuation.** An earlier form of this looked for a `.` in the
    // published ids, which was the character the defect was made of — so the repair that took the
    // character out made the premise announce that the collection had not rendered. A check that
    // recognises a thing by the shape of the defect stops recognising it exactly when it is fixed. The
    // rows are found here by the label a person reads, which no encoding of ours can move.
    const rowsDrawn = await page.locator('[data-form="nested"] label', { hasText: "Nome" }).count();
    expect(
      rowsDrawn,
      `${host.name} drew ${rowsDrawn} field(s) from inside the collection, where the document declares `
      + `two rows. Published ids: ${JSON.stringify(read.map((entry) => entry.id).slice(0, 6))}. Either `
      + "the collection did not render or its fields are labelled some other way, and neither is what "
      + "this file is about",
    ).toBe(2);

    expect(
      read.every((entry) => entry.byId),
      "an id this form published does not resolve by `getElementById` either, which is a broken id "
      + "rather than an unreachable one",
    ).toBe(true);

    const unreachable = read.filter((entry) => entry.reached !== true);
    expect(
      unreachable.map((entry) => `${entry.id} → ${entry.reached === "throws" ? "throws" : "no match"}`),
      `${unreachable.length} of ${read.length} ids this form published cannot be reached by `
      + `\`querySelector\`. Nobody supplied a strange value: the names are \`intestazione\` and `
      + "`nome`, and the punctuation is the path separator the library writes when a document holds a "
      + "collection. So a consumer selecting a nested field by the id the contract gave them gets an "
      + "exception, and the only input required to reach this state is putting a form inside a form",
    ).toEqual([]);
  });
}
