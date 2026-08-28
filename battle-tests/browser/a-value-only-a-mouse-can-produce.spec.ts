/**
 * Whether a keyboard alone can put a value into every kind that opens a panel.
 *
 * Each of these kinds declares the whole act: a key that opens while it is closed, keys that move
 * while it is open, and `Enter` to commit. Nothing about that declaration says which of them a
 * renderer actually answers, and the two kinds whose opener is a button fall out of every check
 * written outside a browser for the same structural reason — there is no keyboard road to measure
 * without a page.
 *
 * The act is driven entirely from the catalogue: the opener is asked of `MDY_POPUP_OPENERS`, the
 * opening keys and the first `move` key of `MDY_WIDGET_KEYBOARD`. A sequence chosen here instead
 * would measure the guess — a clock face and a palette do not answer the keys a list answers, and a
 * spec that presses `ArrowDown` at both is reporting on its own idea of a picker.
 *
 * **What is read is the value, not the page.** A committed colour moves a swatch's style and a
 * committed hour moves a hand; neither necessarily changes any text, so a check watching the document
 * reports "nothing happened" for a field that holds a value. `valueOf` is what the form has, which is
 * what a submission would carry.
 *
 * **The control is the field left alone.** Every kind is also mounted and left untouched for as long
 * as the driven one is worked, and must still hold what it held: a value that arrives on its own
 * would make every change below attributable to nothing. What counts as empty is never spelled out
 * here — a date range at rest holds two nulls and a text box holds a string — so each field is
 * compared against itself rather than against an idea of emptiness.
 *
 * Claims under attack: UI-011, A11Y-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KEYBOARD } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
type Binding = { key: string; when?: string; intent?: string; modifier?: string };

const OPENERS = MDY_POPUP_OPENERS as unknown as Record<string, { opener?: string } | undefined>;
const CONTRACTS = MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, { classes: string[] }> }>;
const KEYBOARD = MDY_WIDGET_KEYBOARD as unknown as Record<string, Binding[]>;
const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

/** The kinds that declare an opening key, a way to move inside, and a commit. */
const KINDS = Object.keys(KEYBOARD).filter((kind) => {
  const bindings = KEYBOARD[kind] ?? [];
  return bindings.some((one) => one.when === "closed" && one.intent === "open" && one.modifier === undefined)
    && bindings.some((one) => one.when === "open" && one.intent === "move")
    && bindings.some((one) => one.when === "open" && one.intent === "commit");
});

const press = (key: string) => (key === " " ? "Space" : key);
const keysFor = (kind: string, when: string, intent: string) => [
  ...new Set((KEYBOARD[kind] ?? [])
    .filter((one) => one.when === when && one.intent === intent && one.modifier === undefined)
    .map((one) => one.key)),
];

for (const host of HOSTS) {
  test(`a keyboard alone puts a value in every kind that opens, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    expect(KINDS.length, "no kind declares an opening key, a move and a commit").toBeGreaterThan(3);

    const mount = async (id: string, kind: string) => {
      await page.evaluate(({ api, mountId, k, options }) => {
        (window as never as Api)[api].mountFields(mountId, [{ name: "f", kind: k, label: "L", options }] as never);
      }, { api: host.api, mountId: id, k: kind, options: OPTIONS });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(120);
    };

    const held = (id: string) => page.evaluate(
      ({ api, mountId }) => JSON.stringify((window as never as Api)[api].valueOf(mountId) ?? null),
      { api: host.api, mountId: id },
    );

    /** Focus the part the kind declares as its opener, or its control where it declares none. */
    const reach = (id: string, kind: string) => page.evaluate(({ mountId, classes }) => {
      const root = document.querySelector(`[data-form="${mountId}"]`);
      const sought = classes.length > 0 ? root?.querySelector<HTMLElement>(classes.map((one) => `.${one}`).join("")) : null;
      const element = sought ?? root?.querySelector<HTMLElement>('input, select, button, [tabindex]:not([tabindex="-1"])') ?? null;
      element?.focus();
      return element !== null && root?.contains(document.activeElement) === true;
    }, { mountId: id, classes: CONTRACTS[kind].parts[OPENERS[kind]?.opener ?? ""]?.classes ?? [] });

    const empty: string[] = [];
    const unreachable: string[] = [];
    const movedOnItsOwn: string[] = [];
    const atRest = new Map<string, string>();

    for (const kind of KINDS) {
      const untouched = `still_${kind}`;
      await mount(untouched, kind);
      atRest.set(kind, await held(untouched));

      const driven = `typed_${kind}`;
      await mount(driven, kind);
      if (!(await reach(driven, kind))) { unreachable.push(kind); continue; }
      const before = await held(driven);

      // Every declared move, not the first one: a kind's moves are not interchangeable — the first
      // `daterange` declares pages the calendar by month, and a run that pressed only that would be
      // reporting on one key rather than on whether the kind can be filled in.
      const moves = keysFor(kind, "open", "move");
      const commits = keysFor(kind, "open", "commit");
      let landed = false;
      for (const opening of keysFor(kind, "closed", "open")) {
        for (const move of moves) {
          await page.keyboard.press(press(opening));
          await page.waitForTimeout(200);
          await page.keyboard.press(press(move));
          await page.waitForTimeout(160);
          for (const commit of commits) {
            await page.keyboard.press(press(commit));
            await page.waitForTimeout(180);
          }
          if (await held(driven) !== before) { landed = true; break; }
          await page.keyboard.press("Escape");
          await page.waitForTimeout(120);
          await reach(driven, kind);
        }
        if (landed) break;
      }

      if (await held(driven) === before) empty.push(kind);

      // The same field, mounted at the same moment and never touched: whatever it holds now, it held
      // before, or a change means nothing.
      if (await held(`still_${kind}`) !== atRest.get(kind)) movedOnItsOwn.push(kind);
    }

    expect(
      movedOnItsOwn,
      `${host.name} changed the value of ${JSON.stringify(movedOnItsOwn)} with nobody touching it, so `
      + "a change below cannot be attributed to the keys that were pressed",
    ).toEqual([]);

    expect(
      empty,
      `${host.name} holds nothing after a keyboard alone drove ${JSON.stringify(empty)} through the `
      + "whole act each declares — the key that opens it, every key it declares for moving inside it, and the "
      + "key that commits. A control a keyboard cannot put a value into is one a person who does not "
      + "use a pointer cannot fill in at all"
      + (unreachable.length > 0 ? `. Offered no place to stand: ${JSON.stringify(unreachable)}` : "")
      + ".",
    ).toEqual([]);
  });
}
