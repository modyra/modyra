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
 * The third asks about the other label state. `filled` is what lifts a floating label clear of the
 * text under it, so a field with nothing in it should not be wearing it — the label sits in the
 * "there is content here" position with nothing beneath it, and the field reads as one somebody has
 * already answered. Two justifications are real and are allowed for: a control showing a placeholder
 * needs the label lifted whatever its value, and a control that always holds a number (a range) is
 * never empty.
 *
 * The fourth is the last thing the table declares: `rendererOpen: "mdy-renderer--open"`, the class a
 * field wears while its popup is up. Here the divergence runs the other way — lit puts it on every
 * kind it opens and plain on one of six — which is worth saying plainly: neither renderer is simply
 * the careless one. Each implements a different part of the same table.
 *
 * The kinds are read from the tables rather than listed here, so a kind that changes mechanism moves
 * this spec with it.
 *
 * Claims under attack: UI-009.
 */

import { expect, test } from "@playwright/test";
import { MDY_FIELD_STATE_CLASSES, MDY_STATE_EXPRESSION, MDY_WIDGET_TRANSITIONS } from "@modyra/widgets";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS, became, madeToSpeak, stops } from "./bench";

/** The kinds whose state is supposed to arrive as a modifier on the shared wrapper. */
const BY_CLASS = Object.entries(MDY_STATE_EXPRESSION)
  .filter(([, mechanism]) => mechanism === "class")
  .map(([kind]) => kind);

const WRAPPER = MDY_FIELD_STATE_CLASSES.control;
const LABEL = MDY_FIELD_STATE_CLASSES.label;
const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

/** The tags a person can focus and then leave, which is what "the field was left" means here. */
const FOCUSABLE = ["input", "textarea", "select", "button"];

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

      // A `<textarea>` is not an input, a select or a button, and leaving it out meant the premise
      // never touched a textarea field at all — so the kind reported as bare was a kind this spec had
      // not reached. What is being asked here is "the field was left", and the tags that can be left
      // are all four.
      //
      // Waited for rather than counted once: the control has to have been drawn before it can be
      // left. But the wait is bounded and its failure is ordinary — several kinds render nothing a
      // person can focus, and letting the locator's own timeout discover that costs a second each.
      // An act on the value, not a visit: a field only looked at has nothing to report.
      await madeToSpeak(page, `[data-form="${id}"]`, host.api);

      // The refusal is the premise of everything below: a kind this form did not refuse is skipped,
      // so waiting for it costs nothing on a kind that is about to be skipped anyway.
      const ready = await became(() => page.evaluate(
        (sel) => (document.querySelector(sel)?.querySelectorAll('[aria-invalid="true"]').length ?? 0) > 0,
        `[data-form="${id}"]`,
      ));

      // A premise that did not hold has nothing to settle for: the reading below is about to be
      // classified as no evidence, so it is taken once rather than waited on.
      const seen = await stops(() => page.evaluate(({ sel, wrapper, label }) => {
        const root = document.querySelector(sel);
        if (root === null) return null;
        return {
          refused: root.querySelectorAll('[aria-invalid="true"]').length > 0,
          hasWrapper: root.querySelector(`.${wrapper}`) !== null,
          wrapperError: root.querySelector(`.${wrapper}--error`) !== null,
          labelError: root.querySelector(`.${label}--has-error`) !== null,
        };
      }, { sel: `[data-form="${id}"]`, wrapper: WRAPPER, label: LABEL }), { window: ready ? 150 : 0 });

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

      // A `<textarea>` is not an input, a select or a button, and leaving it out meant the premise
      // never touched a textarea field at all — so the kind reported as bare was a kind this spec had
      // not reached. What is being asked here is "the field was left", and the tags that can be left
      // are all four.
      //
      // Waited for rather than counted once: the control has to have been drawn before it can be
      // left. But the wait is bounded and its failure is ordinary — several kinds render nothing a
      // person can focus, and letting the locator's own timeout discover that costs a second each.
      // An act on the value, not a visit: a field only looked at has nothing to report.
      await madeToSpeak(page, `[data-form="${id}"]`, host.api);

      // The refusal is the premise of everything below: a kind this form did not refuse is skipped,
      // so waiting for it costs nothing on a kind that is about to be skipped anyway.
      const ready = await became(() => page.evaluate(
        (sel) => (document.querySelector(sel)?.querySelectorAll('[aria-invalid="true"]').length ?? 0) > 0,
        `[data-form="${id}"]`,
      ));

      // A premise that did not hold has nothing to settle for: the reading below is about to be
      // classified as no evidence, so it is taken once rather than waited on.
      const seen = await stops(() => page.evaluate(({ sel, label }) => {
        const root = document.querySelector(sel);
        if (root === null) return null;
        return {
          refused: root.querySelectorAll('[aria-invalid="true"]').length > 0,
          hasLabel: root.querySelector(`.${label}`) !== null,
          labelError: root.querySelector(`.${label}--has-error`) !== null,
        };
      }, { sel: `[data-form="${id}"]`, label: LABEL }), { window: ready ? 150 : 0 });

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

