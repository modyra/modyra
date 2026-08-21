/**
 * What a multiselect looks like when it cannot be used, and what its chips are called.
 *
 * Written as a net under a redesign rather than as a complaint about one. The control's anatomy is
 * being rebuilt — the option list leaves the closed field, a `trigger` replaces the magnifier — and the
 * risk in any rebuild is not the thing somebody decides to remove. It is the thing the new picture
 * never included, which nobody notices because nothing reported it.
 *
 * So: measured today, pinned today, and red where today is already wrong.
 *
 *     normal      plain  mdy-chip--value  mdy-chip--selected  mdy-label--filled
 *                 lit    mdy-chip--selected  mdy-label--filled
 *     disabled    both   mdy-input-wrapper--disabled
 *     readonly    both   nothing at all
 *
 * **A read-only multiselect is indistinguishable from an ordinary one.** The field supports the state,
 * the contract declares `readonly` on the trigger, and no class reaches the page — so a form that has
 * been locked for review looks exactly like one waiting to be filled in, and the only way to discover
 * otherwise is to try.
 *
 * **Lit omits `mdy-chip--value`**, which the contract lists beside `mdy-chip` as what a chip *is*.
 * Plain emits both. A theme keying on it styles plain's chips and not lit's, which is the shape of the
 * orphaned rules in finding 323 read from the other side: not a rule nobody emits, a class one renderer
 * forgets.
 *
 * Both assertions read the class from `MDY_WIDGET_CONTRACTS` rather than from a literal, so they keep
 * meaning the same thing after the rename that is currently in flight.
 *
 * Claims under attack: UI-009, A11Y-001.
 */

import { expect, test } from "@playwright/test";
import { MDY_FIELD_STATE_CLASSES, MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

const CHIP_CLASSES = MDY_WIDGET_CONTRACTS.multiselect.parts.chip.classes;
const OPTIONS = ["a", "b", "c"].map((value) => ({ value, label: value.toUpperCase() }));

for (const host of HOSTS) {
  test(`a multiselect shows that it cannot be edited, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await page.evaluate(async ({ api, options }) => {
      const board = (window as never as Record<string, Record<string, (...args: never[]) => unknown>>)[api];
      board.mountFields("open", [{ name: "s", kind: "multiselect", label: "S", options }]);
      board.mountFields("locked", [{ name: "s", kind: "multiselect", label: "S", options }]);
      board.readonly("locked", "s");
    }, { api: host.api, options: OPTIONS });
    await page.waitForTimeout(400);

    const marks = (id: string) =>
      page.evaluate((formId) => {
        const root = document.querySelector(`[data-form="${formId}"]`);
        if (root === null) return null;
        return [...new Set(Array.from(root.querySelectorAll("*")).flatMap((element) =>
          String(element.className).split(/\s+/).filter((name) => name.includes("--"))))].sort();
      }, id);

    const ordinary = await marks("open");
    const locked = await marks("locked");
    expect(ordinary, "nothing was mounted").not.toBeNull();

    // The premise: the two mounts really are in different states. Without it "they look the same" would
    // be a statement about two identical fields.
    expect(
      await page.evaluate(() => document.querySelectorAll('[data-form="locked"]').length),
      "the read-only field was not mounted, so there is nothing to compare",
    ).toBe(1);

    expect(
      locked,
      `a read-only multiselect carries exactly the same classes as an editable one — ` +
        `${JSON.stringify(locked)} against ${JSON.stringify(ordinary)}. A form locked for review looks ` +
        `like one waiting to be filled in, and the only way to find out is to try`,
    ).not.toEqual(ordinary);
  });

  test(`a chip carries every class the contract says it is, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await page.evaluate(async ({ api, options }) => {
      (window as never as Record<string, Record<string, (...args: never[]) => unknown>>)[api]
        .mountFields("chips", [{ name: "s", kind: "multiselect", label: "S", options, initialValue: ["a"] }]);
    }, { api: host.api, options: OPTIONS });
    await page.waitForTimeout(400);

    const found = await page.evaluate((first) => {
      const root = document.querySelector('[data-form="chips"]');
      if (root === null) return null;
      const chip = root.querySelector(`.${first}`);
      return chip === null ? [] : String(chip.className).split(/\s+/).filter(Boolean);
    }, CHIP_CLASSES[0]);

    expect(found, "nothing was mounted").not.toBeNull();
    expect(found!.length, `no .${CHIP_CLASSES[0]} was drawn, so there is no chip to read`).toBeGreaterThan(0);

    for (const declared of CHIP_CLASSES) {
      expect(
        found,
        `the contract says a chip is ${JSON.stringify(CHIP_CLASSES)} and this one carries ` +
          `${JSON.stringify(found)} — a theme keying on .${declared} styles the renderers that emit it ` +
          `and silently skips the ones that do not`,
      ).toContain(declared);
    }
  });
}
