/**
 * The way back does not restore a value the field no longer offers.
 *
 * An option set is not fixed. A document can change it, a host can reload it, a dependent field can
 * narrow it — and [ADR 0129](../../docs/architecture/0129-one-way-back-not-three.md) gave the
 * multiselect a single untimed undo that covers the last destructive action. The two meet when the
 * set changes *between* the removal and the undo, and what the undo holds is a value from a world
 * that no longer exists.
 *
 * Measured, and it restores it:
 *
 *     start                       ["a","b"]     chips  Alpha · Bravo
 *     remove Bravo                ["a"]
 *     the set drops Bravo         ["a"]         correct so far
 *     press the way back          ["a","b"]     Bravo is back
 *     the chips                   Alpha · "b"   the label is gone, the raw value is on screen
 *
 * Two things are wrong and the second is the one a person sees. The form holds a value the field does
 * not offer — the same family as a choice shown that was never made — and the chip, having no option
 * to take a label from, **shows the value**. A person reads `b` where every other chip reads a word.
 *
 * **The assertion is the property, not the repair.** Dropping the undo entry when the set changes,
 * and restoring only the part the set still holds, are different contracts and this is satisfied by
 * both: it asks only that after the way back, every value held is one the field offers.
 *
 * **Lit only, and that is a limit rather than a choice.** Changing an option set after mount is
 * something a Lit consumer does by assigning a property; the other two hosts have no update path, so
 * the same sequence cannot be driven there. The defect is in shared behaviour and is very unlikely to
 * be Lit's alone — this file measures the one renderer where the sequence is reachable, and says so
 * rather than implying the others were checked.
 *
 * Claims under attack: UI-011, DYN-001.
 */

import { expect, test } from "@playwright/test";
import { SETTLES } from "./bench";

test("the way back does not bring back an option the field stopped offering", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/lit.html");
  await page.waitForFunction(() => (window as never as Record<string, boolean>).battleLitReady === true);

  await page.evaluate(() => {
    (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>).battleLit
      .mountFields("gone", [{
        name: "f", kind: "multiselect", label: "L", initialValue: ["a", "b"],
        options: [{ value: "a", label: "Alpha" }, { value: "b", label: "Bravo" }, { value: "c", label: "Charlie" }],
      }]);
  });
  await page.waitForTimeout(400);

  const held = () => page.evaluate(() =>
    (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>).battleLit.valueOf("gone").f);

  expect(await held(), "the field did not start holding what it was given").toEqual(["a", "b"]);

  const removers = page.locator('[data-form="gone"] .mdy-chip__remove');
  await expect(removers, "no chip offered a way to take it off").toHaveCount(2, { timeout: 5_000 });
  await removers.nth(1).click();
  await expect.poll(() => held(), { message: "taking a chip off did not take its value with it", ...SETTLES }).toEqual(["a"]);

  // The set changes under the control: Bravo is no longer something this field offers.
  await page.evaluate(() => {
    const element = document.querySelector('[data-form="gone"] mdy-multiselect-field') as never as Record<string, unknown> | null;
    if (element !== null) element.options = [{ value: "a", label: "Alpha" }, { value: "c", label: "Charlie" }];
  });
  await expect.poll(() => held(), { message: "changing what the field offers changed what it holds, which is a different defect", ...SETTLES }).toEqual(["a"]);

  const wayBack = page.locator('[data-form="gone"] .mdy-multiselect__way-back-action');
  await expect(
    wayBack,
    "no way back was offered after a removal, so this spec cannot ask its question",
  ).toHaveCount(1, { timeout: 5_000 });
  await wayBack.click();
  await page.waitForTimeout(400);

  const after = await held();
  const offered = ["a", "c"];
  const restoredButGone = (after as string[]).filter((value) => !offered.includes(value));

  expect(
    restoredButGone,
    `the way back restored ${JSON.stringify(restoredButGone)}, which the field stopped offering. ` +
      "The form now holds a value nobody can choose, and the chip drawn for it has no option to take " +
      "a label from — so it shows the value where every other chip shows a word",
  ).toEqual([]);

  // The visible half, stated separately because a renderer could keep the value and still draw it
  // correctly, and because this is the half a person meets.
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll('[data-form="gone"] .mdy-chip')].map((chip) => chip.getAttribute("aria-label")));
  expect(
    labels.filter((label) => label !== null && offered.includes(label)),
    `a chip is labelled with a raw value rather than a word: ${JSON.stringify(labels)}`,
  ).toEqual([]);
});
