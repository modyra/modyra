/**
 * The keyboard the package publishes, pressed in a page.
 *
 * `MDY_WIDGET_KEYBOARD` declares seventy-two bindings across twelve kinds: `{ key, when, intent }`,
 * where `when` is the state the widget must be in and `intent` is what the key is for — `open`,
 * `cancel`, `commit`, `move`, `step`, `toggle`.
 *
 * A battle reads that table today and checks it against the kinds' declared capabilities. Nothing
 * presses the keys. The individual specs that do press one press it at one widget.
 *
 * What is asserted here is deliberately weak in one direction and exact in the other. Weak: a
 * declared key, pressed in its declared state, must change *something* a page can observe —
 * `aria-expanded`, `aria-activedescendant`, `aria-checked`, or the control's own value. Modelling
 * what each of six intents must do precisely would be writing a second implementation, and a binding
 * that changes nothing at all is already a binding that does not work. Exact where the table is
 * unambiguous: `open` must end open and `cancel` must end closed.
 *
 * Only the bindings a *closed* widget declares are asserted on. Those are focus-independent here,
 * because a closed widget is offered the key at every part that can take focus and the binding counts
 * as answered if any part answers — so "the spec focused the wrong element" is not available as an
 * explanation. Once a widget is open the reading position is somewhere of its own choosing, inside a
 * grid or on a dialog, and a spec that moved focus to judge the key would be judging its own choice;
 * those are counted and printed instead. That distinction was earned: pressing `Enter` at the input
 * of a closed datepicker does nothing and pressing it at the toggle opens it, which read as four
 * broken bindings until every part was offered the key.
 *
 * A binding whose `when` state cannot be reached in a renderer is reported as unreached rather than
 * failed, and the counts are printed, because a sweep is worth what it reached.
 *
 * A `move` is primed before it is judged. Pressing `ArrowUp` at the first option, or `Home` when
 * already there, legitimately changes nothing, and a first pass here read six such no-ops as failures
 * — so the reading position is moved off the first option before a `move` binding is pressed, and the
 * list is three long so that first, next and last are three different places.
 *
 * Claims under attack: UI-002.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KEYBOARD } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

/** Three, so "first", "next" and "last" are three different places to be. */
const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }, { value: "c", label: "C" }];

/** Every kind that declares at least one binding, with its bindings. */
const DECLARED = Object.entries(MDY_WIDGET_KEYBOARD)
  .filter(([, list]) => Array.isArray(list) && list.length > 0) as ReadonlyArray<
    [string, ReadonlyArray<{ key: string; when: string; intent: string }>]
  >;

