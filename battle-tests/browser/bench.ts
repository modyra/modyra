/**
 * A multiselect in a named state, mounted the same way by every spec that needs one.
 *
 * Nine defects in one evening were the instrument rather than the code, across two sessions, and five
 * of them were one shape: **a fixture that made two different states look identical.**
 *
 *   every option chosen          a chip per option and a chip per choice draw the same strip
 *   `initialValue: ["a","a"]`    a repeat on a toggle-set is a malformed value, not a counter
 *   two mounts on one id         a disposed controller behind live-looking DOM
 *   `supportingText: "…"`        a property no field type carries, so all three "failed" together
 *   `searchable` omitted         a popup without a search is not the popup with one
 *
 * None of those is a hard mistake to make. Each was made by someone who knew better, because each spec
 * built its own fixture inline and so each spec got its own chance. A named state is checked once.
 *
 * **It drives the published entry points only** — the host's `mountFields`, which is what a consumer
 * calls. Nothing here reaches into a package's own sources, and a state that cannot be reached from a
 * document is a state this bench must not offer, because a spec that could only be set up from inside
 * would be testing something no consumer can produce.
 */

import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export type BenchHost = { name: string; page: string; ready: string; api: string };

export const HOSTS: BenchHost[] = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
  { name: "angular", page: "/angular.html", ready: "battleAngularReady", api: "battleAngular" },
];

/** Options with short labels, for a strip that fits, and long ones for a strip that does not. */
export const SHORT = ["a", "b", "c", "d"].map((value) => ({ value, label: value.toUpperCase() }));
export const MANY = Array.from({ length: 12 }, (_, index) => ({ value: `v${index}`, label: `Opzione numero ${index}` }));
export const LONG = Array.from({ length: 12 }, (_, index) => ({
  value: `v${index}`,
  label: `Opzione con un nome deliberatamente lungo numero ${index}`,
}));

/**
 * The states, each named for what a person would say about it rather than for its declaration.
 *
 * `mode: "multi"` is what asks for counter chips. A repeated value on the default toggle-set is not a
 * quantity — it is a value the control cannot produce, and a spec that used one to reach counter mode
 * was measuring a toggle and reporting on a counter.
 */
export const STATES = {
  /** Nothing chosen, four offered. The state a form opens in. */
  empty: { options: SHORT, initialValue: [] as string[] },
  /** Three of four taken. The two counts differ on purpose: with every option chosen, a strip that
   *  draws one chip per option and one per choice are the same strip. */
  someOfFew: { options: SHORT, initialValue: ["a", "b", "c"] },
  /** Twelve taken of twelve, short labels: the strip overflows on width alone. */
  full: { options: MANY, initialValue: MANY.map((option) => option.value) },
  /** Twelve taken, labels that cannot fit a chip: truncation and overflow together. */
  fullAndLong: { options: LONG, initialValue: LONG.map((option) => option.value) },
  /** Counter chips, with a quantity to step. */
  counter: { options: SHORT, initialValue: ["a", "a", "a", "b"], mode: "multi" as const },
  /** A search box, because the field asked for one. It is not drawn otherwise. */
  searchable: { options: MANY, initialValue: [] as string[], searchable: true },
  /** Chips a person may rearrange. Off by default, so a spec about moving must say so. */
  reorderable: { options: SHORT, initialValue: ["a", "b", "c"], reorderable: true },
} as const;

export type StateName = keyof typeof STATES;

/**
 * Mount one multiselect in a named state and refuse to continue if it did not appear.
 *
 * **Each call takes a fresh id.** Mounting twice into the same id appends a second form rather than
 * resetting the first, and a selector then drives a disposed controller behind DOM that still looks
 * live — an hour was spent on readings taken that way.
 */
let mounted = 0;
export async function bench(page: Page, host: BenchHost, state: StateName, extra: Record<string, unknown> = {}) {
  const id = `bench_${state}_${(mounted += 1)}`;
  const field = { name: "s", kind: "multiselect", label: "Scelte", ...STATES[state], ...extra };

  await page.evaluate(({ api, id, field }) => {
    (window as never as Record<string, Record<string, (...args: never[]) => unknown>>)[api]
      .mountFields(id, [field] as never);
  }, { api: host.api, id, field });
  await page.waitForTimeout(400);

  const root = `[data-form="${id}"]`;
  const drawn = await page.evaluate((sel) => document.querySelector(sel)?.querySelector(".mdy-renderer--multiselect") !== null, root);
  // A spec whose mount silently did nothing reports on an empty page, and every assertion after this
  // point would be describing the absence rather than the state.
  expect(drawn, `${host.name} drew no multiselect for the "${state}" state`).toBe(true);

  return { id, root, field };
}

/** Open the control and wait for the popup, wherever that renderer puts it. */
export async function open(page: Page, root: string) {
  await page.locator(`${root} .mdy-multiselect__trigger, ${root} [aria-haspopup]`).first().click({ timeout: 5_000 });
  await page.waitForTimeout(300);
}

/** What the strip says is chosen — scoped to the strip, never to the control.
 *
 *  `chip` and `option` both resolve to `.mdy-chip`, and one renderer keeps its popup inside the
 *  component while the others portal theirs out, so a count scoped to the control over-counts in one
 *  place only. The scope was equivalent until the options moved into the popup. */
export function chosen(page: Page, root: string) {
  return page.evaluate((sel) => {
    const strip = document.querySelector(sel)?.querySelector(".mdy-multiselect__chips");
    if (strip === null || strip === undefined) return [];
    return Array.from(strip.querySelectorAll(".mdy-chip"))
      .map((chip) => (chip.querySelector(".mdy-chip__label")?.textContent ?? chip.getAttribute("aria-label") ?? "").trim())
      .filter((label) => label !== "");
  }, root);
}
