/**
 * Whether a field that declares its box can be typed into accepts what is typed.
 *
 * Two kinds open a panel *and* declare that the box in front of it takes characters. That pairing is
 * a promise about a whole way of working: somebody who knows the date they want does not open a
 * calendar and walk to it, they type it — and somebody who cannot use a pointer has no other way to
 * reach a date six months out in a reasonable number of presses.
 *
 * **Nothing asked for it.** This was the last of three properties the catalogue declares that no
 * check demanded, and the pair before it — which control the browser draws, and whether it hides what
 * is typed — turned out to be honoured by luck of nobody breaking them rather than by anything
 * holding them there.
 *
 * **The declaration has no opposite, so the control is a premise rather than a contrast.** Nothing
 * declares a box that refuses typing, so there is no second group whose behaviour must differ. What
 * stands in for it is the arrangement being proved before the reading: the box exists, it is not
 * marked read-only, focus is on it before a key is pressed, and focus is still on it after — because
 * a control that opened a panel and took the focus away would swallow every keystroke and look
 * exactly like one that refuses typing.
 *
 * **That premise is not hypothetical.** Driving this by pressing the box first, the way a person
 * would, put two of three renderers' focus into the panel the press opened, and the typed characters
 * went nowhere — which reads as a renderer refusing what its kind declares it accepts. The renderers
 * were fine; the driving was measuring the panel.
 *
 * Claims under attack: A11Y-004, UI-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_POPUP_OPENERS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const OPENERS = MDY_POPUP_OPENERS as Record<string, { typeable?: boolean } | undefined>;
const TYPEABLE_KINDS = Object.keys(OPENERS).filter((kind) => OPENERS[kind]?.typeable === true);
/** Digits and separators: what a person types into a date or a time, not a word. */
const TYPED = "12/03/2026";

for (const host of HOSTS) {
  test(`a box its kind says can be typed into keeps what is typed, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1_200, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    expect(TYPEABLE_KINDS.length, "no kind declares a box that can be typed into").toBeGreaterThan(0);

    const refused: string[] = [];
    const notDrawn: string[] = [];
    const lostFocus: string[] = [];

    for (const kind of TYPEABLE_KINDS) {
      const id = `typeable_${kind}`;
      await page.evaluate(({ api, mountId, k }) => {
        (window as never as Api)[api].mountFields(mountId, [{ name: "f", kind: k, label: "L" }] as never);
      }, { api: host.api, mountId: id, k: kind });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
      await page.waitForTimeout(200);

      const box = page.locator(`[data-form="${id}"] input`).first();
      if (await box.count() === 0) { notDrawn.push(kind); continue; }

      // Focus placed, not pressed. A press opens the panel, and where the panel takes the focus is a
      // different question from whether the box accepts characters.
      await box.focus().catch(() => undefined);
      const ready = await page.evaluate((selector) =>
        document.activeElement === document.querySelector(`${selector} input`), `[data-form="${id}"]`);

      await page.keyboard.type(TYPED).catch(() => undefined);
      await page.waitForTimeout(250);

      const after = await page.evaluate((selector) => {
        const control = document.querySelector(`${selector} input`) as HTMLInputElement | null;
        return {
          held: control?.value ?? "",
          readOnly: control?.readOnly ?? true,
          stillFocused: document.activeElement === control,
        };
      }, `[data-form="${id}"]`);

      await page.evaluate(({ api, mountId }) => {
        try { (window as never as Api)[api].dispose?.(mountId as never); } catch { /* nothing mounted */ }
      }, { api: host.api, mountId: id });

      // The arrangement, before the reading: keys that never reached the box say nothing about
      // whether the box takes them.
      if (!ready || !after.stillFocused) { lostFocus.push(`${kind} (focus before=${ready}, after=${after.stillFocused})`); continue; }
      if (after.held === "") {
        refused.push(`${kind} declares its box can be typed into and holds nothing after ${TYPED.length} characters`
          + (after.readOnly ? ", and the box is marked read-only" : ""));
      }
    }

    expect(
      notDrawn,
      `${host.name} drew no box at all for ${JSON.stringify(notDrawn)}, so whether it takes characters `
      + "was never asked",
    ).toEqual([]);

    expect(
      lostFocus,
      `${host.name}: focus was not on the box before or after typing for ${JSON.stringify(lostFocus)}, `
      + "so the keys went somewhere else and what the box holds is not an answer about the box",
    ).toEqual([]);

    expect(
      refused,
      `${host.name}: ${JSON.stringify(refused)}. Somebody who knows the date they want types it rather `
      + "than opening a calendar and walking to it, and somebody who cannot use a pointer has no "
      + "other way to reach a date six months out in a reasonable number of presses. The catalogue "
      + "says the box takes characters; a box that drops them leaves only the long way round.",
    ).toEqual([]);
  });
}
