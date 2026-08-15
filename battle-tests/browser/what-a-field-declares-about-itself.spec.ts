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
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

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
