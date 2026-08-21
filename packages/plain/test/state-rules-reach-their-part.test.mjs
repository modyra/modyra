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

/**
 * The foundation and every theme, read together.
 *
 * A theme restates some of these rules in its own idiom, so a relationship the foundation gets right
 * can still be orphaned one file over — which is what happened: six rules across three themes
 * outlived the same move, in a sweep that had looked at the foundation alone.
 */
const SHEETS = ["modyra.css", "modyra-modern.css", "modyra-material.css", "modyra-ios.css", "modyra-ionic.css"];
const css = SHEETS
  .map((sheet) => readFileSync(new URL(`../../styles/src/${sheet}`, import.meta.url), "utf8"))
  .join("\n");

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

/**
 * Rules this host cannot reach, and why — an exact set, so a new one cannot join it in silence.
 *
 * `--horizontal` is a variant the catalogue declares for a radio group's own part. Angular and Lit
 * emit it from a `layout` input; this renderer has no such input and never writes the class, so a
 * rule scoped to it selects nothing here for a reason that is about the renderer rather than about
 * the relationship this file measures.
 */
const UNREACHABLE_HERE = [".mdy-radio-group--horizontal input[type=\"radio\"]:checked+.mdy-radio-circle"];

/** The selector with its pseudo-elements dropped — `::after` is not a node `matches` can find. */
const asNodeSelector = (selector) => selector.replace(/::[a-z-]+/g, "").trim();

function mountBoolean(kind, { checked, disabled }) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  // A radio group needs options to have anything to check; the booleans take none.
  const options = kind === "radio" ? { options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] } : {};
  const mounted = mountMdyForm(host, [{ name: "flag", kind, label: "Flag", ...options }], { submitLabel: null });
  if (checked) mounted.form.f.flag.set(kind === "radio" ? "a" : true);
  if (disabled) mounted.form.setDisabled("flag", () => true);
  return { host, mounted };
}

for (const kind of ["checkbox", "toggle", "radio"]) {
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

    const [expected, unexplained] = [
      unmatched.filter((selector) => UNREACHABLE_HERE.includes(selector)),
      unmatched.filter((selector) => !UNREACHABLE_HERE.includes(selector)),
    ];
    assert.deepEqual(unexplained, [], `state rules that select nothing in a rendered ${kind}`);
    // The recorded set is exact in both directions: a rule that starts matching is a renderer that
    // grew the variant, and leaving it listed would keep a stale exemption alive.
    assert.deepEqual(
      expected,
      UNREACHABLE_HERE.filter((selector) => selectors.includes(selector)),
      `a recorded exemption for ${kind} now matches and should be removed`,
    );
  });
}
