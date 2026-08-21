/**
 * A time typed into an open picker, and the key a person presses to reach the next box.
 *
 * `MDY_WIDGET_KEYBOARD.timepicker` records `{ key: "Tab", when: "open", intent: "cancel" }`, and the
 * renderers implement it:
 *
 *     plain/src/fields/timepicker-field.ts:284
 *       if (event.key === "Escape" || event.key === "Tab") dispatch({ type: "cancel" });
 *
 * So the sequence a keyboard user performs without thinking — open, type the hour, press Tab to reach
 * the minutes — closes the picker and discards what was typed. Tab is not an exit here; it is how a
 * person moves inside a group of fields, and every other multi-box control in this library treats it
 * that way.
 *
 * The consequence is larger than the lost draft. **The confirm button cannot be reached from the
 * keyboard at all**: Tab is the only key that would reach it and Tab closes the picker before it
 * arrives. A widget whose only commit path is a pointer fails WCAG 2.1.1, and this one is used on a
 * kiosk with no physical keyboard *and* by people who have nothing else.
 *
 * Three things are asserted, in the order a person meets them: the draft survives Tab, focus lands
 * somewhere inside the picker rather than out in the page, and the confirm button is reachable.
 *
 * Asserted through `document.activeElement` and the form's own value rather than through the events a
 * handler received — the lesson from 338, whose battle asserted a mechanism and went green over a dial
 * that still flickered under the user's finger.
 *
 * Claims under attack: A11Y-001, UI-011.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
  { name: "angular", page: "/angular.html", ready: "battleAngularReady", api: "battleAngular" },
];

/** Opens a picker and leaves focus wherever the renderer put it. */
async function openPicker(page: import("@playwright/test").Page, host: (typeof HOSTS)[number]) {
  await page.goto(host.page);
  await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
  await page.evaluate(async ({ api }) => {
    await (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
      .mountFields("kb", [{ name: "t", kind: "timepicker", label: "T", format: "24h" }]);
  }, { api: host.api });
  await page.waitForTimeout(300);

  // The declared toggle first. A generic `[aria-haspopup]` sweep matches more than one control in
  // some renderers, so the loop presses a second thing and leaves the popup half-open — which reads
  // as the renderer never focusing anything. Found once and fixed in one file of three; this is the
  // other two.
  for (const selector of [
    '[data-form="kb"] .mdy-timepicker__toggle',
    '[data-form="kb"] [aria-haspopup]',
    '[data-form="kb"] button',
    '[data-form="kb"] input',
  ]) {
    const opener = page.locator(selector).first();
    if (await opener.count() === 0) continue;
    await opener.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(250);
    if (await page.locator(".mdy-timepicker-segment-input").count() > 0) break;
  }
}

/** Where focus is, described well enough to read in a failure. */
const focusHere = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body) return "body — focus left the picker entirely";
    return `${active.tagName.toLowerCase()}.${String(active.className).split(" ").filter(Boolean).join(".") || "(no class)"}`;
  });

/** Whether the picker is still open, asked of the boxes it draws rather than of a flag. */
const stillOpen = (page: import("@playwright/test").Page) =>
  page.locator(".mdy-timepicker-segment-input").count().then((n) => n > 0);

for (const host of HOSTS) {
  test(`a draft survives the key that moves between the boxes, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await openPicker(page, host);

    const segments = page.locator(".mdy-timepicker-segment-input");
    // The premise: the picker opened and drew its boxes. Without them "the draft survived" would be a
    // statement about a picker that never appeared.
    expect(await segments.count(), "the picker built no segment boxes, so nothing could be typed").toBeGreaterThan(0);

    const hour = segments.first();

    // Whether the box can be typed into at all is finding 341, not this spec's subject — and it has to
    // be said before the typing, or a locked box reads as a draft that Tab destroyed. It did exactly
    // that once: lit adopted the contract's dial-first default, its boxes are read-only on the dial, my
    // `fill` swallowed its own failure, and the assertion below blamed Tab for a value that was never
    // typed.
    expect(
      await page.evaluate(() => (document.querySelector(".mdy-timepicker-segment-input") as HTMLInputElement | null)?.readOnly),
      "the boxes are locked in the view this picker opens in, so nothing can be typed and this spec " +
        "cannot say anything about Tab — that is finding 341",
    ).toBe(false);

    await hour.focus();
    // Short, because a read-only input *discards* a keystroke rather than refusing it: `fill` waits
    // for a value that will never arrive and the default timeout is 150 seconds of a suite doing
    // nothing. Whether the box is writable at all is finding 341 and is asserted there.
    await hour.fill("07", { timeout: 3_000 }).catch(() => undefined);
    await page.waitForTimeout(150);

    await page.keyboard.press("Tab");
    await page.waitForTimeout(250);

    const open = await stillOpen(page);
    const where = await focusHere(page);

    expect(
      open,
      `pressing Tab closed the picker — the renderer treats Tab as a cancel, so the hour just typed is ` +
        `gone and focus is at ${where}. Tab is how a person moves between the boxes of one control`,
    ).toBe(true);

    if (open) {
      const kept = await hour.inputValue();
      // The number, not its padding. This assertion once demanded "07" and failed on plain's "7",
      // which is a different question — whether a box pads when it loses focus belongs to finding 342,
      // "what a segment may hold", and reporting it here would have read as a lost draft.
      expect(
        kept === "" ? Number.NaN : Number(kept),
        `the picker stayed open but the hour typed into it did not survive Tab — the box holds ` +
          `${JSON.stringify(kept)}`,
      ).toBe(7);
    }
  });

  test(`the confirm button can be reached from the keyboard, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await openPicker(page, host);

    expect(
      await page.locator(".mdy-timepicker-segment-input").count(),
      "the picker built no segment boxes, so there is nothing to tab from",
    ).toBeGreaterThan(0);
    expect(
      await page.locator(".mdy-timepicker-action-btn").count(),
      "the picker built no action buttons, so there is nothing to reach",
    ).toBeGreaterThan(0);

    await page.locator(".mdy-timepicker-segment-input").first().focus();

    // Walk the control the way a person does. Twelve is more than the picker's own controls and far
    // fewer than the page's, so arriving is a statement about the picker rather than about the page.
    const visited: string[] = [];
    let reached = false;
    for (let press = 0; press < 12 && !reached; press += 1) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(80);
      if (!(await stillOpen(page))) {
        visited.push("(the picker closed)");
        break;
      }
      const at = await focusHere(page);
      visited.push(at);
      reached = at.includes("mdy-timepicker-action-btn");
    }

    expect(
      reached,
      `twelve presses of Tab from the hour box never reached an action button — ${visited.join(" → ")}. ` +
        `Tab is the only key that walks to it, so if Tab does not arrive there the picker cannot be ` +
        `confirmed without a pointer`,
    ).toBe(true);
  });
}
