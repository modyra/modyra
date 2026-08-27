/**
 * A calendar turns its month with PageUp and PageDown. Every renderer here does it, two of them claim
 * the key while doing it, and no vocabulary declares either key for a date field.
 *
 * That is a gesture the product has and the contract does not know about, which means: no check asks
 * for it, a renderer may drop it without anything going red, and an adapter written from the contract
 * alone ships a calendar that cannot leave the month it opened on.
 *
 * **Why this is a spec of its own rather than a row in the keyboard sweep.** The sweep presses every
 * key into every kind, and to reach an open panel it has to open one — which moves the focus, on a
 * schedule each renderer chooses. Measured across three runs it reported this claim on one run and not
 * the next with nothing changed, and a check that flaps is worse than one that is missing: it teaches
 * people to re-run. Here the panel is opened deliberately, waited for, and one gesture is measured, so
 * the answer is the same every time.
 *
 * Read as a **change to the calendar**, not as `defaultPrevented`: a renderer that turns the month
 * without claiming the key has the gesture just the same, and the contract owes it either way.
 *
 * Claims under attack: ADP-001, KBD-002.
 */
import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KEYBOARD, keyBindingFor } from "@modyra/widgets";
import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
const resolve = keyBindingFor as (kind: string, key: string, open: boolean, on?: string) => unknown;

const CALENDARS = ["datepicker", "daterange"];

/** Every key the kind declares as opening it from closed, tried in turn. */
const opensItself = (kind: string): string[] =>
  ((MDY_WIDGET_KEYBOARD as unknown as Record<string, { key: string; when?: string; intent?: string }[]>)[kind] ?? [])
    .filter((binding) => binding.when === "closed" && binding.intent === "open")
    .map((binding) => binding.key);
const TURNS = ["PageUp", "PageDown"];

/** Declared anywhere a date field could answer it: at the control, or on the grid it opens. */
const declared = (kind: string, key: string): boolean =>
  ["gridcell", "grid", undefined].some((on) => resolve(kind, key, true, on) !== null);

test("a month a calendar turns for nobody", async ({ page }) => {
  test.setTimeout(600_000);
  const turned: string[] = [];
  /** A premise that failed: nothing to type into. Distinct from a calendar that will not open. */
  const inert: string[] = [];
  /** A finding, not a premise: every key the kind declares for opening it leaves it shut. */
  const shut: string[] = [];

  for (const host of HOSTS) {
    for (const kind of CALENDARS) {
      for (const key of TURNS) {
        const mountId = `turn-${kind}-${key}`;
        await page.goto(host.page);
        await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
        await page.evaluate(
          ({ door, id, k }) => (window as never as Api)[door].mountFields(id, [{ name: "campo", kind: k, label: "Etichetta" }] as never),
          { door: host.api, id: mountId, k: kind },
        );
        await page.locator(`[data-form="${mountId}"]`).waitFor({ timeout: 5_000 }).catch(() => undefined);

        const opened = await page.evaluate(({ id }) => {
          const root = document.querySelector(`[data-form="${id}"]`) as HTMLElement | null;
          if (root === null) return false;
          for (const label of root.querySelectorAll<HTMLLabelElement>("label[for]")) {
            const target = label.htmlFor ? document.getElementById(label.htmlFor) : null;
            if (target !== null) { target.focus(); return true; }
          }
          return false;
        }, { id: mountId });
        if (!opened) { inert.push(`${kind} in ${host.name}: no control the label names`); continue; }

        // Every key the kind declares for opening itself, tried in turn: naming one here would make
        // this report a kind that opens on a different key as a kind that does not open.
        const openers = opensItself(kind);
        let shown = false;
        for (const opener of openers) {
          await page.keyboard.press(opener === " " ? "Space" : opener);
          shown = await page.waitForSelector('[role="grid"]', { timeout: 1_500 }).then(() => true).catch(() => false);
          if (shown) break;
        }
        if (!shown) {
          // Once per field, not once per key under test: the same shut calendar counted twice reads
          // as two fields that will not open.
          const line = `${kind} in ${host.name}: opens for none of the keys it declares [${openers.map((one) => one === " " ? "Space" : one).join(" ") || "no key at all"}]`;
          if (!shut.includes(line)) shut.push(line);
          continue;
        }

        const reading = async (): Promise<string> => page.evaluate(() =>
          [...document.querySelectorAll('[role="grid"]')].map((grid) => grid.textContent ?? "").join(" ").replace(/\s+/g, " ").trim());
        const before = await reading();
        await page.keyboard.press(key);
        await page.waitForTimeout(200);
        const after = await reading();

        if (before !== "" && before !== after) turned.push(`${kind} in ${host.name}: ${key} turns the calendar`);
      }
    }
  }

  const gestures = turned.filter((line) => {
    const [kind] = line.split(" in ");
    const key = line.split(": ")[1].split(" ")[0];
    return !declared(kind, key);
  });
  // Both faces printed before either is asserted: the first failing claim otherwise hides the second,
  // and a reader of the run would take the half it shows for the whole finding.
  console.log(`[calendar] ${turned.length} gesture(s) work, ${gestures.length} of them declared by nobody; ` +
    `${shut.length} field(s) never open from the keyboard`);

  // The premise: a calendar that never opened turns for no key, and that is indistinguishable from a
  // renderer with no such gesture. What could not be reached is named rather than counted as absence.
  expect(inert, "these had nothing to type into, so no gesture could be measured in them").toEqual([]);
  expect(turned.length, "no renderer turned its calendar at all, so this measured nothing").toBeGreaterThan(0);

  // Not a premise that failed but a finding: a date field whose calendar answers none of the keys
  // declared to open it is a calendar reachable only with a pointer.
  expect(
    shut,
    `${shut.length} date field(s) never open from the keyboard:\n${shut.join("\n")}\n\n` +
      "A calendar that opens for no declared key can only be reached with a pointer, and the gesture " +
      "below cannot be measured in it at all.",
  ).toEqual([]);

  expect(
    gestures,
    `${undeclared.length} calendar gesture(s) work and are declared by nobody:\n${undeclared.join("\n")}\n\n` +
      "A gesture the contract does not know about is one no check asks for: a renderer may drop it " +
      "with everything staying green, and an adapter written from the contract ships a calendar that " +
      "cannot leave the month it opened on.",
  ).toEqual([]);
});
