/**
 * Moving a chosen value: by keystroke, by drag, and whether the two agree.
 *
 * The decision was *keyboard first, and drag must work too*. The way that stays true is that neither is
 * the mechanism: **one intent moves a value, and the keyboard and the pointer are two doors to it.**
 * Build the drag as its own path and it will drift from the keystroke the first time one of them is
 * fixed — which is the shape of nearly every defect this project has found, most recently a hit test and
 * a render reading two different hand lengths.
 *
 * So the assertion is not "dragging works" and "the keys work", each against a value written here. It is
 * that **the same intention expressed two ways lands on the same value.** A renderer that moves by two
 * indices with the pointer and one with the keys passes any pair of separate checks and fails this.
 *
 * Written before either exists, deliberately: a rule agreed after the fact is a rule shaped by whatever
 * got built.
 *
 * Three more things this holds, each failing a different plausible wrong answer:
 *   - `reorderable: false` offers **no way** to move, not merely no decoration — a control that hides the
 *     handles and still answers the keystroke is offering it to a keyboard and denying it to a pointer;
 *   - a chip scrolled out of the strip is still reachable by Tab and **comes back into view when
 *     focused** — the strip scrolls, and a focused thing nobody can see is a keyboard trap;
 *   - the order the form holds is the order the chips are in, after any of it.
 *
 * Claims under attack: UI-011, A11Y-001, API-001.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
  { name: "angular", page: "/angular.html", ready: "battleAngularReady", api: "battleAngular" },
];

const OPTIONS = ["a", "b", "c", "d"].map((value) => ({ value, label: value.toUpperCase() }));

for (const host of HOSTS) {
  const mount = async (page: import("@playwright/test").Page, id: string, reorderable: boolean) => {
    await page.evaluate(async ({ api, id, options, reorderable }) => {
      await (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields(id, [{
          name: "s", kind: "multiselect", label: "S", options,
          initialValue: ["a", "b", "c"], reorderable,
        }]);
    }, { api: host.api, id, options: OPTIONS, reorderable });
    await page.waitForTimeout(350);
  };
  const held = (page: import("@playwright/test").Page, id: string) =>
    page.evaluate(({ api, id }) =>
      (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf(id)?.s ?? null,
      { api: host.api, id });
  const chips = (page: import("@playwright/test").Page, id: string) =>
    // Scoped to the chips strip, not to the control. `chip` and `option` both resolve to `.mdy-chip`,
    // and one renderer keeps its popup inside the component where the others portal theirs to the
    // body — so a count scoped to the control picks up the popup's options in that one alone. The two
    // scopes were equivalent until the options moved out of the closed control, and this spec kept the
    // old one and read the difference as a defect in the renderer that had not changed.
    page.locator(`[data-form="${id}"] .mdy-multiselect__chips .mdy-chip`);

  test(`a keystroke and a drag that mean the same thing land on the same order, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // By keystroke: focus the last chip and move it to the front.
    await mount(page, "by-key", true);
    expect(await held(page, "by-key"), "the field did not start holding what it was given").toEqual(["a", "b", "c"]);
    // Three chosen, so three chips. Today this reads 4 — the catalogue — which is the same defect
    // `a-control-that-shows-what-was-chosen` names; said here as a premise because a strip showing what
    // is *offered* has nothing whose order means anything.
    expect(
      await chips(page, "by-key").count(),
      "the control is drawing a chip per option rather than per choice, so there is no chosen order to move",
    ).toBe(3);

    await chips(page, "by-key").nth(2).focus();
    await page.keyboard.press("Alt+ArrowLeft");
    await page.waitForTimeout(200);
    await page.keyboard.press("Alt+ArrowLeft");
    await page.waitForTimeout(200);
    const byKeystroke = await held(page, "by-key");

    expect(
      byKeystroke,
      `two presses of Alt+ArrowLeft on the last chip left ${JSON.stringify(byKeystroke)} rather than ` +
        `["c","a","b"] — the keyboard cannot reorder, which is the door that has to work first`,
    ).toEqual(["c", "a", "b"]);

    // By drag: the same intention, expressed with a pointer.
    await mount(page, "by-drag", true);
    const source = chips(page, "by-drag").nth(2);
    const target = chips(page, "by-drag").nth(0);
    const from = await source.boundingBox();
    const to = await target.boundingBox();
    expect(from && to, "the chips have no box, so there is nothing to drag").toBeTruthy();

    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
    await page.mouse.down();
    await page.mouse.move(to!.x + 2, to!.y + to!.height / 2, { steps: 12 });
    await page.waitForTimeout(120);
    await page.mouse.up();
    await page.waitForTimeout(300);
    const byDrag = await held(page, "by-drag");

    // The property. Compared against the keystroke's own answer rather than against a literal, so a
    // renderer that moves by a different amount in each door cannot satisfy both by being wrong twice.
    expect(
      byDrag,
      `dragging the last chip to the front gave ${JSON.stringify(byDrag)} where the keystroke that means ` +
        `the same thing gave ${JSON.stringify(byKeystroke)}. One intent, two doors — they have to agree`,
    ).toEqual(byKeystroke);
  });

  /**
   * The third door, and the reason there are three rather than two.
   *
   * WCAG 2.2 **2.5.7 Dragging Movements** requires, independently of any keyboard path, that anything
   * achievable by dragging is achievable with a single pointer that does not drag. A keyboard does not
   * discharge it: the criterion is about pointer users who cannot hold and move — a tremor, a
   * head-pointer, a touchpad they can tap but not drag.
   *
   * So the assertion is the same one as the drag's: **the same intent through a third door lands on
   * the same value.** Not "the buttons work" against a number written here, which would let the button
   * path and the keystroke drift apart the first time one of them is repaired.
   */
  test(`a pointer that cannot drag reaches the same order, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await mount(page, "byKey", true);
    await chips(page, "byKey").last().focus();
    await page.keyboard.press("Alt+ArrowLeft");
    await page.waitForTimeout(250);
    await page.keyboard.press("Alt+ArrowLeft");
    await page.waitForTimeout(250);
    const byKey = await held(page, "byKey");

    await mount(page, "byTap", true);
    // Two taps of "move earlier" on **the same chip**, tracked by its label rather than by where it
    // sits. The keystroke path carries focus with the chip as it moves, so the second press acts on
    // the chip the first one moved; re-reading "the last chip" taps whatever slid into that place
    // instead, which walks the value back to where it started and reads as a door that does nothing.
    for (let press = 0; press < 2; press += 1) {
      await chips(page, "byTap").filter({ hasText: "C" }).first()
        .locator('button[aria-label="Move earlier"]').click({ timeout: 5_000 });
      await page.waitForTimeout(250);
    }
    const byTap = await held(page, "byTap");

    // The premise: the keystroke did something. Two doors agreeing on a value neither of them changed
    // is the way this check passes while proving nothing.
    expect(byKey, "the keyboard did not reorder, so there is nothing for the pointer to agree with").not.toEqual(["a", "b", "c"]);

    expect(
      byTap,
      `tapping "move earlier" twice on the last chip gave ${JSON.stringify(byTap)} where the keystroke ` +
        `that means the same thing gave ${JSON.stringify(byKey)}. One intent, three doors — a pointer ` +
        `that cannot drag is the one 2.5.7 is about, and it has to land where the others do`,
    ).toEqual(byKey);
  });

  test(`a control that is not reorderable offers no way to move, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await mount(page, "fixed", false);

    expect(
      await chips(page, "fixed").count(),
      "the control is drawing a chip per option rather than per choice, so `reorderable: false` cannot be read here",
    ).toBe(3);
    await chips(page, "fixed").nth(2).focus();
    await page.keyboard.press("Alt+ArrowLeft");
    await page.waitForTimeout(250);

    expect(
      await held(page, "fixed"),
      "the field declared reorderable: false and the keystroke moved a value anyway — off has to mean " +
        "off, not merely undecorated, or a control denies a pointer what it grants a keyboard",
    ).toEqual(["a", "b", "c"]);
  });

  test(`a chip scrolled out of the strip is still reachable and comes back into view, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // Enough chosen that the strip must scroll rather than wrap.
    await page.evaluate(async ({ api }) => {
      const many = Array.from({ length: 12 }, (_, index) => ({ value: `v${index}`, label: `Opzione lunga ${index}` }));
      await (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("scroll", [{
          name: "s", kind: "multiselect", label: "S", options: many,
          initialValue: many.map((option) => option.value), reorderable: true,
        }]);
    }, { api: host.api });
    await page.waitForTimeout(400);

    const all = chips(page, "scroll");
    expect(
      await all.count(),
      "twelve values were chosen and the control drew a different number of chips — it is counting the " +
        "catalogue rather than the selection",
    ).toBe(12);

    const last = all.nth(11);
    await last.focus();
    await page.waitForTimeout(250);

    const seen = await last.evaluate((element) => {
      const strip = element.closest(".mdy-multiselect__chips");
      if (strip === null) return { inStrip: false, visible: false };
      const chip = element.getBoundingClientRect();
      const box = strip.getBoundingClientRect();
      return {
        inStrip: true,
        visible: chip.left >= box.left - 1 && chip.right <= box.right + 1,
      };
    });

    expect(seen.inStrip, "the chips are not inside the declared strip, so nothing scrolls").toBe(true);
    expect(
      seen.visible,
      "the last chip was focused and is still outside the visible part of the strip — a focused thing " +
        "nobody can see is a keyboard trap",
    ).toBe(true);
  });
}
