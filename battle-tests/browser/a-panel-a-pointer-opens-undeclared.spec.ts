/**
 * `MDY_WIDGET_TRANSITIONS` says which part a pointer opens a panel from. A part that opens it and is
 * not named there is a second door: it works, nothing asks for it, and a renderer may lose it with the
 * suite staying green — while a person who learned the product on one adapter reaches for it on
 * another.
 *
 * **Three things this must not mistake for a second door**, each of which it got wrong before:
 *
 *   a label      clicking one is the platform turning the click into the control's. Not the widget's
 *                gesture and not the widget's to declare.
 *   a part inside a declared part
 *                a click on the placeholder inside the trigger *is* the click on the trigger; the
 *                event reaches the declared part. Read as its own gesture it invents a door per part.
 *   a part with no box
 *                nothing can click it, so it opens nothing and proves nothing.
 *
 * The first two produced ten false findings in one renderer before the walk up the part chain was
 * added — the same walk that `keyBindingFor`'s fourth argument does for keys, and that
 * `MDY_POPUP_OPENERS` does for the part that opens.
 *
 * Read from `aria-expanded`, not from a panel being in the document: the contract permits a panel to
 * be mounted and hidden, so presence answers a different question.
 *
 * Claims under attack: ADP-001, UI-011.
 */
import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS, MDY_WIDGET_TRANSITIONS } from "@modyra/widgets";
import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
const CONTRACTS = MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, { classes: string[] }> }>;
const TRANSITIONS = MDY_WIDGET_TRANSITIONS as unknown as
  Record<string, Array<{ trigger: { type: string; part?: string } }>>;

/** The parts this kind declares a pointer opens it from. */
const declaredOpeners = (kind: string): string[] =>
  (TRANSITIONS[kind] ?? [])
    .filter((transition) => transition.trigger.type === "pointer" && transition.trigger.part !== undefined)
    .map((transition) => transition.trigger.part as string);

test("a panel a pointer opens undeclared", async ({ page }) => {
  test.setTimeout(900_000);
  const undeclared: string[] = [];
  /** Drawn, and not reachable by a scripted click — printed rather than counted as a door that is shut. */
  const unclickable: string[] = [];
  let clicked = 0;

  for (const host of HOSTS) {
    for (const kind of MDY_WIDGET_KINDS) {
      const openers = declaredOpeners(kind);
      if (openers.length === 0) continue;
      const openerClasses = openers.map((part) => CONTRACTS[kind].parts[part]?.classes ?? []);

      for (const [part, definition] of Object.entries(CONTRACTS[kind].parts)) {
        if ((definition.classes ?? []).length === 0) continue;

        // A fresh page per part: a panel left open by the previous click is the state the next one is
        // judged in, and a part that closes it would read as a part that opens nothing.
        await page.goto(host.page);
        await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
        await page.evaluate(
          ({ door, k }) => (window as never as Api)[door].mountFields("gesture", [{
            name: "campo", kind: k, label: "Etichetta",
            options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
          }] as never),
          { door: host.api, k: kind },
        );
        await page.locator('[data-form="gesture"]').waitFor({ timeout: 5_000 }).catch(() => undefined);

        const attempt = await page.evaluate(({ classes, declaredClasses }) => {
          const root = document.querySelector('[data-form="gesture"]') as HTMLElement | null;
          if (root === null) return null;
          const element = root.querySelector<HTMLElement>(classes.map((one: string) => `.${one}`).join(""));
          if (element === null) return null;
          const box = element.getBoundingClientRect();
          if (box.width < 1 || box.height < 1) return null;
          if (element.tagName === "LABEL" || element.closest("label") !== null) return null;

          for (let parent: HTMLElement | null = element; parent !== null && parent !== root.parentElement; parent = parent.parentElement) {
            for (const set of declaredClasses as string[][]) {
              if (set.length > 0 && set.every((one) => parent!.classList.contains(one))) return null;
            }
          }

          // Not everything with a class is clickable from script: an `<svg>` inside a control is an
          // SVGElement and has no `click()`. Faking one with a dispatched event would measure a
          // handler rather than a gesture, so it is skipped and said so.
          if (typeof (element as { click?: unknown }).click !== "function") return "non-clickable";
          const before = root.querySelector("[aria-expanded]")?.getAttribute("aria-expanded") ?? "-";
          element.click();
          return before;
        }, { classes: definition.classes, declaredClasses: openerClasses });

        if (attempt === null) continue;
        if (attempt === "non-clickable") { unclickable.push(`${kind}.${part} in ${host.name}`); continue; }
        clicked += 1;
        await page.waitForTimeout(200);
        const after = await page.evaluate(() =>
          document.querySelector('[data-form="gesture"]')?.querySelector("[aria-expanded]")?.getAttribute("aria-expanded") ?? "-");

        if (attempt !== after) {
          undeclared.push(`${kind} in ${host.name}: clicking ${part} takes it from ${attempt} to ${after}, ` +
            `and only [${openers.join(" ")}] ${openers.length === 1 ? "is" : "are"} declared`);
        }
      }
    }
  }

  // The premise: nothing was clickable, so nothing opened, so nothing is undeclared.
  expect(clicked, "no part was clickable outside a declared opener, so this pressed nothing").toBeGreaterThan(20);
  if (unclickable.length > 0) console.log(`[not clickable from script] ${unclickable.length}: ${unclickable.slice(0, 6).join(" | ")}`);

  expect(
    undeclared,
    `${undeclared.length} part(s) open a panel that no transition declares:\n${undeclared.join("\n")}\n\n` +
      "A second door works until someone removes it, and nothing here would notice. Either the " +
      "transition names it or the renderer stops offering it.",
  ).toEqual([]);
});
