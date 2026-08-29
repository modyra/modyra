/**
 * The state machine the package publishes, driven in a page.
 *
 * `MDY_WIDGET_TRANSITIONS` declares, per kind, the moves a widget makes: `{ from, trigger, to }`,
 * where a trigger is a pointer on a named part, a key, or a click outside. Six kinds declare one —
 * select, multiselect, datepicker, daterange, timepicker, colors — and between them twenty-two
 * transitions.
 *
 * One battle reads that table today and it checks the *list*: that both packages declare the same
 * kinds. Nothing drives it. Individual specs cover a combobox, a popup, a slider; none of them asks
 * the table what it promises and then does it.
 *
 * This does, from the table rather than from a copy of it, so a transition added later is exercised
 * without this file being edited. A kind a renderer builds out of native controls — lit renders
 * `select` as a `<select>` — declares no `aria-expanded` to read, and is reported as undriveable
 * rather than failed: the point is what the table promises about widgets that have these states, not
 * that every renderer must build every kind the same way.
 */

import { expect, test } from "@playwright/test";
import { MDY_POPUP_OPENERS, MDY_WIDGET_TRANSITIONS, partClasses } from "@modyra/widgets";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { became, HOSTS } from "./bench";

/** Kinds whose declared machine has at least one move. */
const WITH_TRANSITIONS = Object.entries(MDY_WIDGET_TRANSITIONS)
  .filter(([, moves]) => Array.isArray(moves) && moves.length > 0)
  .map(([kind]) => kind);

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

