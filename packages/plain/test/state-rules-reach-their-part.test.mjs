/**
 * Whether the rule that paints a state still reaches the element it names.
 *
 * A stylesheet says how a checked box looks by naming a *relationship* between two elements —
 * `.mdy-checkbox__control:checked + .mdy-checkbox__indicator` is the input and the box beside it.
 * Move the box and the rule stops matching, silently: the class is still emitted, still mentioned in
 * the stylesheet, and the theme audit compares names on both sides and stays green. Nothing asked
 * whether the selector still selects anything.
 *
 * That is exactly what happened when a boolean's drawn part moved inside its `<label>` so the row
 * would stop being one big click target: state changed and nothing repainted.
 *
 * This reads the shipped stylesheet, takes every selector that decides a checkbox's or a toggle's
 * *state*, and asserts each one matches something in the rendered field. It measures the
 * relationship, not the presence of a name.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");

const css = readFileSync(new URL("../../styles/src/modyra.css", import.meta.url), "utf8");

/**
 * The selectors in the stylesheet that decide how a state is drawn.
 *
 * A state pseudo-class is what makes a rule conditional on the control rather than on the field's
 * shape, so those are the rules a moved part can silently orphan. `:hover` and `:focus-visible` are
 * left out: neither can be produced in jsdom, so a check on them would report the harness.
 */
function stateSelectors(kind) {
  const rules = [...css.matchAll(/^\s*(\.mdy-[^{}]*?)\s*\{/gm)].map(([, selector]) => selector.trim());
  return rules.filter((selector) =>
    selector.includes(`mdy-${kind}`)
    && (selector.includes(":checked") || selector.includes(":disabled"))
    && !selector.includes(":hover")
    && !selector.includes(":focus-visible"));
}

/** The selector with its pseudo-elements dropped — `::after` is not a node `matches` can find. */
const asNodeSelector = (selector) => selector.replace(/::[a-z-]+/g, "").trim();

function mountBoolean(kind, { checked, disabled }) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const mounted = mountMdyForm(host, [{ name: "flag", kind, label: "Flag" }], { submitLabel: null });
  if (checked) mounted.form.f.flag.set(true);
  if (disabled) mounted.form.setDisabled("flag", () => true);
  return { host, mounted };
}

for (const kind of ["checkbox", "toggle"]) {
  test(`every state rule for a ${kind} reaches the part it names`, async () => {
    const selectors = stateSelectors(kind);
    // The control on the measurement: a run that found no rules would pass without checking one.
    assert.ok(selectors.length >= 3, `no state rules found for ${kind}: ${JSON.stringify(selectors)}`);

    const unmatched = [];
    for (const selector of selectors) {
      const wants = { checked: selector.includes(":checked"), disabled: selector.includes(":disabled") };
      const { host, mounted } = mountBoolean(kind, wants);
      // The renderer writes the control's state on the next microtask, not inside `set`.
      await Promise.resolve();
      if (host.querySelectorAll(asNodeSelector(selector)).length === 0) {
        unmatched.push(selector);
      }
      mounted.dispose();
      host.remove();
    }

    assert.deepEqual(unmatched, [], `state rules that select nothing in a rendered ${kind}`);
  });
}
