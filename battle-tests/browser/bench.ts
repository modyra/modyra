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
 * The container a page puts a control in, which every fixture in this suite forgot to have.
 *
 * Every spec here mounted on a bare page, and on a bare page a popup drawn inside its field looks
 * correct in all three renderers. Put the same field in a 120px scroller and two of them cut their own
 * option list in half — a defect that reached a release-candidate anatomy without going red once,
 * because no fixture ever supplied an ancestor and a consumer always does.
 *
 * These are the ancestors that change what an overlay can do, and they are not interchangeable:
 * `overflow` clips, `transform` and `filter` create a containing block that even `position: fixed`
 * cannot escape, and `contain` does both. A control that escapes one may be caught by another, so a
 * fixture that offers only the scroller would find the first defect of this shape and none of the
 * others.
 */
export const ANCESTORS = {
  /** A form inside a dialog, a card, a side panel. Clips by `overflow`. */
  scroller: "height:120px;overflow:auto;width:420px",
  /** An animated or offset panel. Becomes the containing block for fixed descendants. */
  transformed: "transform:translateZ(0);width:420px",
  /** A pane that promises the browser it is self-contained. Clips and contains. */
  contained: "contain:paint;height:120px;width:420px",
} as const;

export type AncestorName = keyof typeof ANCESTORS;

/**
 * Wrap a mounted field in one of the containers above.
 *
 * Called after `bench`, because the field has to exist to be wrapped, and returns the selector for the
 * container so a spec can measure against it rather than re-finding it.
 */
export async function inside(page: Page, root: string, ancestor: AncestorName) {
  const marker = `${ancestor}_${(wrapped += 1)}`;
  const applied = await page.evaluate(({ root, style, marker }) => {
    const field = document.querySelector(root) as HTMLElement | null;
    if (field === null) return false;
    const box = document.createElement("div");
    box.dataset.ancestor = marker;
    box.style.cssText = style;
    field.parentElement?.insertBefore(box, field);
    box.appendChild(field);
    return true;
  }, { root, style: ANCESTORS[ancestor], marker });
  expect(applied, `${root} was not on the page to wrap in a ${ancestor}`).toBe(true);
  await page.waitForTimeout(200);
  return `[data-ancestor="${marker}"]`;
}
let wrapped = 0;

/**
 * How long a retrying assertion waits, and how often it looks.
 *
 * Passed to `expect.poll` and `expect(...).toPass()` wherever a fixed pause used to sit. The pause was
 * a guess at how long a renderer takes; this is a ceiling on how long it may take, with the waiting
 * itself decided by the page.
 *
 * **The timeout is stated rather than defaulted, because the default makes red slow.** A site that
 * used to sleep 300ms and fail immediately would take Playwright's five seconds to fail — and with a
 * suite people run against known reds, that cost is paid on every run. Two seconds is generous for a
 * renderer settling and cheap when the answer is never coming.
 *
 * **And the intervals are stated because the default is coarse at the front.** It looks at 0, 100,
 * 250, 500, 1000 — so something that settles in 120ms is not seen until 250, which is slower than the
 * pause it replaced. Most of the mass here is under 200ms, so the looking is dense there and thins out
 * behind it.
 */
export const SETTLES = { timeout: 2_000, intervals: [50, 50, 100, 200, 400, 800] } as const;

/**
 * Read something until it stops changing, then hand back the last reading.
 *
 * **This is the wait for a measurement whose finding is an absence.** A spec that collects the kinds
 * whose error class never arrived cannot poll for the class: polling waits for a value to *become*
 * something, and the thing it would wait for is exactly what the defect says is missing, so every
 * real finding would cost the full timeout and the assertion would be about the clock. Waiting for
 * the page to stop moving asks the other question — has this renderer finished having its chance —
 * and that one has the same answer whether the class arrives or not.
 *
 * The window is deliberately generous rather than measured. Too short is a flake with a plausible
 * story; too long costs a fraction of a second. The asymmetry decides it without an experiment.
 */