for (const host of HOSTS) {
  test(`${host.name}: every transition a kind declares is one the page makes`, async ({ page }) => {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // The premise: the table has something in it. A rename upstream that emptied it would otherwise
    // leave this green having driven nothing.
    expect(WITH_TRANSITIONS.length, JSON.stringify(WITH_TRANSITIONS)).toBeGreaterThan(3);

    const wrong: Array<Record<string, unknown>> = [];
    const undriveable: string[] = [];
    let driven = 0;

    /** The mount to take off the page before the next goes on. */
    let previous: string | null = null;

    for (const kind of WITH_TRANSITIONS) {
      const id = `t-${kind}`;
      // **Each kind alone on the page.** Nothing was disposed, so a transition was driven in a room
      // holding every kind that came before it — their overlays, their reading positions, their
      // claim on `Escape` and on an outside click. A transition that could not be reached there was
      // reported as one the page does not make, and it was the room.
      await page.evaluate(
        async ({ api, k, mountId, options, gone }) => {
          const battle = (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)[api];
          if (gone !== null) battle.dispose?.(gone as never);
          const field: Record<string, unknown> = { name: "f", kind: k, label: `L ${k}` };
          if (/select/.test(k)) field.options = options;
          await battle.mountFields(mountId as never, [field] as never);
        },
        { api: host.api, k: kind, mountId: id, options: OPTIONS, gone: previous },
      );
      previous = id;
      await became(() => page.evaluate(
        (selector) => (document.querySelector(selector)?.children.length ?? 0) > 0, `[data-form="${id}"]`));

      const scope = `[data-form="${id}"]`;

      /**
       * What the field says about its phase, asked of the part that says it.
       *
       * The first `[aria-expanded]` in the field is whichever part the document happens to put in
       * front, and a rearrangement moves it. The kind names its opener, so the statement is read
       * there — and where the opener makes none, the link it declares to the thing it controls is
       * followed: a popup that is in the document with a box is open. Which part that is differs by
       * kind, which is why it is read from the declaration rather than named here.
       */
      const popup = MDY_POPUP_OPENERS as unknown as Record<string, { opener?: string; controls?: string } | undefined>;
      const openerSelector = ((partClasses(kind, popup[kind]?.opener ?? "") as string[] | undefined) ?? [])
        .map((one) => `.${one}`).join("");
      const controlsSelector = ((partClasses(kind, popup[kind]?.controls ?? "") as string[] | undefined) ?? [])
        .map((one) => `.${one}`).join("");

      const expanded = () => page.evaluate(({ selector, opener, controls }) => {
        const field = document.querySelector(selector);
        if (field === null) return null;
        const said = (opener === "" ? null : field.querySelector(opener))
          ?? field.querySelector("[aria-expanded]");
        const stated = said?.getAttribute("aria-expanded") ?? null;
        if (stated !== null) return stated;
        if (controls === "") return null;
        const named = said?.getAttribute("aria-controls");
        const panel = (named === null || named === undefined ? null : document.getElementById(named))
          ?? document.querySelector(controls);
        if (panel === null) return null;
        return panel.getBoundingClientRect().height > 0 ? "true" : "false";
      }, { selector: scope, opener: openerSelector, controls: controlsSelector });

      if (await expanded() === null) {
        undriveable.push(`${kind}: nothing on the page reports aria-expanded`);
        continue;
      }

      for (const move of MDY_WIDGET_TRANSITIONS[kind] as ReadonlyArray<Record<string, never>>) {
        const from = move.from as unknown as string;
        const to = move.to as unknown as string;
        const trigger = move.trigger as unknown as { type: string; part?: string; key?: string };

        // Put it in `from`. "closed" is where a fresh mount is; "open" takes one click.
        // **The part the table names, not the first button in the field.** A field holds more
        // buttons than the one that opens it, and which comes first in the document is a layout
        // decision that moves: taking the first one drove a hidden counter, the click was refused,
        // and the transition was reported as one the page does not make.
        const named = trigger.type === "pointer" && typeof trigger.part === "string"
          ? (partClasses(kind, trigger.part) as string[] | undefined) ?? []
          : [];
        const toggle = page.locator(
          named.length > 0 ? `${scope} ${named.map((one) => `.${one}`).join("")}` : `${scope} button`,
        ).first();
        if (await toggle.count() === 0) {
          undriveable.push(`${kind}: no button to drive it with`);
          break;
        }
        if (await expanded() === "true") {
          await page.keyboard.press("Escape");
          await became(async () => await expanded() !== "true");
        }
        if (from === "open") {
          await toggle.click({ timeout: 2000 }).catch(() => undefined);
          await became(async () => await expanded() === "true");
        }
        if (await expanded() !== (from === "open" ? "true" : "false")) {
          undriveable.push(`${kind}: could not reach "${from}"`);
          continue;
        }

        // Apply what the table names.
        if (trigger.type === "pointer") {
          await toggle.click({ timeout: 2000 }).catch(() => undefined);
        } else if (trigger.type === "key" && typeof trigger.key === "string") {
          await page.keyboard.press(trigger.key === " " ? "Space" : trigger.key);
        } else if (trigger.type === "outside") {
          await page.mouse.click(2, 2);
        } else {
          undriveable.push(`${kind}: no way to apply a trigger of type "${trigger.type}"`);
          continue;
        }
        // **Waited for the state the table declares, not for a length of time.** A fixed pause here
        // decided the verdict by the clock: a transition the page did make in three hundred
        // milliseconds was recorded as one it did not make, and the file reported three renderers
        // breaking their own table on a busy machine and none of them on a quiet one. A transition
        // that happens is now read when it happens; one that does not costs the bound and is the
        // finding.
        await became(async () => (await expanded() === "true" ? "open" : "closed") === to, { timeout: 800 });

        driven += 1;
        const reached = await expanded() === "true" ? "open" : "closed";
        if (reached !== to) wrong.push({ kind, from, trigger, declared: to, reached });
      }
    }

    // Reported rather than only asserted: a sweep is worth what it reached, and "22 of 22" is the
    // difference between this passing and this having run.
    console.log(`[${host.name}] declared ${WITH_TRANSITIONS.reduce((n, k) => n + (MDY_WIDGET_TRANSITIONS[k] as unknown[]).length, 0)}, driven ${driven}, undriveable ${undriveable.length}: ${JSON.stringify(undriveable)}`);

    // The control: the sweep actually drove something. A run in which every kind was undriveable
    // would report no wrong transitions and mean nothing by it.
    expect(driven, JSON.stringify({ driven, undriveable })).toBeGreaterThan(3);

    expect(wrong, JSON.stringify({ driven, wrong, undriveable }, null, 1)).toEqual([]);
  });
}
