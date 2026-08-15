/**
 * Where the keyboard ends up after Escape.
 *
 * `MDY_WIDGET_TRANSITIONS` declares, for six kinds, that Escape closes the popup and
 * `restoresFocus`. It is the only behavioural promise in that table beyond which state follows
 * which, and it had no coverage anywhere in this suite.
 *
 * It is the promise that matters most to the person who cannot see the popup close. Focus while the
 * overlay is open lives inside it — a calendar cell, a search box, a swatch — and if closing does not
 * bring it back, the browser drops it on `body`. The next Tab starts from the top of the document,
 * and the user has to walk the whole page to return to the field they were filling in. Nothing on
 * screen looks wrong.
 *
 * The check is what a keyboard user would notice rather than which element exactly: after Escape,
 * focus is somewhere inside the field, and on something they can see. Where precisely differs by
 * kind and by renderer — a trigger button, a text input, a native select — and pinning one element
 * would be pinning an implementation.
 *
 * The kinds come from the table. A seventh that starts declaring `restoresFocus` is held to it
 * without this spec being edited.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_TRANSITIONS } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

/** The kinds whose Escape transition promises to restore focus. */
const RESTORING = Object.entries(MDY_WIDGET_TRANSITIONS)
  .filter(([, transitions]) => transitions.some((each) => each.restoresFocus === true))
  .map(([kind]) => kind);

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

for (const host of HOSTS) {
  test(`escape leaves the keyboard on the field it opened from, ${host.name}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // The premise: the table names kinds at all. An empty list would make every loop below vacuous.
    expect(RESTORING.length, "no kind declares that Escape restores focus").toBeGreaterThan(0);

    for (const kind of RESTORING) {
      const id = `f-${kind}`;
      await page.evaluate(({ mountId, k, api, options }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [{ name: "x", kind: k, label: "X", options }]);
      }, { mountId: id, k: kind, api: host.api, options: OPTIONS });
      await page.waitForTimeout(300);

      /**
       * Whether a popup is on screen.
       *
       * Measured by whether it occupies space rather than by `offsetParent`, which is null for a
       * `popover` element the browser is painting — a check that reads an open overlay as closed.
       */
      const open = () => page.evaluate((sel) =>
        document.querySelector(`${sel} [aria-expanded="true"]`) !== null ||
        Array.from(document.querySelectorAll('[role="dialog"], [role="listbox"]'))
          .some((each) => each.getClientRects().length > 0),
        `[data-form="${id}"]`);

      /**
       * Open it however this renderer opens it.
       *
       * Which part answers a pointer is a separate promise with its own spec, and the renderers do
       * not agree on it. Taking the first opener that works keeps this spec about where the keyboard
       * lands afterwards, rather than failing for the other one's reason.
       */
      for (const selector of [
        `[data-form="${id}"] [aria-haspopup]`,
        `[data-form="${id}"] button`,
        `[data-form="${id}"] select`,
        `[data-form="${id}"] input`,
      ]) {
        const candidate = page.locator(selector).first();
        if (await candidate.count() === 0) continue;
        await candidate.click({ force: true });
        await page.waitForTimeout(360);
        if (await open()) break;
      }

      const native = await page.evaluate((sel) => document.querySelector(`${sel} select`) !== null, `[data-form="${id}"]`);
      if (!native) {
        expect(await open(), `${kind} did not open, so Escape has nothing to close`).toBe(true);
      }

      await page.keyboard.press("Escape");
      await page.waitForTimeout(360);

      const landed = await page.evaluate((sel) => {
        const root = document.querySelector(sel);
        const active = document.activeElement;
        return {
          onBody: active === document.body || active === null,
          inside: root !== null && active !== null && root.contains(active),
          visible: active instanceof HTMLElement && active.getClientRects().length > 0,
          tag: active?.tagName.toLowerCase() ?? null,
        };
      }, `[data-form="${id}"]`);

      expect(landed.onBody, `${kind} left the keyboard on the document body`).toBe(false);
      expect(landed.inside, `${kind} left the keyboard outside the field, on a ${landed.tag}`).toBe(true);
      expect(landed.visible, `${kind} left the keyboard on something the user cannot see`).toBe(true);

      if (!native) {
        expect(await open(), `${kind} did not close on Escape`).toBe(false);
      }

      await page.evaluate(({ mountId, api }) =>
        (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
        { mountId: id, api: host.api });
      await page.waitForTimeout(80);
    }
  });
}
