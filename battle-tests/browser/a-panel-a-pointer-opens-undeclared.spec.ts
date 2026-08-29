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
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS, MDY_WIDGET_TRANSITIONS, variantOf } from "@modyra/widgets";
import { HOSTS, stops } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
const CONTRACTS = MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, { classes: string[] }> }>;
const OPENERS = MDY_POPUP_OPENERS as unknown as Record<string, { alsoOpensFrom?: string }>;
const TRANSITIONS = MDY_WIDGET_TRANSITIONS as unknown as
  Record<string, Array<{ trigger: { type: string; part?: string } }>>;

/**
 * The parts this kind declares a pointer opens it from.
 *
 * Two declarations, because a kind may have two doors and only one of them carries the relation: the
 * transitions name the opener that says whether the overlay is showing, and `alsoOpensFrom` names the
 * part beside it that a pointer may open from and that announces nothing — a second element claiming
 * `aria-expanded` for one overlay would say there are two comboboxes for one list.
 */
const declaredOpeners = (kind: string): string[] => {
  const fromTransitions = (TRANSITIONS[kind] ?? [])
    .filter((transition) => transition.trigger.type === "pointer" && transition.trigger.part !== undefined)
    .map((transition) => transition.trigger.part as string);
  const second = OPENERS[kind]?.alsoOpensFrom;
  return second === undefined ? fromTransitions : [...fromTransitions, second];
};

