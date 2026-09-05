/**
 * The properties a document puts on a field, and whether the control wears them.
 *
 * `$defs.field` in the published schema carries more than a name and a kind: `ariaLabel`,
 * `placeholder`, `min`, `max` and `step` are the field's own, separate from `validators`. Each is a
 * promise about the control a person meets, and none of them had a page-level check.
 *
 * The last one is the interesting pair. A bound spelled as a field property becomes a native
 * attribute *and* a rule the model enforces — finding 46 was the two disagreeing — so a value below
 * the floor has to be refused by both the browser and the form, in the same breath. An attribute the
 * model does not back is the shape of finding 99; this is the case where they agree, and it is worth
 * holding.
 *
 * Claims under attack: VAL-004, DYN-004.
 */

import { expect, test } from "@playwright/test";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
import { HOSTS } from "./bench";

/** What the document declares, and the attribute each declaration should become. */
const DECLARED: Array<[string, Record<string, unknown>, Record<string, string>]> = [
  ["a placeholder", { kind: "text", placeholder: "type here" }, { placeholder: "type here" }],
  ["a spoken name", { kind: "text", ariaLabel: "spoken name" }, { "aria-label": "spoken name" }],
  ["a number's bounds", { kind: "number", min: 3, max: 9 }, { min: "3", max: "9" }],
  ["a number's step", { kind: "number", step: 0.5 }, { step: "0.5" }],
  ["a slider's bounds and step", { kind: "slider", min: 2, max: 8, step: 2 }, { min: "2", max: "8", step: "2" }],
];

for (const host of HOSTS) {
  test(`${host.name}: a control wears what its field declared`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    for (const [what, field, expected] of DECLARED) {
      const id = `declares-${what.replace(/\W+/g, "")}`;
      await page.evaluate(
        ({ mountId, given, api }) => {
          (window as never as Record<string, { mountFields(id: string, f: unknown[], o?: unknown): unknown }>)[api]
            .mountFields(mountId, [{ name: "f", label: "L", ...given }]);
        },
        { mountId: id, given: field, api: host.api },
      );
      await page.waitForTimeout(170);

      const worn = await page.evaluate(
        ({ selector, wanted }) => {
          const control = document.querySelector(`${selector} input, ${selector} textarea`);
          if (control === null) return null;
          const out: Record<string, string | null> = {};
          for (const attribute of Object.keys(wanted)) out[attribute] = control.getAttribute(attribute);
          return out;
        },
        { selector: `[data-form="${id}"]`, wanted: expected },
      );
      expect(worn, `${what}: ${JSON.stringify(worn)}`).toEqual(expected);

      await page.evaluate(
        ({ mountId, api }) => (window as never as Record<string, { dispose?: (id: string) => void }>)[api].dispose?.(mountId),
        { mountId: id, api: host.api },
      );
      await page.waitForTimeout(100);
    }
  });

  test(`${host.name}: a bound the field declared binds the browser and the form alike`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const id = "bound";
    await page.evaluate(
      ({ mountId, api }) => {
        (window as never as Record<string, { mountFields(id: string, f: unknown[], o?: unknown): unknown }>)[api]
          .mountFields(mountId, [{ name: "f", kind: "number", label: "L", min: 3, max: 9 }]);
      },
      { mountId: id, api: host.api },
    );
    await page.waitForTimeout(180);

    const input = page.locator(`[data-form="${id}"] input`).first();

    // The control: a value inside the bounds is accepted by both.
    await input.fill("5");
    await input.blur();
    await page.waitForTimeout(220);
    const inside = await page.evaluate(({ selector, mountId, api }) => {
      const control = document.querySelector(`${selector} input`) as HTMLInputElement | null;
      return {
        value: (window as never as Record<string, { valueOf(id: string): Record<string, unknown> }>)[api].valueOf(mountId),
        ariaInvalid: control?.getAttribute("aria-invalid") ?? null,
        browserRefuses: control?.validity.rangeUnderflow ?? null,
      };
    }, { selector: `[data-form="${id}"]`, mountId: id, api: host.api });
    expect(inside, JSON.stringify(inside)).toEqual({ value: { f: 5 }, ariaInvalid: "false", browserRefuses: false });

    // And below the floor, both say so — the attribute and the rule are one bound, not two.
    await input.fill("1");
    await input.blur();
    await page.waitForTimeout(240);
    const below = await page.evaluate(({ selector, mountId, api }) => {
      const control = document.querySelector(`${selector} input`) as HTMLInputElement | null;
      return {
        value: (window as never as Record<string, { valueOf(id: string): Record<string, unknown> }>)[api].valueOf(mountId),
        ariaInvalid: control?.getAttribute("aria-invalid") ?? null,
        browserRefuses: control?.validity.rangeUnderflow ?? null,
      };
    }, { selector: `[data-form="${id}"]`, mountId: id, api: host.api });
    expect(below, JSON.stringify(below)).toEqual({ value: { f: 1 }, ariaInvalid: "true", browserRefuses: true });
  });
}

