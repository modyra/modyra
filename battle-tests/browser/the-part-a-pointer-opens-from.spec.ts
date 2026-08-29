/**
 * The part the table says opens the popup.
 *
 * `MDY_WIDGET_TRANSITIONS` does not only say that a popup opens. Each transition from `closed` names
 * the part the pointer lands on: a `trigger`, a `toggle`, a `searchButton` — and for `datepicker` and
 * `timepicker`, the `control` itself, which is the text box the value is typed into.
 *
 * That distinction is the whole of it. A date field whose text box opens the calendar and one whose
 * text box does nothing are the same markup with the same aria and a different form to fill in: the
 * user clicks where the date is, nothing happens, and they have to find the small button beside it.
 * Nobody files that as a bug, and a renderer that gets it wrong looks correct in every screenshot.
 *
 * So the parts are taken from the table rather than from a list here, and each renderer is asked the
 * same question: does a pointer on the declared part open it.
 *
 * A field rendering a native control is excluded, with the kind named: the browser owns that popup,
 * it is not in the document, and no DOM check can see it open. That is an architectural difference
 * rather than a renderer failing the table.
 *
 * Claims under attack: UI-009.
 */

import { expect, test } from "@playwright/test";
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, MDY_WIDGET_TRANSITIONS } from "@modyra/widgets";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

/** Each kind whose popup a pointer opens, with the part the table names. */
const OPENERS = Object.entries(MDY_WIDGET_TRANSITIONS)
  .map(([kind, transitions]) => ({
    kind,
    part: transitions.find((each) => each.from === "closed" && each.trigger?.type === "pointer")?.trigger?.part,
  }))
  .filter((each) => each.part !== undefined);

/**
 * Where a part lives in a rendered field.
 *
 * `control` is the element the value is entered into; the other three name the button beside it.
 *
 * **Asked of the kind, not taken by position.** A field holds more buttons than the one that opens
 * it — a counter, the commands that clear it and put a value back — and which comes first in the
 * document is a layout decision that moves. "The first button" pointed at whichever part a
 * rearrangement put in front, and the run failed on an element carrying `hidden` rather than on the
 * opener. Where the contract names no classes for a part the old mapping still stands, because that
 * is a gap in the table rather than a choice made here.
 */
const CONTRACTS = MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, { classes: string[] }> }>;
const POPUPS = MDY_POPUP_OPENERS as unknown as Record<string, { opener?: string } | undefined>;

const selectorFor = (id: string, part: string, kind: string) => {
  if (part === "control") return `[data-form="${id}"] input, [data-form="${id}"] textarea`;
  const declared = CONTRACTS[kind]?.parts[POPUPS[kind]?.opener ?? ""]?.classes ?? [];
  return declared.length > 0
    ? `[data-form="${id}"] ${declared.map((one) => `.${one}`).join("")}`
    : `[data-form="${id}"] button`;
};

for (const host of HOSTS) {
  test(`a pointer on the declared part opens the popup, ${host.name}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    expect(OPENERS.length, "no kind declares a pointer transition out of closed").toBeGreaterThan(0);

    const unopened: string[] = [];

    for (const { kind, part } of OPENERS) {
      const id = `t-${kind}`;
      await page.evaluate(({ mountId, k, api }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [{ name: "x", kind: k, label: "X", options: [{ value: "a", label: "A" }] }]);
      }, { mountId: id, k: kind, api: host.api });
      await page.waitForTimeout(300);

      const native = await page.evaluate((sel) =>
        document.querySelector(`${sel} select`) !== null ||
        document.querySelector(`${sel} [aria-expanded]`) === null, `[data-form="${id}"]`);
      if (native) {
        // The browser's own dropdown is not in the document; nothing here can see it open.
        await page.evaluate(({ mountId, api }) =>
          (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
          { mountId: id, api: host.api });
        continue;
      }

      const target = page.locator(selectorFor(id, part!, kind)).first();

      // The premise: the field rendered the part the table names. A missing one is a different
      // finding from a part that does not open.
      expect(await target.count(), `${kind} rendered no ${part} to point at`).toBeGreaterThan(0);

      /**
       * What the field says about itself, read from the part that says it.
       *
       * `aria-expanded` is the widget's own statement, so it needs no guess about which element the
       * popup is or where a renderer puts it — and a renderer that moves its overlay out of the
       * field, or gives it a role this spec did not think of, is still measured correctly.
       */
      const expanded = () => page.evaluate((sel) => {
        const carriers = Array.from(document.querySelectorAll(`${sel} [aria-expanded]`));
        return carriers.some((each) => each.getAttribute("aria-expanded") === "true");
      }, `[data-form="${id}"]`);

      // The premise: it starts closed, so opening is a change rather than a state it was already in.
      expect(await expanded(), `${kind} was already expanded before anything was pointed at`).toBe(false);

      await target.click({ force: true });
      await page.waitForTimeout(360);

      const opened = await expanded();

      if (!opened) unopened.push(`${kind} (${part})`);
      else await page.keyboard.press("Escape");

      await page.waitForTimeout(200);
      await page.evaluate(({ mountId, api }) =>
        (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
        { mountId: id, api: host.api });
      await page.waitForTimeout(80);
    }

    expect(unopened, "a pointer on the part the table names did not open the popup").toEqual([]);
  });
}
