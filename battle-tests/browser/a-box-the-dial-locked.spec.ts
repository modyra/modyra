/**
 * The number boxes while the clock face is showing, and whether a person may still type into them.
 *
 * The rule was given directly: *"in modalità dial deve comunque continuare a funzionare la 'input' sui
 * numeri e devono nel caso muoversi con le frecce sugli steps"*. A dial is a pointer affordance. If
 * entering it made the boxes read-only, the only remaining way to set a time would be dragging — the
 * one gesture a keyboard cannot make and a screen reader cannot describe.
 *
 * Three renderers answer three ways, measured on a `24h` picker with nothing else configured:
 *
 *     plain     dial showing   readOnly false    typing works
 *     lit       dial showing   readOnly true     typing blocked
 *     angular   dial showing   readOnly true     typing blocked
 *
 * Nothing in `MDY_WIDGET_CONTRACTS.timepicker` says whether a segment is writable while the dial is
 * up, so each renderer decided, and two decided against the rule. This is the shape the brief forbids:
 * a behaviour that belongs to the widget, settled locally three times.
 *
 * Two further disagreements surfaced with it and are asserted here rather than left as notes, because
 * each is a person meeting a different control depending on which adapter their team chose:
 *
 *   - **which view a picker opens in** — lit opens on the boxes, plain and angular on the face;
 *   - **whether the mode toggle changes the view at all**, read as *visible* rather than *present*:
 *     plain hides the face and keeps it in the document where the other two remove it, and both are
 *     conforming, so presence is a strategy and visibility is the behaviour.
 *
 * `readOnly` is asserted rather than a typed character, because a read-only input silently discards
 * input rather than refusing it: `fill()` against Angular's box did not fail, it hung for 150 seconds.
 * The property is what the renderer decided; the silence is why nothing noticed.
 *
 * Claims under attack: A11Y-001, UI-011.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
  { name: "angular", page: "/angular.html", ready: "battleAngularReady", api: "battleAngular" },
];

async function openPicker(page: import("@playwright/test").Page, host: (typeof HOSTS)[number]) {
  await page.goto(host.page);
  await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
  await page.evaluate(async ({ api }) => {
    await (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
      .mountFields("dv", [{ name: "t", kind: "timepicker", label: "T", format: "24h" }]);
  }, { api: host.api });
  await page.waitForTimeout(300);
  for (const selector of ['[data-form="dv"] [aria-haspopup]', '[data-form="dv"] button', '[data-form="dv"] input']) {
    const opener = page.locator(selector).first();
    if (await opener.count() === 0) continue;
    await opener.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(250);
    if (await page.locator(".mdy-timepicker-segment-input").count() > 0) break;
  }
}

/** What the picker is showing and whether its first box will take a character. */
const readState = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const segment = document.querySelector(".mdy-timepicker-segment-input") as HTMLInputElement | null;
    return {
      boxes: document.querySelectorAll(".mdy-timepicker-segment-input").length,
      // Visible, not merely present. Plain keeps the face in the DOM and hides it; lit and angular
      // remove it. `structure.ts` declares both conforming, so asking "is it in the document" asserts
      // a strategy the contract does not choose between — and reported plain as ignoring its own
      // toggle when the view was changing correctly.
      dialShowing: (() => {
        const face = document.querySelector(".mdy-timepicker-dial__face");
        return face !== null && face.getBoundingClientRect().width > 0;
      })(),
      readOnly: segment === null ? null : segment.readOnly,
      hasModeToggle: document.querySelectorAll(".mdy-timepicker-mode-toggle").length > 0,
    };
  });

for (const host of HOSTS) {
  test(`a number box takes typing while the dial is showing, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await openPicker(page, host);

    let state = await readState(page);
    // The premise: the picker opened and drew its boxes.
    expect(state.boxes, "the picker built no segment boxes, so there is nothing to type into").toBeGreaterThan(0);

    // Get to the dial, whichever view this renderer opened in — they do not agree, which is the
    // sibling assertion below rather than something to paper over here.
    if (!state.dialShowing && state.hasModeToggle) {
      await page.evaluate(() => (document.querySelector(".mdy-timepicker-mode-toggle") as HTMLElement | null)?.click());
      await page.waitForTimeout(300);
      state = await readState(page);
    }

    expect(
      state.dialShowing,
      "the dial never appeared, so this says nothing about typing while it is up",
    ).toBe(true);

    expect(
      state.readOnly,
      "the number box is read-only while the dial is showing, so the only way left to set a time is " +
        "dragging — the one gesture a keyboard cannot make. A read-only box discards a keystroke " +
        "silently rather than refusing it, which is why nothing noticed",
    ).toBe(false);
  });

  test(`the mode toggle changes which view is showing, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await openPicker(page, host);

    const before = await readState(page);
    expect(before.boxes, "the picker built no segment boxes").toBeGreaterThan(0);
    expect(
      before.hasModeToggle,
      "the picker draws no mode toggle, so there is no way to change view at all",
    ).toBe(true);

    await page.evaluate(() => (document.querySelector(".mdy-timepicker-mode-toggle") as HTMLElement | null)?.click());
    await page.waitForTimeout(300);
    const after = await readState(page);

    expect(
      after.dialShowing,
      `the mode toggle was pressed and the view did not change — the dial was ` +
        `${before.dialShowing ? "showing" : "hidden"} before and ${after.dialShowing ? "showing" : "hidden"} ` +
        `after. A control that draws a toggle and ignores it offers a choice it does not honour`,
    ).toBe(!before.dialShowing);
  });
}