/**
 * The kinds whose control a caption can name natively, derived rather than listed.
 *
 * A kind qualifies when its structure declares a `control` node drawn as an `input` or a `textarea`.
 * The list this replaced was a single row testing `kind: "text"`, and one kind stood for the class:
 * four naming defects lived behind it — two in Plain, one in Lit, and a divergence still open —
 * because nothing asked the other eleven.
 */
const NAMEABLE = Object.entries(MDY_WIDGET_CONTRACTS as never as Record<string, {
  structure?: { nodes: readonly { part: string; element?: string }[] };
}>)
  .filter(([, contract]) => {
    const control = (contract.structure?.nodes ?? []).find((node) => node.part === "control");
    return control !== undefined && (control.element === "input" || control.element === "textarea");
  })
  .map(([kind]) => kind);

/**
 * Kinds left out of the assertion below, each because a measurement says so — never because the
 * assertion was inconvenient. An exemption without its reason reads as a verification already made.
 */
const NOT_ASSERTED: Record<string, string> = {
  datepicker: "measured `L` in all four renderers: the name belongs to the field-and-calendar pair "
    + "rather than to the input, and a uniform answer across four is a position, not a defect",
  timepicker: "measured 2-2 — Plain and Vue answer `L`, Lit and Angular answer the declared name. "
    + "**Not established**, and deliberately not asserted in either direction while it is undecided: "
    + "a row that picked a side would manufacture a red for a question nobody has answered",
  file: "its control is a button standing for a drop zone, so what a caption points at is not the "
    + "element a person operates. Named correctly today; asked here it would compare two different "
    + "things",
  colors: "the caption points at the hex box while the contract's `control` is a hidden native "
    + "picker. Named correctly today, and the pair is the reason the source below is `label[for]`",
};

for (const host of HOSTS) {
  test(`${host.name}: a control a person meets is called what the document declared`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // The roster is derived, so a kind that gains a control joins this on the day it lands. It may
    // not join silently: an unlisted newcomer fails here rather than being skipped, because a set
    // that quietly absorbs new members is how one kind came to stand for twelve.
    const asserted = NAMEABLE.filter((kind) => !(kind in NOT_ASSERTED));
    expect(
      NAMEABLE.filter((kind) => !(kind in NOT_ASSERTED) && !asserted.includes(kind)),
      "a kind gained a natively nameable control and nobody decided whether its declared name should "
        + "reach it; add it above or give it a reason",
    ).toEqual([]);

    for (const kind of asserted) {
      const id = `named-${kind}`;
      await page.evaluate(
        ({ mountId, api, kind }) => {
          (window as never as Record<string, { mountFields(id: string, f: unknown[], o?: unknown): unknown }>)[api]
            .mountFields(mountId, [{ name: "f", kind, label: "L", ariaLabel: "spoken name" }]);
        },
        { mountId: id, api: host.api, kind },
      );
      await page.waitForTimeout(200);

      // **The element the caption points at, and the name the tree computes for it.** Both halves
      // are deliberate. A declared name that lands on a container carrying no role is a name nobody
      // hears, and an assertion reading the `aria-label` attribute passes on exactly that defect —
      // which is how one of the four survived. And the source is `label[for]` rather than the
      // contract's `control`, because for one kind the declared control is a hidden input while the
      // caption points at the box a person types in. That is true *for the question of the name*;
      // roles, states and native bounds still live on the declared control, and asking those here
      // would be carrying this source into a question it does not answer.
      const spoken = await page.evaluate(({ selector }) => {
        const root = document.querySelector(selector);
        const caption = root?.querySelector("label[for]") as HTMLLabelElement | null;
        if (caption === null || caption === undefined) return { how: "no caption points anywhere" };
        const named = root!.ownerDocument.getElementById(caption.htmlFor);
        if (named === null) return { how: `the caption points at "${caption.htmlFor}", which is not on the page` };
        return { how: "ok", tag: named.tagName.toLowerCase() };
      }, { selector: `[data-form="${id}"]` });
      expect(spoken.how, `${kind}: ${spoken.how}, so no name could be read and this kind proved nothing`).toBe("ok");

      const caption = page.locator(`[data-form="${id}"] label[for]`).first();
      const target = page.locator(`[id="${await caption.getAttribute("for")}"]`).first();
      const snapshot = (await target.ariaSnapshot()).trim().split("\n")[0];
      expect(
        snapshot,
        `${kind}: the document declared the name "spoken name" and the control a person meets is `
          + `announced as ${JSON.stringify(snapshot)}. A field that carries some other name is not a `
          + `field without one — a check asking "is it named" answers yes, which is why this asks `
          + `which name.`,
      ).toContain('"spoken name"');

      await page.evaluate(
        ({ mountId, api }) => (window as never as Record<string, { dispose?: (id: string) => void }>)[api].dispose?.(mountId),
        { mountId: id, api: host.api },
      );
      await page.waitForTimeout(80);
    }
  });
}
