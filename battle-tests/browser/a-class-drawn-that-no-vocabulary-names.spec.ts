/**
 * A class name is the only handle a theme has. A stylesheet cannot ask for "the part that shows the
 * error"; it asks for a name, and it keeps working exactly as long as that name does. So a name drawn
 * on the screen and published nowhere is a handle that exists and is not promised: a theme that grabs
 * it breaks on a refactor nobody would call breaking, and the contract's own differ has nothing to
 * compare against.
 *
 * **Two doors, and reading one of them invents findings.** The vocabularies live in the package index
 * *and* in its `./vocabulary` subpath, and the shared names — the button, the overlay panel — are only
 * in the second. Measured by removing it: the finding goes from four names to six, and the two that
 * appear — the button and the overlay panel — are declared, in every renderer that draws them. The
 * subpath is not an implementation detail; it is a published door.
 *
 * Names produced by a function rather than written in a table are asked of the function:
 * `partClasses`, `widgetStateClasses` and the placement classes each spell names no constant contains.
 *
 * Claims under attack: ADP-001, THEME-002.
 */
import { expect, test } from "@playwright/test";
import {
  MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS, partClasses, partStates, popupAlignmentClass,
  popupPlacementClass, widgetStateClasses,
} from "@modyra/widgets";
import * as vocabulary from "@modyra/widgets/vocabulary";
import * as index from "@modyra/widgets";
import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** Every `mdy-` name any published door spells, whether it is written down or computed. */
const published = ((): Set<string> => {
  const names = new Set<string>();
  // The set of objects already walked is not an optimisation. The published index of the
  // vocabularies contains its own entry — an index that omitted itself would publish a collection it
  // does not cover — so a walk without it reaches itself and never returns, and a spec file that
  // never finishes loading takes the whole suite's collection with it.
  const walked = new WeakSet<object>();
  const collect = (value: unknown): void => {
    if (typeof value === "string") { if (value.startsWith("mdy-")) names.add(value); return; }
    if (value === null || typeof value !== "object") return;
    if (walked.has(value)) return;
    walked.add(value);
    if (Array.isArray(value)) { value.forEach(collect); return; }
    Object.values(value).forEach(collect);
  };

  for (const door of [index, vocabulary] as unknown as Array<Record<string, unknown>>) {
    for (const [name, value] of Object.entries(door)) if (name.startsWith("MDY_")) collect(value);
  }

  const contracts = MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, unknown> }>;
  for (const kind of MDY_WIDGET_KINDS as unknown as string[]) {
    for (const part of Object.keys(contracts[kind].parts)) {
      // Both bare and wearing every state the part declares: a modifier is a name too.
      const states = ((partStates as unknown as (k: string, p: string) => string[])(kind, part)) ?? [];
      for (const wearing of [[] as string[], states]) {
        try { collect((partClasses as unknown as (k: string, p: string, s: string[]) => unknown)(kind, part, wearing)); }
        catch { /* a part this kind does not dress */ }
      }
    }
    try { collect((widgetStateClasses as unknown as (k: string, s: object) => unknown)(kind, {})); }
    catch { /* a kind with no state classes */ }
  }
  for (const spell of [popupPlacementClass, popupAlignmentClass] as unknown as Array<(one: string) => unknown>) {
    for (const value of ["above", "below", "overlay", "start", "end", "center"]) {
      try { collect(spell(value)); } catch { /* a value this one does not spell */ }
    }
  }
  return names;
})();

test("a class drawn that no vocabulary names", async ({ page }) => {
  test.setTimeout(600_000);
  const unnamed = new Set<string>();
  const where = new Map<string, string>();
  let seen = 0;

  for (const host of HOSTS) {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    for (const kind of MDY_WIDGET_KINDS) {
      const mountId = `class-${kind}`;
      await page.evaluate(
        ({ door, id, k }) => (window as never as Api)[door].mountFields(id, [{
          name: "campo", kind: k, label: "Etichetta",
          options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
        }] as never),
        { door: host.api, id: mountId, k: kind },
      );
      await page.locator(`[data-form="${mountId}"]`).waitFor({ timeout: 5_000 }).catch(() => undefined);

      const drawn = await page.evaluate(({ id }) => {
        const root = document.querySelector(`[data-form="${id}"]`) as HTMLElement | null;
        if (root === null) return [];
        const found = new Set<string>();
        for (const element of root.querySelectorAll<HTMLElement>("*")) {
          for (const name of element.classList) if (name.startsWith("mdy-")) found.add(name);
        }
        return [...found];
      }, { id: mountId });

      seen += drawn.length;
      for (const name of drawn) {
        if (published.has(name)) continue;
        unnamed.add(name);
        if (!where.has(name)) where.set(name, `${kind} in ${host.name}`);
      }
    }
  }

  // The premise: a page that drew no mdy- class at all has none that go unnamed.
  expect(seen, "no renderer drew a single mdy- class, so this compared nothing").toBeGreaterThan(100);
  expect(published.size, "no published door spelled a class name, so everything would read as unnamed").toBeGreaterThan(100);

  expect(
    [...unnamed].sort().map((name) => `${name} — first seen on ${where.get(name)}`),
    `${unnamed.size} class name(s) are drawn and published by no vocabulary:\n` +
      `${[...unnamed].sort().map((name) => `${name} (${where.get(name)})`).join("\n")}\n\n` +
      "A theme can only hold a name. One that is drawn and not published is a handle that exists " +
      "without a promise: it breaks on a rename nobody would call breaking, and the contract's differ " +
      "has nothing to compare it against.",
  ).toEqual([]);
});