for (const host of HOSTS) {
  test(`${host.name}: an empty field's label is not lifted`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    expect(MDY_FIELD_STATE_CLASSES.labelStates, JSON.stringify(MDY_FIELD_STATE_CLASSES)).toContain("filled");

    const lifted: Array<Record<string, unknown>> = [];
    let settled = 0;

    for (const kind of EVERY_KIND) {
      const id = `fl-${kind}`;
      await page.evaluate(
        ({ mountId, k, api, options }) => {
          const field: Record<string, unknown> = { name: "f", kind: k, label: "L" };
          if (/select|radio|segmented/.test(k)) field.options = options;
          (window as never as Record<string, { mountFields(id: string, f: unknown[]): unknown }>)[api]
            .mountFields(mountId, [field]);
        },
        { mountId: id, k: kind, api: host.api, options: OPTIONS },
      );

      // A kind that renders no label is skipped below, so the label is what there is to wait for.
      const ready = await became(() => page.evaluate(
        ({ sel, label }) => document.querySelector(sel)?.querySelector(`.${label}`) !== null && document.querySelector(sel)?.querySelector(`.${label}`) !== undefined,
        { sel: `[data-form="${id}"]`, label: LABEL },
      ));

      // A premise that did not hold has nothing to settle for: the reading below is about to be
      // classified as no evidence, so it is taken once rather than waited on.
      const seen = await stops(() => page.evaluate(({ sel, label }) => {
        const root = document.querySelector(sel);
        if (root === null) return null;
        const control = root.querySelector("input, textarea, select") as HTMLInputElement | null;
        return {
          hasLabel: root.querySelector(`.${label}`) !== null,
          filled: root.querySelector(`.${label}--filled`) !== null,
          value: control === null ? null : control.value,
          placeholder: control?.getAttribute("placeholder") ?? null,
          type: control?.getAttribute("type") ?? null,
        };
      }, { sel: `[data-form="${id}"]`, label: LABEL }), { window: ready ? 150 : 0 });

      if (seen === null || !seen.hasLabel) continue;
      if (!seen.filled) { settled += 1; continue; }
      // A placeholder under the label, or a control that is never empty, both earn the lift.
      if (seen.placeholder !== null || seen.type === "range" || (seen.value !== null && seen.value !== "")) continue;
      lifted.push({ kind, ...seen });
    }

    // The control: most fields do sit with their label down, so one that does not is that kind.
    expect(settled, JSON.stringify({ settled, lifted })).toBeGreaterThan(5);

    expect(lifted, JSON.stringify(lifted, null, 1)).toEqual([]);
  });
}

/** The kinds that declare a popup to open, read from the transition table. */
const OPENABLE = Object.entries(MDY_WIDGET_TRANSITIONS)
  .filter(([, moves]) => Array.isArray(moves) && moves.length > 0)
  .map(([kind]) => kind);

for (const host of HOSTS) {
  test(`${host.name}: an open field says it is open`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const OPEN = MDY_FIELD_STATE_CLASSES.rendererOpen;
    expect(typeof OPEN, JSON.stringify(MDY_FIELD_STATE_CLASSES)).toBe("string");

    const bare: Array<Record<string, unknown>> = [];
    let wearing = 0;

    for (const kind of OPENABLE) {
      const id = `op-${kind}`;
      await page.evaluate(
        ({ mountId, k, api, options }) => {
          const field: Record<string, unknown> = { name: "f", kind: k, label: "L" };
          if (/select|radio|segmented/.test(k)) field.options = options;
          (window as never as Record<string, { mountFields(id: string, f: unknown[]): unknown }>)[api]
            .mountFields(mountId, [field]);
        },
        { mountId: id, k: kind, api: host.api, options: OPTIONS },
      );

      // Same bound as the focus above: a kind this renderer builds from a native control has no
      // button to press, and that is an ordinary answer rather than something to wait two seconds for.
      const toggle = page.locator(`[data-form="${id}"] button`).first();
      if (await became(() => toggle.count().then((found) => found > 0))) {
        await toggle.click({ timeout: 500 }).catch(() => undefined);
      }

      // A kind that did not open is skipped, so opening is the premise rather than the claim.
      const ready = await became(() => page.evaluate(
        (sel) => document.querySelector(sel)?.querySelector('[aria-expanded="true"]') != null,
        `[data-form="${id}"]`,
      ));

      // A premise that did not hold has nothing to settle for: the reading below is about to be
      // classified as no evidence, so it is taken once rather than waited on.
      const seen = await stops(() => page.evaluate(({ sel, cls }) => {
        const root = document.querySelector(sel);
        if (root === null) return null;
        const open = root.querySelector('[aria-expanded="true"]') !== null;
        const wears = Array.from(root.querySelectorAll("*"))
          .some((element) => typeof element.className === "string" && element.className.split(" ").includes(cls));
        return { open, wears };
      }, { sel: `[data-form="${id}"]`, cls: OPEN }), { window: ready ? 150 : 0 });

      if (seen === null) continue;
      // A kind that did not open is not evidence: a renderer may build it from a native control.
      if (!seen.open) continue;
      if (seen.wears) wearing += 1;
      else bare.push({ kind, ...seen });
    }

    // The control: this renderer does put the class on something it opened, so a kind without it is
    // that kind rather than a class nothing carries.
    expect(wearing, JSON.stringify({ wearing, bare })).toBeGreaterThan(0);

    expect(bare, JSON.stringify(bare, null, 1)).toEqual([]);
  });
}