for (const host of HOSTS) {
  test(`${host.name}: every key a kind declares does something`, async ({ page }) => {
    // Seventy-two bindings, each mounted, primed, pressed and read. The default budget is for a
    // spec that asks one question.
    test.setTimeout(300_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const total = DECLARED.reduce((sum, [, list]) => sum + list.length, 0);
    expect(total, "the keyboard table is empty, so this sweep would press nothing").toBeGreaterThan(20);

    /** Everything about a mounted field that a key could visibly change. */
    const observe = (scope: string) => page.evaluate((selector) => {
      const root = document.querySelector(selector);
      if (root === null) return null;
      const parts = Array.from(root.querySelectorAll("*")).map((element) => [
        element.getAttribute("aria-expanded"),
        element.getAttribute("aria-activedescendant"),
        element.getAttribute("aria-checked"),
        element.getAttribute("aria-selected"),
        (element as HTMLInputElement).value ?? null,
        (element as HTMLInputElement).checked ?? null,
        element.className,
      ].join("|"));
      // Where the reading position is, which for a group of radios is the only thing a `move`
      // changes: no attribute moves, the focus does.
      const active = document.activeElement;
      const focus = active === null ? "none" : `${active.tagName}#${active.id}.${active.className}`;
      return {
        expanded: root.querySelector("[aria-expanded]")?.getAttribute("aria-expanded") ?? null,
        all: `${parts.join("//")}::focus=${focus}`,
      };
    }, scope);

    const wrong: Array<Record<string, unknown>> = [];
    const unreached: string[] = [];
    let pressed = 0;

    for (const [kind, bindings] of DECLARED) {
      const id = `k-${kind}`;
      await page.evaluate(
        ({ api, k, mountId, options }) => {
          const battle = (window as never as Record<string, { mountFields(id: string, f: unknown[]): unknown }>)[api];
          const field: Record<string, unknown> = { name: "f", kind: k, label: `L ${k}` };
          if (/select|radio|segmented/.test(k)) field.options = options;
          battle.mountFields(mountId, [field]);
        },
        { api: host.api, k: kind, mountId: id, options: OPTIONS },
      );
      await page.waitForTimeout(120);
      const scope = `[data-form="${id}"]`;

      for (const binding of bindings) {
        // Reset to closed, then reach the state the binding names.
        if ((await observe(scope))?.expanded === "true") {
          await page.keyboard.press("Escape");
          await page.waitForTimeout(80);
        }
        if (binding.when === "open") {
          const toggle = page.locator(`${scope} button`).first();
          if (await toggle.count() === 0) { unreached.push(`${kind} ${binding.key}: no control opens it`); continue; }
          await toggle.click({ timeout: 2000 }).catch(() => undefined);
          await page.waitForTimeout(120);
          if ((await observe(scope))?.expanded !== "true") {
            unreached.push(`${kind} ${binding.key}: could not open it`);
            continue;
          }
        }

        // Only a closed widget is focused by this spec. Opening one puts the reading position
        // somewhere of its own choosing — inside a grid, on a dialog — and focusing a part here
        // would take it back off again, which is how a first pass read every open-state binding as
        // doing nothing.
        // Which part owns a key is the renderer's business, not this spec's. So a closed widget is
        // offered the key at every part that can take focus, and the binding counts as answered if
        // any of them answers — that removes "the spec focused the wrong element" as an explanation
        // without this file having to know which element is right.
        const parts = binding.when === "open"
          ? [null]
          // Capped: a calendar has forty-two focusable cells and offering a key to each of them
          // measures nothing the first few do not.
          //
          // `input[type=color]` is left out, and it is the one exclusion here. Space on it opens the
          // platform's own colour dialog, which takes the keyboard away from the page — every press
          // after it lands nowhere this spec can see, so the binding reads as unanswered and so does
          // everything the sweep tries next. It is the first part of a colour field in document
          // order, which is why that field alone reported a binding the renderer answers: focusing
          // any other part of it first, the same key is answered.
          : (await page.locator(
            `${scope} [role="combobox"], ${scope} input:not([type="color"]), ${scope} button, ${scope} [tabindex]`,
          ).all()).slice(0, 4);
        if (parts.length === 0) { unreached.push(`${kind} ${binding.key}: nothing focusable`); continue; }

        let answered = false;
        let lastExpanded: string | null = null;
        for (const part of parts) {
          if (part !== null) {
            if ((await observe(scope))?.expanded === "true") {
              await page.keyboard.press("Escape");
              await page.waitForTimeout(60);
            }
            await part.focus().catch(() => undefined);
          }

          // A move needs somewhere to move from: at the first option, `ArrowUp` and `Home` are
          // no-ops that mean the binding works, not that it is missing.
          //
          // **A reorder needs the same, and for the same reason.** `Alt+ArrowLeft` on the first chip of
          // a strip moves it before itself; `ArrowLeft` there has no previous chip to reach. Both are
          // correct implementations doing nothing, and both read as a missing binding — which is what
          // this spec reported for three runs after the strip's keyboard map landed. The priming was
          // written for `move` and the new intent inherited the trap rather than the remedy.
          if (binding.intent === "move" || binding.intent === "reorder") {
            await page.keyboard.press("ArrowRight");
            await page.keyboard.press("ArrowDown");
            await page.waitForTimeout(100);
          }

          const before = await observe(scope);
          await page.keyboard.press(binding.key === " " ? "Space" : binding.key);
          await page.waitForTimeout(120);
          const after = await observe(scope);
          if (before === null || after === null) break;
          lastExpanded = after.expanded;

          const moved = before.all !== after.all;
          const rightWay = binding.intent === "open" ? after.expanded === "true"
            : binding.intent === "cancel" ? after.expanded !== "true"
            : true;
          if (moved && rightWay) { answered = true; break; }
        }
        pressed += 1;

        if (!answered) {
          wrong.push({ kind, key: binding.key, when: binding.when, intent: binding.intent, expanded: lastExpanded });
        }
      }
    }

    const closedState = wrong.filter((row) => row.when !== "open");
    const openState = wrong.filter((row) => row.when === "open");

    // Reported rather than only asserted: a sweep is worth what it reached, and the open-state
    // column is a measurement this spec does not claim to have earned an assertion on.
    console.log(`[${host.name}] declared ${total}, pressed ${pressed}, unreached ${unreached.length}`);
    console.log(`[${host.name}] unanswered: ${closedState.length} closed-state, ${openState.length} open-state`);
    if (openState.length > 0) console.log(`[${host.name}] open-state, measured not asserted: ${JSON.stringify(openState)}`);
    if (unreached.length > 0) console.log(`[${host.name}] unreached: ${JSON.stringify(unreached)}`);

    // The control: the sweep pressed a real share of the table. A run that reached almost nothing
    // would report almost nothing wrong and mean nothing by it.
    expect(pressed, JSON.stringify({ pressed, total, unreached })).toBeGreaterThan(total / 3);

    expect(closedState, JSON.stringify({ pressed, closedState }, null, 1)).toEqual([]);
  });
}