export async function stops<T>(read: () => Promise<T>, { window = 200, timeout = 2_000 } = {}): Promise<T> {
  const until = Date.now() + timeout;
  let last = await read();
  let held = 0;
  while (Date.now() < until && held < window) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const now = await read();
    held = JSON.stringify(now) === JSON.stringify(last) ? held + 50 : 0;
    last = now;
  }
  return last;
}

/**
 * Wait for a condition and report whether it arrived, without failing if it did not.
 *
 * `expect.poll` throws on timeout, which is right for a claim and wrong for a premise the caller
 * intends to branch on: a spec that skips a kind its renderer never refused wants the answer, not an
 * ended test. Cheap to give up on, because giving up is an expected outcome here — and the cap is
 * short for the same reason: the caller pays it on every premise that does not hold, so a generous
 * one turns the ordinary case of "this renderer builds that kind from a native control" into the
 * most expensive path in the spec.
 */
export async function became(holds: () => Promise<boolean>, { timeout = 400 } = {}): Promise<boolean> {
  const until = Date.now() + timeout;
  for (;;) {
    if (await holds().catch(() => false)) return true;
    if (Date.now() >= until) return false;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/**
 * Wait until a form has submitted at least once, then hand back everything it sent.
 *
 * **A submission is the only post-condition an assertion about a payload can wait on, and the reason
 * is that most of those assertions are negative.** `expect(payload).not.toContain(secret)` is
 * satisfied by a form that has not submitted at all — poll it directly and it passes on the first
 * look, before the page has done anything, and goes on passing after the field it guards starts
 * leaking. The wait belongs on the arrival; the claim is then asserted once, against a payload that
 * exists.
 *
 * The read is repeated after the poll rather than captured inside it, so the value returned is the
 * one the last look saw.
 */
export async function whatLanded(page: Page, id: string) {
  const collected = () => page.evaluate(
    (mountId) => (window as never as { battle: { submittedBy(id: string): unknown[] } }).battle.submittedBy(mountId),
    id,
  );
  await expect
    .poll(collected, { message: `"${id}" submitted nothing, so there is no payload to read`, ...SETTLES })
    .not.toHaveLength(0);
  return collected();
}

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

/**
 * Refuse a fixture in which the claim being made could not have come out false.
 *
 * A comparison needs at least two things to compare, and the smallest fixture that reproduces
 * *something* is the one most likely to collapse the distinction being drawn. Three findings were
 * filed against fixtures too small to hold their own claim — a palette with one swatch, where a key
 * that moves the reading position and a key nothing listens for both leave it where it was; a field
 * with one chosen value, where two routes to removing it both end at an empty field; a chip with a
 * quantity of one, where a count has nothing to say.
 *
 * Each was measured correctly and each was wrong, so this is a guard rather than advice: a spec that
 * asserts a difference states what the difference is between, and the run stops if the fixture cannot
 * hold it.
 *
 * `least` is how many distinct things the claim needs — two to compare, three to see an order.
 */
export function distinguishing(name: string, values: readonly unknown[], least = 2) {
  const distinct = new Set(values.map((one) => JSON.stringify(one)));
  expect(
    distinct.size,
    `${name}: this fixture offers ${distinct.size} distinct value(s) where the claim needs ${least}. `
    + "A reading taken here cannot come out false for the reason the claim gives, whatever it shows.",
  ).toBeGreaterThanOrEqual(least);
  return values;
}

/**
 * Puts a required field into the state where it reports itself wrong, the way a person does.
 *
 * **Focus arriving and leaving is not that way.** Tab is how somebody reads a form, so a field that
 * has only been looked at has nothing to say — which means a spec that reached "wrong" by focusing
 * and blurring now reaches nothing, and its premise fires instead of its claim. Seven of them did,
 * in one afternoon, each having written the old gesture in its own words.
 *
 * The act is on the value: something is typed and taken away again, which is a person answering the
 * field and then unanswering it. Where no box takes text, the fallback is the other channel the rule
 * names — a submission the form refuses — because a control with no keyboard entry still owes its
 * verdict once the form has been sent.
 *
 * Returns whether the field ended up saying anything, so a caller can refuse to continue rather than
 * measure a silence it caused itself.
 */
export async function madeToSpeak(page: Page, root: string, api = "battle"): Promise<boolean> {
  // Visible, and typed into under a clock. A kind whose only box lives inside a closed panel has one
  // that is in the document and cannot be typed into, and `fill` waits for it to become usable rather
  // than refusing — so the catch never runs and the wait is the whole test's timeout. Bounded, the
  // gesture falls through to the other channel instead of spending the run on one field.
  const box = page.locator(`${root} input:not([type="hidden"]):visible, ${root} textarea:visible`).first();
  if (await box.count() > 0) {
    const before = await box.inputValue().catch(() => null);
    await box.fill("x", { timeout: 2_000 }).catch(() => undefined);
    const during = await box.inputValue().catch(() => null);
    await box.fill("", { timeout: 2_000 }).catch(() => undefined);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    if (before !== null && during !== null && during !== before) {
      await page.waitForTimeout(240);
      return true;
    }
  }
  // The other channel, and the only one a kind with no box has: a submission asks every field for
  // its verdict at once. Every host answers to `submit`, so this does not have to know which
  // renderer it is driving.
  const id = /\[data-form="([^"]+)"\]/.exec(root)?.[1];
  if (id === undefined) return false;
  const sent = await page.evaluate(async ({ api, mountId }) => {
    const door = (window as never as Record<string, { submit?(one: string): Promise<unknown> }>)[api];
    if (typeof door?.submit !== "function") return false;
    await door.submit(mountId);
    return true;
  }, { api, mountId: id }).catch(() => false);
  if (sent) await page.waitForTimeout(240);
  return sent;
}

/**
 * Sends every open panel home, and says whether one would not go.
 *
 * A fresh field per case is not a fresh page. A renderer that draws its overlay inside the field
 * takes its panel down with the field; one that draws it over the page leaves it standing, and the
 * next case is then measured through somebody else's panel — a press answered by the field before,
 * a click landing on a backdrop, a reading position inside a list this field does not own. Three
 * different specs reported three different defects that were all this.
 *
 * Asks the page whether anything is still open rather than assuming Escape worked: a panel that will
 * not close is a finding of its own and the caller is told, not left to read a stale measurement as
 * a fresh one.
 */
export async function panelsHome(page: Page, tries = 3): Promise<boolean> {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const open = await page.evaluate(() => document.querySelector('[aria-expanded="true"]') !== null);
    if (!open) return true;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(90);
  }
  return await page.evaluate(() => document.querySelector('[aria-expanded="true"]') === null);
}

