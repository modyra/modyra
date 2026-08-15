/**
 * The state class a field is supposed to wear, and the renderer that never puts it on.
 *
 * Two published tables say what should be on the page. `MDY_FIELD_STATE_CLASSES` names the carrier
 * and its states — `control: "mdy-input-wrapper"` with `controlStates: ["disabled", "error"]`, and
 * `label: "mdy-label"` with `labelStates: ["filled", "has-error"]`. `MDY_STATE_EXPRESSION` says which
 * kinds use that mechanism: ten by class, seven structurally because their wrapper is their own.
 *
 * So for a kind the second table calls `"class"`, a field the form has refused should carry
 * `mdy-input-wrapper--error`. Plain does that on every one. Lit renders the wrapper and never adds the
 * modifier — on any kind, at all.
 *
 * The control is inside the same table: lit *does* apply `mdy-label--has-error`, so it is not a
 * renderer that ignores state classes. It applies one of the two the table declares and not the other,
 * which is also why the shipped stylesheets' two dozen `.mdy-input-wrapper--error` rules never fire
 * for a lit page.
 *
 * The second test asks the other half of the same table. `mdy-label` is shared shell — every kind that
 * has a label has the same one — and `labelStates` declares `has-error` on it. That one is uneven in
 * both renderers rather than absent in one, which is why it is a test of its own: the wrapper is a
 * mechanism a renderer either implements or does not, and the label is a class somebody remembered for
 * some kinds.
 *
 * The kinds are read from the tables rather than listed here, so a kind that changes mechanism moves
 * this spec with it.
 */

import { expect, test } from "@playwright/test";
import { MDY_FIELD_STATE_CLASSES, MDY_STATE_EXPRESSION } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

/** The kinds whose state is supposed to arrive as a modifier on the shared wrapper. */
const BY_CLASS = Object.entries(MDY_STATE_EXPRESSION)
  .filter(([, mechanism]) => mechanism === "class")
  .map(([kind]) => kind);

const WRAPPER = MDY_FIELD_STATE_CLASSES.control;
const LABEL = MDY_FIELD_STATE_CLASSES.label;
const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

for (const host of HOSTS) {
  test(`${host.name}: a refused field wears the state class its kind declares`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // The premise: the tables still say what this spec is about.
    expect(BY_CLASS.length, JSON.stringify(BY_CLASS)).toBeGreaterThan(5);
    expect(MDY_FIELD_STATE_CLASSES.controlStates, JSON.stringify(MDY_FIELD_STATE_CLASSES)).toContain("error");

    const bare: Array<Record<string, unknown>> = [];
    let labelledSomewhere = 0;

    for (const kind of BY_CLASS) {
      const id = `sc-${kind}`;
      await page.evaluate(
        ({ mountId, k, api, options }) => {
          const field: Record<string, unknown> = { name: "f", kind: k, label: "L", validators: { required: true } };
          if (/select|radio|segmented/.test(k)) field.options = options;
          (window as never as Record<string, { mountFields(id: string, f: unknown[]): unknown }>)[api]
            .mountFields(mountId, [field]);
        },
        { mountId: id, k: kind, api: host.api, options: OPTIONS },
      );
      await page.waitForTimeout(130);

      const first = page.locator(`[data-form="${id}"] input, [data-form="${id}"] select, [data-form="${id}"] button`).first();
      if (await first.count() > 0) {
        await first.focus().catch(() => {});
        await first.blur().catch(() => {});
      }
      await page.waitForTimeout(190);

      const seen = await page.evaluate(({ sel, wrapper, label }) => {
        const root = document.querySelector(sel);
        if (root === null) return null;
        return {
          refused: root.querySelectorAll('[aria-invalid="true"]').length > 0,
          hasWrapper: root.querySelector(`.${wrapper}`) !== null,
          wrapperError: root.querySelector(`.${wrapper}--error`) !== null,
          labelError: root.querySelector(`.${label}--has-error`) !== null,
        };
      }, { sel: `[data-form="${id}"]`, wrapper: WRAPPER, label: LABEL });

      if (seen === null) continue;
      if (seen.labelError) labelledSomewhere += 1;
      // A kind that was not refused, or that renders no wrapper, is not evidence either way.
      if (!seen.refused || !seen.hasWrapper) continue;
      if (!seen.wrapperError) bare.push({ kind, ...seen });
    }

    // The control: this renderer does apply a state class the same table declares, so a missing one
    // is that class rather than a renderer that carries no state at all.
    expect(labelledSomewhere, JSON.stringify({ labelledSomewhere, bare })).toBeGreaterThan(0);

    expect(bare, JSON.stringify(bare, null, 1)).toEqual([]);
  });
}

/** Every kind, because a label is shared shell and does not depend on the state mechanism. */
const EVERY_KIND = Object.keys(MDY_STATE_EXPRESSION);

for (const host of HOSTS) {
  test(`${host.name}: a refused field's label says so`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    expect(MDY_FIELD_STATE_CLASSES.labelStates, JSON.stringify(MDY_FIELD_STATE_CLASSES)).toContain("has-error");

    const silent: Array<Record<string, unknown>> = [];
    let spoke = 0;

    for (const kind of EVERY_KIND) {
      const id = `lb-${kind}`;
      await page.evaluate(
        ({ mountId, k, api, options }) => {
          const field: Record<string, unknown> = { name: "f", kind: k, label: "L", validators: { required: true } };
          if (/select|radio|segmented/.test(k)) field.options = options;
          (window as never as Record<string, { mountFields(id: string, f: unknown[]): unknown }>)[api]
            .mountFields(mountId, [field]);
        },
        { mountId: id, k: kind, api: host.api, options: OPTIONS },
      );
      await page.waitForTimeout(130);

      const first = page.locator(`[data-form="${id}"] input, [data-form="${id}"] select, [data-form="${id}"] button`).first();
      if (await first.count() > 0) {
        await first.focus().catch(() => {});
        await first.blur().catch(() => {});
      }
      await page.waitForTimeout(190);

      const seen = await page.evaluate(({ sel, label }) => {
        const root = document.querySelector(sel);
        if (root === null) return null;
        return {
          refused: root.querySelectorAll('[aria-invalid="true"]').length > 0,
          hasLabel: root.querySelector(`.${label}`) !== null,
          labelError: root.querySelector(`.${label}--has-error`) !== null,
        };
      }, { sel: `[data-form="${id}"]`, label: LABEL });

      if (seen === null) continue;
      // A kind the form did not refuse, or that renders no label, is not evidence either way.
      if (!seen.refused || !seen.hasLabel) continue;
      if (seen.labelError) spoke += 1;
      else silent.push({ kind, ...seen });
    }

    // The control: this renderer does put the class on some labels, so a label without it is that
    // kind rather than a class nothing ever carries.
    expect(spoke, JSON.stringify({ spoke, silent })).toBeGreaterThan(2);

    expect(silent, JSON.stringify(silent, null, 1)).toEqual([]);
  });
}
