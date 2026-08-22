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
import { MDY_WIDGET_CONTRACTS as CONTRACTS, MDY_WIDGET_KEYBOARD } from "@modyra/widgets";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

/** Three, so "first", "next" and "last" are three different places to be. */
const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }, { value: "c", label: "C" }];

/** Every kind that declares at least one binding, with its bindings. */
const DECLARED = Object.entries(MDY_WIDGET_KEYBOARD)
  .filter(([, list]) => Array.isArray(list) && list.length > 0) as ReadonlyArray<
    [string, ReadonlyArray<{ key: string; when: string; intent: string }>]
  >;

/**
 * The selector for a part, from the classes the catalogue says it carries.
 *
 * **All of them, on one element.** A part's classes are what it wears together, not a list of
 * alternatives: `chip` is `mdy-chip` *and* `mdy-chip--value`, and `mdy-chip` alone is also worn by
 * every option inside the popup, which is a different part of a different anatomy. Joined with a
 * comma this matched both, the four-element cap took popup options, and the keys declared on a chip
 * were offered to something that is not one. Four bindings read as dead for several runs.
 */
const partSelector = (scope: string, classes: readonly string[]) =>
  classes.length === 0 ? null : `${scope} .${classes.join(".")}`;

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
        // The roving index. A composite that moves the reading position between identical siblings
        // moves this and nothing else — no attribute below changes, and the focused element's
        // tag, id and classes are the same before and after because the siblings are the same. Four
        // chip keys read as dead for three runs against an observation that could not see them move.
        element.getAttribute("tabindex"),
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
      /**
       * A fresh control for every binding.
       *
       * One mount served all seventy-five, and the state leaked: a key pressed earlier chose an
       * option, so by the time the chip keys were judged the strip held a chip the document never
       * declared — on one renderer and not the other, because the two answer different keys. Four
       * bindings were reported as answering nothing when what differed was which control they had
       * been offered to.
       *
       * The remount costs a tenth of a second each and buys the property this spec is named for:
       * every key is offered to a control **a document declared**, not to whatever the last key
       * left behind.
       */
      const mount = async (mountId: string) => await page.evaluate(
        ({ api, k, mountId: at, options }) => {
          const battle = (window as never as Record<string, { mountFields(id: string, f: unknown[]): unknown }>)[api];
          const field: Record<string, unknown> = { name: "f", kind: k, label: `L ${k}` };
          if (/select|radio|segmented/.test(k)) field.options = options;
          // **A kind is mounted the way a document declares it, and nothing more.** Giving a widget
          // the state its keys happen to need is the one change that must not be made here: this spec
          // asks what a control a consumer wrote actually answers, and a fixture that quietly opts
          // into `reorderable` and pre-fills a value is answering a different question — a friendlier
          // one, which the control passes.
          //
          // It was made, and it turned four reds into two by hiding finding 378 rather than by fixing
          // anything: the table declares those keys unconditionally and a default control answers
          // none of them, which is the finding and not the fixture's to paper over.
          battle.mountFields(at, [field]);
        },
        { api: host.api, k: kind, mountId, options: OPTIONS },
      );

      let at = 0;
      for (const binding of bindings) {
        const id = `k-${kind}-${(at += 1)}`;
        await mount(id);
        await page.waitForTimeout(120);
        const scope = `[data-form="${id}"]`;
        // **A key the field never asked for is not a key that does nothing.**
        // `requires` names a field-level capability a binding depends on — `reorderable` is opt-in and
        // off by default — and a control mounted the way a document declares it has not asked for it.
        // Such a key is counted as unreached rather than unanswered: this spec measures whether a
        // declared key works, and a capability nobody requested is a different question, which
        // `a-key-that-needs-permission-first.battle.test.mjs` asks of the table directly.
        //
        // Before the table could say this, four multiselect keys read as dead here for three runs.
        if (binding.requires !== undefined && binding.requires !== null) {
          unreached.push(`${kind} ${binding.key}: needs \`${binding.requires}\`, which this field did not declare`);
          continue;
        }

        // **A key belongs to a part, and the part may not be on the page.**
        // `on` names the part that answers a key. Unlike `when` and `requires`, whose conditions are
        // invisible in the DOM, this one is recoverable by looking: a multiselect with nothing chosen
        // renders no chip, so `ArrowLeft` on a chip has nothing to be pressed at.
        //
        // That is **unreached**, not unanswered — the same bucket as a `when` state a renderer cannot
        // get to, which this spec already keeps and already prints. It is not that the key does
        // nothing; it is that the fixture never built the thing the key belongs to.
        //
        // I argued for a third word in the table to say this and was wrong: a third word would have
        // the contract restate what the rendered widget already says, and the rule the table needs is
        // exactly the one it cannot recover by looking.
        const partClasses = binding.on === undefined || binding.on === null
          ? []
          : ((CONTRACTS[kind]?.parts?.[binding.on]?.classes ?? []) as string[]);
        if (binding.on !== undefined && binding.on !== null) {
          const classes = partClasses;
          const selector = partSelector(scope, classes);
          const drawn = selector === null ? 0 : await page.locator(selector).count();
          if (drawn === 0) {
            unreached.push(`${kind} ${binding.key}: answered on \`${binding.on}\`, which this control drew none of`);
            continue;
          }
        }

        // **A popup the browser owns is one this page cannot see open.**
        // Where a kind is rendered as a native `<select>`, the list is drawn by the platform
        // outside the document: no `aria-expanded` moves, no element appears, and every key that
        // opens it reads here as a key that did nothing. That is an unreachable observation, not an
        // unanswered binding — the same bucket as a state a renderer cannot be driven into.
        //
        // Two renderers draw a native control here and one builds a combobox, which is itself worth
        // knowing and is reported separately. What must not happen is a native control being
        // recorded as keyboard-dead because the platform owns its list.
        if (binding.intent === "open" && await page.locator(`${scope} select`).count() > 0) {
          unreached.push(`${kind} ${binding.key}: opens a list the browser draws outside the document`);
          continue;
        }

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
          // The part the binding **names** is tried before anything else, and the cap is applied
          // after it rather than to it. Capping a document-order sweep at four never reached a chip
          // in a renderer that draws its chips late, so four keys declared on `chip` read as dead
          // in one renderer and alive in another — a difference in element order, reported as a
          // difference in keyboard support.
          : [
            ...(partSelector(scope, partClasses) === null
              ? []
              : await page.locator(partSelector(scope, partClasses) as string).all()),
            ...(await page.locator(
              `${scope} [role="combobox"], ${scope} input:not([type="color"]), ${scope} button, ${scope} [tabindex]`,
            ).all()),
          ].slice(0, 4);
        if (parts.length === 0) { unreached.push(`${kind} ${binding.key}: nothing focusable`); continue; }

        let answered = false;
        let lastExpanded: string | null = null;
        /** The key holding a chip, while one is held. Released before the next binding is judged. */
        let grabbed: string | null = null;
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
          // **The priming key must not be one that changes the state the binding declares.**
          // `ArrowDown` opens a closed multiselect, so every chip binding declared for the closed
          // state was primed into the open one, offered its key there, and correctly did not answer
          // — the spec reported a keyboard hole that did not exist. A closed control is primed
          // along its own axis instead, and whichever key is used, the state is checked afterwards
          // and restored before anything is judged.
          // **A step at the end of its range is a no-op that means the binding works.**
          // A slider mounted the way a document declares it starts at its minimum, so `ArrowDown`
          // there changes nothing — and the value it did not change is indistinguishable, to this
          // observation, from a key nothing is listening for. The sibling that steps the other way
          // is pressed first, read from the table rather than named here, so the value is somewhere
          // a step in either direction can be seen.
          if (binding.intent === "step") {
            const opposite = bindings.find((each) =>
              each.intent === "step" && each.on === binding.on && each.when === binding.when
              && each.key !== binding.key);
            if (opposite !== undefined) {
              await page.keyboard.press(opposite.key === " " ? "Space" : opposite.key);
              await page.waitForTimeout(100);
            }
          }

          if (binding.intent === "move") {
            const stateBefore = (await observe(scope))?.expanded;
            await page.keyboard.press(binding.when === "open" ? "ArrowDown" : "ArrowRight");
            await page.waitForTimeout(100);
            if ((await observe(scope))?.expanded !== stateBefore) {
              await page.keyboard.press("Escape");
              await page.waitForTimeout(80);
            }
            if ((await observe(scope))?.expanded !== stateBefore) continue;

            // **A move may be moded, and the table says so.** Where the same part declares a `grab`,
            // moving is something a person does *after* picking the thing up: the arrows walk
            // between chips until one is grabbed, and only then do they carry it. Pressing them
            // outside the mode changes the reading position and nothing else, which this spec
            // observes as the value not moving — four keys reported dead that
            // `two-doors-to-one-order` proves work.
            //
            // Read from the table rather than named here: whichever key grabs on this part is
            // pressed first, and released after.
            //
            // Only a grab this field can actually perform. The grab is gated on a capability the
            // fixture never declares, and its key is `Enter` — which on a closed control **opens**
            // it. Pressing it to "enter the mode" therefore opened the popup and judged the move in
            // the wrong state, which is the same mistake as the `ArrowDown` priming this file
            // already carries a warning about.
            grabbed = bindings.find((each) =>
              each.intent === "grab" && each.on === binding.on && each.when === binding.when
              && (each.requires === undefined || each.requires === null))?.key ?? null;
            if (grabbed !== null) {
              await page.keyboard.press(grabbed);
              await page.waitForTimeout(100);
            }
          }

          const before = await observe(scope);
          await page.keyboard.press(binding.key === " " ? "Space" : binding.key);
          await page.waitForTimeout(120);
          const after = await observe(scope);
          // Put the chip back down before the next binding is judged, or the mode leaks into it.
          if (grabbed !== null) {
            await page.keyboard.press(grabbed);
            await page.waitForTimeout(80);
            grabbed = null;
          }
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
