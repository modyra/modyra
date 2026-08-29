/**
 * Whether a state a person has to know about can be seen.
 *
 * A field that cannot be typed into is a different thing from one that can, and the difference has
 * consequences: a person who cannot tell them apart tries, gets nothing, and has no way to learn why.
 * `a-field-that-cannot-be-edited` already holds the two halves that are not about looking — the value
 * does not move, and the control says `aria-readonly` — so a screen reader is told.
 *
 * **Nothing held the third half.** A state announced and not painted reaches everyone who listens and
 * nobody who looks, which is the larger group.
 *
 * The check is a property and not a palette: the two renderings must differ, not what either should
 * be. A theme is free to say it with a colour, a border, a cursor or a texture, and a theme that says
 * it with nothing fails wherever it is used.
 *
 * **Every element under the field is read, not the two that seemed likely.** A first version compared
 * the wrapper and the root and reported thirty-two collisions where there are ten: it was measuring
 * its own reach. What a person sees is the whole control, so the whole control is what is compared.
 *
 * `disabled` is the control. It is a state of the same family, set through the same door, and it is
 * painted everywhere — so a reading that found no difference anywhere would be the instrument rather
 * than the renderers, and this file would say so instead of reporting a defect.
 *
 * Claims under attack: A11Y-002, UI-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

import { HOSTS, became, madeToSpeak } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
type State = "plain" | "readonly" | "disabled" | "untouched" | "refused";

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

/** Everything a person could see about the field, as the browser resolves it. */
const LOOK = `(element) => {
  const style = getComputedStyle(element);
  return [element.tagName, style.backgroundColor, style.borderColor, style.color, style.opacity,
    style.borderWidth, style.borderStyle, style.textDecorationLine, style.cursor, style.filter].join("|");
}`;

for (const host of HOSTS) {
  test(`a state a person must know about is one they can see, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const lookOf = async (id: string, kind: string, state: State) => {
      // The two refusal states carry the rule that makes a refusal possible, both of them, so that
      // the only difference between the pair is the turn the field was given — not the rule.
      const ruled = state === "refused" || state === "untouched";
      await page.evaluate(({ api, mountId, k, options, ruled }) => {
        const field: Record<string, unknown> = { name: "f", kind: k, label: "L" };
        if (/select|radio|segmented/.test(k)) field.options = options;
        if (ruled) field.validators = { required: true };
        (window as never as Api)[api].mountFields(mountId as never, [field] as never);
      }, { api: host.api, mountId: id, k: kind, options: OPTIONS, ruled });
      await became(() => page.evaluate((sel) => (document.querySelector(sel)?.children.length ?? 0) > 0, `[data-form="${id}"]`));

      if (state === "refused") {
        // A turn, the way a person gives one: reached and then left. A form that refuses on being
        // left has been given what it waits for, and one that refuses at once has lost nothing.
        // An act on the value, not a visit: a field only looked at has nothing to report.
        await madeToSpeak(page, `[data-form="${id}"]`, host.api);
        // The refusal has to have arrived before the paint is read, or a renderer that says it late
        // reads as one that never says it.
        await became(() => page.evaluate(
          (sel) => document.querySelector(`${sel} [aria-invalid="true"]`) !== null, `[data-form="${id}"]`))
          .catch(() => undefined);
      }

      if (state === "readonly" || state === "disabled") {
        // The door each state is set through, named as the host publishes it: one is a verb and the
        // other is an adjective, and assuming they matched cost this file its first run.
        const door = state === "disabled" ? "disable" : "readonly";
        await page.evaluate(({ api, mountId, which }) =>
          (window as never as Api)[api][which](mountId as never, "f" as never), { api: host.api, mountId: id, which: door });
        // The state has to have reached the control before the paint is read: a reading taken while
        // it is still arriving reports a renderer that says nothing as one that says it late.
        await became(() => page.evaluate(
          (sel) => document.querySelector(`${sel} [aria-readonly="true"], ${sel} [aria-disabled="true"], ${sel} :disabled, ${sel} [readonly]`) !== null,
          `[data-form="${id}"]`));
      }

      return page.evaluate(({ sel, look }) => {
        const root = document.querySelector(sel);
        if (root === null) return null;
        const read = new Function(`return ${look}`)() as (element: Element) => string;
        return Array.from(root.querySelectorAll("*")).map(read).join("\n");
      }, { sel: `[data-form="${id}"]`, look: LOOK });
    };

    const unseen: string[] = [];
    const seen: string[] = [];
    let compared = 0;

    /** Kinds whose refusal never arrived, so their pair says nothing either way. */
    const neverRefused: string[] = [];

    for (const kind of MDY_WIDGET_KINDS) {
      const plain = await lookOf(`ro-${kind}-p`, kind, "plain");
      if (plain === null) continue;
      for (const state of ["readonly", "disabled"] as const) {
        const other = await lookOf(`ro-${kind}-${state}`, kind, state);
        if (other === null) continue;
        compared += 1;
        if (other === plain) unseen.push(`${kind}: ${state}`);
        else seen.push(`${kind}: ${state}`);
      }

      // The refusal, against the same field under the same rule before it was given a turn.
      const untouched = await lookOf(`ro-${kind}-u`, kind, "untouched");
      const refused = await lookOf(`ro-${kind}-x`, kind, "refused");
      if (untouched === null || refused === null) continue;
      const arrived = await page.evaluate(
        (sel) => document.querySelector(`${sel} [aria-invalid="true"]`) !== null, `[data-form="ro-${kind}-x"]`);
      // A field the form never refused has nothing to show, and reporting it as showing nothing
      // would be a finding about this file rather than about the renderer.
      if (!arrived) { neverRefused.push(kind); continue; }
      compared += 1;
      if (refused === untouched) unseen.push(`${kind}: refused`);
      else seen.push(`${kind}: refused`);
    }

    // The premise: a run that compared nothing would report no invisible state and mean nothing by it.
    expect(compared, `${host.name} mounted nothing this file could compare`).toBeGreaterThan(20);

    // A run where the form refused almost nothing is measuring the rule rather than the paint.
    expect(
      neverRefused.length,
      `${host.name}: the form refused none of ${JSON.stringify(neverRefused)} under a required rule, `
      + "so their refusal was never compared. A kind that cannot be made to look wrong here is one "
      + "this file did not ask about",
    ).toBeLessThan(MDY_WIDGET_KINDS.length - 4);

    // The control: states of this family *are* painted here, so a silence below is that state rather
    // than an instrument that cannot see a difference at all.
    expect(
      seen.filter((one) => one.endsWith("disabled")).length,
      `${host.name} paints no state of any kind differently, so nothing below is a finding: ${JSON.stringify(unseen)}`,
    ).toBeGreaterThan(5);

    expect(
      unseen,
      `${host.name}: ${unseen.length} state(s) reach the page and change nothing a person can see — `
      + `${JSON.stringify(unseen)}. The control announces itself to a reader and looks exactly like one `
      + "that can be used, so a person who can see it tries, gets nothing, and is told nothing.",
    ).toEqual([]);
  });
}