for (const only of HOSTS) {
test(`a panel a pointer opens undeclared, ${only.name}`, async ({ page }) => {
  test.setTimeout(900_000);
  const undeclared: string[] = [];
  /** Drawn, and not reachable by a scripted click — printed rather than counted as a door that is shut. */
  const unclickable: string[] = [];
  /** A part the kind declares a pointer opens it from, pressed, and the panel stayed shut. */
  const silent: string[] = [];
  let clicked = 0;
  let opened = 0;

  for (const host of [only]) {
    for (const kind of MDY_WIDGET_KINDS) {
      const openers = declaredOpeners(kind);
      if (openers.length === 0) continue;
      const openerClasses = openers.map((part) => CONTRACTS[kind].parts[part]?.classes ?? []);

      // One page per kind. A panel a previous click left open is the state the next would be judged
      // in — but that state lives in the field, so a fresh field per part is enough. Reloading the
      // document for every part made this the second most expensive spec in the suite.
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

      for (const [index, [part, definition]] of Object.entries(CONTRACTS[kind].parts).entries()) {
        if ((definition.classes ?? []).length === 0) continue;
        const mountId = `gesture-${index}`;

        await page.evaluate(
          ({ door, k, id }) => (window as never as Api)[door].mountFields(id, [{
            name: "campo", kind: k, label: "Etichetta",
            options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
          }] as never),
          { door: host.api, k: kind, id: mountId },
        );
        await page.locator(`[data-form="${mountId}"]`).waitFor({ timeout: 5_000 }).catch(() => undefined);
        // In the document is not yet listening. A field whose framework binds on a later tick is
        // drawn, answers a query and ignores a press, and a page carrying twenty of them takes long
        // enough about it that a press sent on arrival lands on nothing. Settled, not merely present.
        await stops(() => page.evaluate(({ id }) => {
          const root = document.querySelector(`[data-form="${id}"]`);
          return root === null ? "" : `${root.childElementCount}:${root.innerHTML.length}`;
        }, { id: mountId }), { window: 150, timeout: 3_000 });

        // A panel a previous press left open is not always the previous field's business: a renderer
        // that draws its overlay outside the field leaves it standing over the page, and the next
        // press is then read as the gesture that dismisses it rather than the one that opens.
        await page.keyboard.press("Escape");
        await page.waitForTimeout(80);

        const attempt = await page.evaluate(({ classes, declaredClasses, id }) => {
          const root = document.querySelector(`[data-form="${id}"]`) as HTMLElement | null;
          if (root === null) return null;
          const element = root.querySelector<HTMLElement>(classes.map((one: string) => `.${one}`).join(""));
          if (element === null) return null;
          const box = element.getBoundingClientRect();
          if (box.width < 1 || box.height < 1) return null;
          if (element.tagName === "LABEL" || element.closest("label") !== null) return null;

          // The element itself being a declared opener is not a skip but the control case: pressing
          // it is what shows this sweep can open anything at all, and a declaration whose part does
          // not open is a lie the sweep would otherwise pass over in silence.
          let itself = false;
          for (const set of declaredClasses as string[][]) {
            if (set.length > 0 && set.every((one) => element.classList.contains(one))) itself = true;
          }
          if (!itself) {
            for (let parent = element.parentElement; parent !== null && parent !== root.parentElement; parent = parent.parentElement) {
              for (const set of declaredClasses as string[][]) {
                if (set.length > 0 && set.every((one) => parent!.classList.contains(one))) return null;
              }
            }
          }

          // Not everything with a class is clickable from script: an `<svg>` inside a control is an
          // SVGElement and has no `click()`. Faking one with a dispatched event would measure a
          // handler rather than a gesture, so it is skipped and said so.
          if (typeof (element as { click?: unknown }).click !== "function") return "non-clickable";
          const before = root.querySelector("[aria-expanded]")?.getAttribute("aria-expanded") ?? "-";
          element.click();
          return itself ? `declared:${before}` : before;
        }, { classes: definition.classes, declaredClasses: openerClasses, id: mountId });

        if (attempt === null) continue;
        if (attempt === "non-clickable") { unclickable.push(`${kind}.${part} in ${host.name}`); continue; }
        const isDeclared = attempt.startsWith("declared:");
        const before = isDeclared ? attempt.slice("declared:".length) : attempt;
        if (isDeclared) opened += 1; else clicked += 1;
        await page.waitForTimeout(200);
        const after = await page.evaluate((id) =>
          document.querySelector(`[data-form="${id}"]`)?.querySelector("[aria-expanded]")?.getAttribute("aria-expanded") ?? "-", mountId);

        if (isDeclared) {
          // A shape built out of the platform's own control opens a list the browser draws, which no
          // attribute in the page announces. Pressing it is a real gesture with nothing to read, so
          // it is not evidence either way.
          if (before === after && variantOf(kind as never, {} as never) !== "native") {
            silent.push(`${kind} in ${host.name}: ${part} is declared to open it and pressing it left ${before}`);
          }
          continue;
        }
        if (before !== after) {
          undeclared.push(`${kind} in ${host.name}: clicking ${part} takes it from ${before} to ${after}, ` +
            `and only [${openers.join(" ")}] ${openers.length === 1 ? "is" : "are"} declared`);
        }
      }
    }
  }

  // The premise, and it can no longer be met by the parts under attack: every clickable part outside
  // a declared opener may legitimately be none, now that a kind can name the second door it has. So
  // what is shown alive is the sweep's own gesture — the declared openers pressed, and opening.
  expect(opened, "no declared opener was pressed, so this sweep never opened anything").toBeGreaterThan(8);

  expect(
    silent,
    `${silent.length} declared opener(s) did not open what they say they open:\n${silent.join("\n")}\n\n` +
      "A declaration a renderer does not honour is worse than one that is missing: a person told to " +
      "press there presses there.",
  ).toEqual([]);
  if (unclickable.length > 0) console.log(`[not clickable from script] ${unclickable.length}: ${unclickable.slice(0, 6).join(" | ")}`);

  expect(
    undeclared,
    `${undeclared.length} part(s) open a panel that no transition declares:\n${undeclared.join("\n")}\n\n` +
      "A second door works until someone removes it, and nothing here would notice. Either the " +
      "transition names it or the renderer stops offering it.",
  ).toEqual([]);
});
}