/**
 * Whether this driver can move a `<select>` with an arrow at all.
 *
 * The platform's chooser is navigated by the browser, not by the page, and a driver that presses
 * keys at the document does not necessarily reach that navigation: an ordinary `<select>` built here
 * with nothing else on the page does not move under `ArrowDown` in this one. So a shape that does not
 * move proves nothing about the shape until the gesture is shown to work on a control nobody wrote.
 *
 * The control is built and pressed in the page under test, not assumed from a browser name — the
 * answer differs by driver and would rot as a constant.
 */
export const arrowsMoveANativeSelect = async (page: Page): Promise<boolean> => {
  const id = "__il-controllo-nudo";
  await page.evaluate((elementId) => {
    document.getElementById(elementId)?.remove();
    const box = document.createElement("select");
    box.id = elementId;
    for (const value of ["", "uno", "due"]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value === "" ? "Pick" : value;
      box.append(option);
    }
    document.body.append(box);
  }, id);
  await page.locator(`#${id}`).focus();
  await page.locator(`#${id}`).press("ArrowDown");
  await page.waitForTimeout(120);
  const moved = await page.evaluate((elementId) => {
    const box = document.getElementById(elementId) as HTMLSelectElement | null;
    const value = box?.value ?? "";
    box?.remove();
    return value !== "";
  }, id);
  return moved;
};
