/**
 * The word the shared policy asks for when a popup opens.
 *
 * `overlayLifecycleTransition` is the one policy every adapter opens and closes by — lit's own
 * overlay host says so in those words, and plain and Angular call it too. Alongside the new state and
 * the effect, it returns `announce`, which is `"opened"`, `"closed"` or nothing.
 *
 * The words for it are published in all five languages: `overlayOpened` is "Popup opened",
 * `overlayClosed` is "Popup closed". Both renderers here ship an announcer — `mdy-plain-announcer`,
 * `mdy-lit-announcer` — and neither reads the field. Angular does.
 *
 * So a shared policy computes an announcement, the vocabulary exists, the machinery is wired, and two
 * of the three renderers drop the answer on the floor.
 *
 * This is belt-and-braces rather than a blackout, and the spec says so by asserting the control
 * first: `aria-expanded` on the opener already changes, so a screen reader that inspects the control
 * learns the state. What is missing is being *told* — the difference between information available on
 * request and information delivered when it changes, which for a popup that appears somewhere else on
 * the page is the difference between noticing and not.
 */

import { expect, test } from "@playwright/test";
import { MDY_I18N_MESSAGES_DEFAULT, overlayLifecycleTransition } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

for (const host of HOSTS) {
  test(`a popup that opens says so, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);

    // The premise, from the policy itself: opening is a thing to announce, and there is a word.
    const opening = overlayLifecycleTransition({ open: false }, { type: "toggle", disabled: false, available: true });
    expect(opening.announce, "the shared policy no longer asks for an announcement when a popup opens").toBe("opened");
    expect(MDY_I18N_MESSAGES_DEFAULT.overlayOpened, "there is no published word for a popup opening").toBeTruthy();

    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("an", [{ name: "x", kind: "datepicker", label: "X" }]);
    }, { api: host.api });
    await page.waitForTimeout(320);

    /** Everything on the page that would speak, and what it currently holds. */
    const spoken = () => page.evaluate(() =>
      Array.from(document.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"]'))
        .map((each) => (each.textContent ?? "").trim())
        .filter((each) => each !== ""));

    expect(await spoken(), "something was already being announced before anything happened").toEqual([]);

    for (const selector of ['[data-form="an"] [aria-haspopup]', '[data-form="an"] button', '[data-form="an"] input']) {
      const candidate = page.locator(selector).first();
      if (await candidate.count() === 0) continue;
      await candidate.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(320);
      const open = await page.evaluate(() =>
        document.querySelector('[data-form="an"] [aria-expanded="true"]') !== null);
      if (open) break;
    }

    // The control: the state did change, and the control says so if you ask it. What follows is
    // about being told rather than about the popup never opening.
    expect(
      await page.evaluate(() => document.querySelector('[data-form="an"] [aria-expanded="true"]') !== null),
      "the popup did not open, so there was nothing to announce",
    ).toBe(true);

    expect(
      await spoken(),
      "a popup opened and nothing on the page said so, though the shared policy asked for it and the word exists",
    ).toContain(MDY_I18N_MESSAGES_DEFAULT.overlayOpened);
  });
}
