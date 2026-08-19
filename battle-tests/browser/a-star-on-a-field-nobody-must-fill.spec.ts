/**
 * What the label says, against what the field says about itself.
 *
 * A required marker is the asterisk beside a label, and it is the only thing most people read to
 * decide whether they have to fill something in. `aria-required` is what everyone else reads. They
 * are two renderings of one fact, so a field on which they disagree tells two different people two
 * different things about the same question.
 *
 * They disagree in one of the two renderers. Plain paints `mdy-label__required` on a field carrying
 * no `required` rule at all — the label reads `Optional*` while the same element carries
 * `aria-required="false"`. Lit does not, which is what rules out the contract asking for it.
 *
 * The invariant is written as an agreement rather than as "no marker on an optional field", so any
 * repair passes: dropping the marker where nothing is required, or — if the marker were ever meant
 * to mean something else — making the field say so to everyone.
 *
 * The control is the other half of the same pair: a field that *is* required must carry both. A
 * renderer that had simply stopped drawing markers would otherwise satisfy the invariant by never
 * agreeing about anything.
 *
 * Claims under attack: A11Y-004.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

/** Kinds that carry a label, which is where the marker lives. */
const KINDS = ["text", "textarea", "email", "password", "number", "select", "datepicker", "timepicker"];

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

for (const host of HOSTS) {
  test(`${host.name}: a required marker and aria-required say the same thing`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const disagreed: Array<Record<string, unknown>> = [];
    const seenBoth = { withMarker: 0, withoutMarker: 0 };

    for (const kind of KINDS) {
      for (const [name, rule] of [["optional", undefined], ["required", { required: true }]] as Array<
        [string, Record<string, unknown> | undefined]
      >) {
        const id = `s-${kind}-${name}`;
        await page.evaluate(
          ({ api, mountId, k, validators, options }) => {
            const battle = (window as never as Record<string, { mountFields(id: string, f: unknown[]): unknown }>)[api];
            const field: Record<string, unknown> = { name: "f", kind: k, label: `L ${k}` };
            if (/select|radio|segmented/.test(k)) field.options = options;
            if (validators !== undefined) field.validators = validators;
            battle.mountFields(mountId, [field]);
          },
          { api: host.api, mountId: id, k: kind, validators: rule, options: OPTIONS },
        );
        await page.waitForTimeout(110);

        const seen = await page.evaluate((selector) => {
          const root = document.querySelector(selector);
          if (root === null) return null;
          const marker = root.querySelector(".mdy-label__required");
          // Whatever carries the fact, wherever the renderer put it.
          const carrier = root.querySelector("[aria-required]");
          return {
            marker: marker !== null,
            ariaRequired: carrier?.getAttribute("aria-required") ?? null,
            label: root.querySelector("label")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
          };
        }, `[data-form="${id}"]`);

        if (seen === null || seen.ariaRequired === null) continue;
        if (seen.marker) seenBoth.withMarker += 1; else seenBoth.withoutMarker += 1;

        if (seen.marker !== (seen.ariaRequired === "true")) {
          disagreed.push({ kind, declared: name, ...seen });
        }
      }
    }

    // The premise: fields were found and read. The invariant itself needs no further control,
    // because it has two sides — a renderer that never drew a marker would fail on every required
    // field, and one that drew a marker on everything fails on every optional one. An earlier
    // version asserted that both cases occurred, and the renderer that marks every field tripped
    // that instead of the invariant, which reported the defect as a reason not to measure.
    expect(seenBoth.withMarker + seenBoth.withoutMarker,
      JSON.stringify(seenBoth)).toBeGreaterThanOrEqual(KINDS.length);

    expect(disagreed, JSON.stringify({ seenBoth, disagreed }, null, 1)).toEqual([]);
  });
}
