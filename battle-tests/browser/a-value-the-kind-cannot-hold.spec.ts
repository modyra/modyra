/**
 * What a form holds for a field is something that field's kind can hold.
 *
 * A consumer's hand-written field list is not a document: `mountMdyForm` and its siblings read it as
 * given and do not put it through the parser. That is deliberate — the raw door exists so a page can
 * build a form in code without writing a document — and it means the checks a document gets are the
 * document's, not this door's.
 *
 * **The value is where that stops being a matter of taste.** `explainValueMismatch` is published, and
 * a text field declaring `initialValue: 42` is the case it names: the form is invalid before anyone
 * touches it, and the message a person eventually reads is about a value they never entered.
 *
 * Measured through the raw door, the same list, all three:
 *
 *     plain     bad: ""    the initial the kind cannot hold is discarded
 *     angular   bad: ""    discarded
 *     lit       bad: 42    kept — a text field holding a number
 *
 * All three draw the control, and that is right: a raw list is the caller's own and refusing to draw
 * it would make this door something it is not. What they disagree about is **what the form then
 * holds**, and a payload that differs by adapter for one list is the thing `@modyra/widgets` exists
 * to prevent.
 *
 * **The assertion picks no repair.** Discarding, refusing the mount, and coercing are three different
 * contracts and this is satisfied by the first two and would fail the third loudly, which is the
 * right shape: what it refuses is a form quietly holding something its own contract says that kind
 * cannot carry.
 *
 * Claims under attack: DYN-004, VAL-003, ADP-001.
 */

import { expect, test } from "@playwright/test";
import { explainValueMismatch } from "@modyra/core";
import { HOSTS } from "./bench";

/** A kind, and an initial value its own contract says it cannot hold. */
const MISMATCHED = [
  { name: "text_", kind: "text", label: "Text", initialValue: 42 },
  { name: "number_", kind: "number", label: "Number", initialValue: "not a number" },
  { name: "toggle_", kind: "toggle", label: "Toggle", initialValue: "yes" },
];

for (const host of HOSTS) {
  test(`a form holds nothing its kind cannot carry, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const mounted = await page.evaluate(({ api, fields }) => {
      try {
        return (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)[api]
          .mountFields("held", [{ name: "ok", kind: "text", label: "OK" }, ...fields] as never);
      } catch (error) {
        return { mounted: false, message: String((error as Error).message) };
      }
    }, { api: host.api, fields: MISMATCHED });

    // Refusing the whole mount is one of the answers this spec accepts, and there is nothing to
    // measure afterwards if that is the one taken.
    if ((mounted as { mounted?: boolean }).mounted === false) return;

    await page.waitForTimeout(400);

    const held = await page.evaluate(({ api }) =>
      (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf("held"),
      { api: host.api });

    // The premise: the form was built and holds the field that was fine. A mount that produced
    // nothing would satisfy every check below by having nothing to check.
    expect(held, "the form holds nothing at all, so this measures an absence").not.toBeNull();
    expect(Object.keys(held ?? {}), "the field with an ordinary value is not in the payload").toContain("ok");

    const carried = MISMATCHED
      .map(({ name, kind, initialValue }) => ({
        name, kind, declared: initialValue, held: held?.[name],
        // **The contract decides, not this fixture.** The filter used to be `held === declared`,
        // which is true of every field holding a value it may legitimately hold — it only worked
        // because every entry above happens to be a mismatch, and a valid one added later would
        // have been reported as a defect. A mutation with correct values turned all three renderers
        // red and found it.
        refused: explainValueMismatch(kind, initialValue) !== null,
      }))
      .filter((each) => each.refused && each.held === each.declared);

    expect(
      carried,
      `${carried.length} field(s) hold the value their kind cannot carry:\n${JSON.stringify(carried, null, 1)}\n\n` +
        "`explainValueMismatch` names this case: the form is invalid before anyone touches it, and " +
        "the message a person eventually reads is about a value they never entered. Discarding it and " +
        "refusing the mount both satisfy this; carrying it is what does not.",
    ).toEqual([]);
  });
}
