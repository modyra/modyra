/**
 * An arrow key on a time segment, and whether the form heard it.
 *
 * `stepTimeField`, `acceptTimeField` and `timeFieldBounds` are battled as arithmetic — they answer
 * correctly for both formats. What nothing asks is the question a person is actually asking when they
 * press `ArrowUp`: **did the value change**, not did the box repaint.
 *
 * That gap is not hypothetical. Angular's segment computed the next value through those same three
 * functions, wrote it onto `input.value`, and dispatched a synthetic `input` event — while the
 * template bound `[value]="value()"`. Two owners for one DOM property: the binding wrote the old
 * value back and the arrow did nothing, with every unit test passing, because the unit tests read
 * `input.value` immediately after the write.
 *
 * Lit has the same two-owner shape and **works**, because its synthetic event happens to reach a
 * handler that dispatches the intent, so the round trip returns the new value. It works by a property
 * of the path, not by design, and the day that path stops returning the new value Lit goes dark the
 * same way. That is the case this spec exists to hold: the check is on the **model**.
 *
 * Read through `valueOf`, which is the form's own value rather than anything the page is showing —
 * **after confirming**, because a picker edits a draft and `confirm` is what commits it. A first
 * draft of this spec asserted the value moved on the keystroke itself and failed on both renderers
 * with `the segment stepped from 00 to 01 and the form's value stayed null`. That was the spec
 * asserting a defect rather than a property: the box had moved, the draft had moved, and the engine
 * was behaving exactly as documented. The property is that the step **survives the commit**.
 *
 * Angular is not here because the browser tier has no Angular host — `battle-tests/angular/` packs the
 * library and imports it, never rendering a page. Angular's segment is covered by its own jest specs,
 * which is where the defect above was finally caught; the point stands that it took a person to find
 * it first.
 *
 * Claims under attack: UI-011, API-001.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

/** The value the form holds, not the text the box shows. */
async function modelValue(page: import("@playwright/test").Page, api: string, id: string) {
  return page.evaluate(
    ({ api: name, id: form }) =>
      (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[name]
        .valueOf(form)?.t ?? null,
    { api, id },
  );
}

for (const host of HOSTS) {
  test(`an arrow on a time segment moves the value, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("seg", [{ name: "t", kind: "timepicker", label: "T" }]);
    }, { api: host.api });
    await page.waitForTimeout(300);

    // Open the picker, which is where the segments live. Whichever affordance opens it — the openers
    // differ per renderer and which one it is is not this spec's subject.
    for (const selector of ['[data-form="seg"] [aria-haspopup]', '[data-form="seg"] button', '[data-form="seg"] input']) {
      const opener = page.locator(selector).first();
      if (await opener.count() === 0) continue;
      await opener.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(250);
      if (await page.locator('[data-form="seg"] [aria-expanded="true"]').count() > 0) break;
    }

    const segments = page.locator(".mdy-timepicker-segment-input");
    const found = await segments.count();

    // The premise: the picker opened and built its number boxes. Without them "the value did not
    // change" would be a statement about a picker that never appeared.
    expect(found, "the time picker built no segment boxes, so no arrow could be pressed").toBeGreaterThan(0);

    const hour = segments.first();
    await hour.focus();
    const shownBefore = await hour.inputValue();
    const modelBefore = await modelValue(page, host.api, "seg");

    await hour.press("ArrowUp");
    await page.waitForTimeout(250);

    const shownAfter = await hour.inputValue();

    // Commit, because the value under test is the one the form keeps. The last action button is the
    // confirm — the pair is cancel then confirm, and which is which is the renderer's ordering, so
    // the spec takes the one that closes with a value rather than naming it.
    const actions = page.locator(".mdy-timepicker-action-btn");
    expect(await actions.count(), "the picker built no action buttons, so nothing could commit").toBeGreaterThan(0);
    await actions.last().click({ force: true });
    await page.waitForTimeout(300);

    const modelAfter = await modelValue(page, host.api, "seg");

    // The box has to have moved, or the arrow was never handled at all and what follows is about a
    // key nothing listened for rather than about a value that did not travel.
    expect(
      shownAfter,
      `the box did not change on ArrowUp, so the key reached no handler (was ${shownBefore})`,
    ).not.toEqual(shownBefore);

    // And the half that is the whole point: the form heard it. A box that steps while the model
    // stands still is a control that looks like it works.
    expect(
      { shown: shownAfter !== shownBefore, model: modelAfter !== modelBefore },
      `the segment stepped from ${shownBefore} to ${shownAfter}, the picker was confirmed, and the form's value stayed ${JSON.stringify(modelBefore)}`,
    ).toEqual({ shown: true, model: true });
  });
}
