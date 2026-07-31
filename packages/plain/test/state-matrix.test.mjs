/**
 * The state matrix, driven against the Plain renderer.
 *
 * Every other conformance test inspects a widget in whatever state the fixture happened to mount
 * in — almost always empty, untouched and closed. Everything a user actually does to a control was
 * unverified: filling it, breaking it, disabling it, opening it.
 *
 * The judgement lives in `@modyra/widgets/testing` (`inspectWidgetState`) so Angular and Lit can
 * reuse it; the *driving* is here, because pushing a renderer into a state is adapter-specific and
 * no shared helper can do all three honestly. Task 16's cross-renderer equivalence is meant to be
 * built on this split.
 *
 * Divergences are recorded, not fixed — that is this batch's rule.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");
const { inspectUnsupportedStateAria, inspectWidgetState } = await import("../../widgets/dist/testing/index.js");
const { MDY_WIDGET_STATE_SUPPORT, widgetStateMatrixSize } = await import("../../widgets/dist/index.js");
// The per-kind part resolver the DOM-contract test already uses. Reused rather than re-derived:
// a second, text-field-shaped resolver reports every non-text kind as missing parts it does render.
const { partsOf } = await import("./contract-parts.mjs");

/**
 * Every kind, grouped by family. The families are how the batches were scoped; the matrix runs
 * them all because the driver turned out to generalise, and a family left out is a family whose
 * states nobody is asserting.
 */
const FAMILIES = {
  "simple inputs": ["text", "email", "password", "textarea", "number", "slider"],
  booleans: ["checkbox", "toggle"],
  options: ["radio", "segmented", "select", "multiselect"],
  pickers: ["datepicker", "daterange", "timepicker", "colors"],
  file: ["file"],
};
const ALL_KINDS = Object.values(FAMILIES).flat();

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
const NEEDS_OPTIONS = new Set(["radio", "segmented", "select", "multiselect"]);

function mountOne(kind) {
  const host = document.createElement("div");
  document.body.append(host);
  const field = {
    name: "f", kind, label: "F", validators: { required: true },
    ...(NEEDS_OPTIONS.has(kind) ? { options: OPTIONS } : {}),
  };
  const mounted = mountMdyForm(host, [field], { submitLabel: null });
  const root = host.querySelector(`[data-mdy-field="f"]`);
  return { host, mounted, root, dispose: () => { mounted.dispose(); host.remove(); } };
}

function controlOf(root) {
  return root.querySelector(".mdy-input-wrapper input, .mdy-input-wrapper textarea, .mdy-input-wrapper select") ??
    root.querySelector("input, textarea, select");
}


/** Plain's effects settle on a task, not synchronously — assert before that and every state reads
 * as its previous value, which looks exactly like a renderer that ignored the change. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

/**
 * Drive a Plain field into a state. Returns false when the public API offers no way to reach it —
 * which is itself a finding, and is reported rather than skipped silently.
 */
function drive(fixture, state) {
  const { mounted, root } = fixture;
  const handle = mounted.form.f.f;
  fixture.kind = fixture.kind ?? root.getAttribute("data-mdy-kind");
  const control = controlOf(root);
  switch (state) {
    case "pristine":
      return true;
    case "empty":
      handle.set("");
      return true;
    case "filled":
      handle.set(fixtureValueFor(fixture.kind, root));
      return true;
    case "touched":
      handle.markAsTouched();
      return true;
    case "invalid":
      handle.set("");
      handle.markAsTouched();
      return true;
    case "focused":
      (control ?? root.querySelector("button, [tabindex]"))?.focus?.();
      return true;
    case "selected":
      handle.set(fixtureValueFor(fixture.kind, root));
      return true;
    case "open": {
      // Opened the way a user opens it, through the affordance the renderer put on the page.
      const trigger = root.querySelector(
        ".mdy-select__trigger, .mdy-datepicker__toggle, .mdy-timepicker__toggle, .mdy-colors__toggle-area, .mdy-multiselect__search-btn",
      );
      if (!trigger) return false;
      trigger.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      return true;
    }
    case "loading":
      // Nothing in the public API puts a field into a loading state; async options are the
      // adapter's own concern. Recorded rather than faked.
      return false;
    case "disabled":
      mounted.form.setDisabled("f", () => true);
      return true;
    case "readonly":
      if (typeof mounted.form.setReadonly !== "function") return false;
      mounted.form.setReadonly("f", () => true);
      return true;
    default:
      return false;
  }
}

/** A value each kind will actually accept — a filled state reached with a rejected value is empty. */
function fixtureValueFor(kind, root) {
  switch (kind) {
    case "number": case "slider": return 7;
    case "checkbox": case "toggle": return true;
    case "multiselect": return ["a"];
    case "radio": case "segmented": case "select": return "a";
    case "datepicker": return "2026-07-15";
    case "daterange": return { start: "2026-07-15", end: "2026-07-20" };
    case "timepicker": return "10:30";
    case "colors": return "#004cff";
    case "file": return null;
    default: return control0(root) ?? "value";
  }
}
function control0() { return "value"; }

/**
 * Divergences Plain has against the state contract, recorded rather than waived — this batch's rule
 * is that divergences are found and written down, not fixed. Asserted as an exact match both ways,
 * so a new one fails the suite and a fixed one cannot outlive its fix.
 *
 * Two clusters, and both were predicted by the technical review before the matrix existed:
 *
 *  1. `readonly` does nothing. `form.setReadonly()` sets the field state, the handle never exposes
 *     it, and no renderer reflects it: no native `readonly`, and `aria-readonly` stays "false".
 *     A field marked read-only still accepts typing — verified by typing into one.
 *  2. `disabled` on composite kinds reaches some of their native controls and not all. A date
 *     field's toggle button is disabled while its text input still accepts typing.
 *
 * Plus `invalid` not being exposed at all on a few composites.
 */
const KNOWN_DIVERGENCES = {
  "text × readonly": ["STATE_ARIA_WRONG", "STATE_NOT_APPLIED"],
  "email × readonly": ["STATE_ARIA_WRONG", "STATE_NOT_APPLIED"],
  "password × readonly": ["STATE_ARIA_WRONG", "STATE_NOT_APPLIED"],
  "textarea × readonly": ["STATE_ARIA_WRONG", "STATE_NOT_APPLIED"],
  "number × readonly": ["STATE_ARIA_WRONG", "STATE_NOT_APPLIED"],

  // `disabled` reaches some of a composite's native controls and not all of them.
  "select × disabled": ["STATE_NOT_APPLIED"],
  "multiselect × disabled": ["STATE_NOT_APPLIED"],
  "datepicker × disabled": ["STATE_NOT_APPLIED"],
  "timepicker × disabled": ["STATE_NOT_APPLIED"],
  "daterange × disabled": ["STATE_ARIA_MISSING", "STATE_NOT_APPLIED"],
  "colors × disabled": ["STATE_ARIA_MISSING", "STATE_NOT_APPLIED"],
  "file × disabled": ["STATE_ARIA_MISSING"],

  // `invalid` is not exposed to assistive technology at all on these.
  "select × invalid": ["STATE_ARIA_MISSING"],
  "daterange × invalid": ["STATE_ARIA_MISSING"],
  "colors × invalid": ["STATE_ARIA_MISSING"],
  "file × invalid": ["STATE_ARIA_MISSING"],
};

/**
 * `aria-readonly="false"` on kinds that have no read-only rendering — the signature of a common
 * ARIA shell applied mechanically to every control, and the second defect the review predicted.
 */
const KNOWN_UNSUPPORTED_ARIA = ["slider", "checkbox", "toggle", "radio", "segmented"];

const results = [];
const undrivable = [];

test("every declared state of every kind is asserted", async () => {
  for (const kind of ALL_KINDS) {
    for (const state of MDY_WIDGET_STATE_SUPPORT[kind]) {
      const fixture = mountOne(kind);
      fixture.kind = kind;
      const driven = drive(fixture, state);
      await settle();
      if (!driven) {
        undrivable.push(`${kind} × ${state}`);
        fixture.dispose();
        continue;
      }
      const issues = inspectWidgetState(fixture.root, kind, state, {
        parts: partsOf(fixture.root, kind),
        control: controlOf(fixture.root),
      });
      results.push({ kind, state, issues: issues.map((issue) => `${issue.code}: ${issue.message}`) });
      fixture.dispose();
    }
  }

  const rows = results.map((r) =>
    `    ${r.kind.padEnd(9)} ${r.state.padEnd(10)} ${r.issues.length ? "DIVERGES" : "ok"}` +
      (r.issues.length ? `\n               ${r.issues.join("\n               ")}` : ""));
  console.log(
    `\n  state matrix — plain, every kind: ${results.length} kind × state pairs asserted ` +
      `(contract declares ${widgetStateMatrixSize()} across all kinds)\n` +
      rows.join("\n") +
      (undrivable.length ? `\n    not drivable from the public API: ${undrivable.join(", ")}` : "") + "\n",
  );

  // The matrix must be non-empty and must have covered every declared state of every kind here.
  const expected = ALL_KINDS.reduce((total, kind) => total + MDY_WIDGET_STATE_SUPPORT[kind].length, 0);
  assert.equal(results.length + undrivable.length, expected, "a kind × state pair was silently skipped");

  // Exact match both ways: a new divergence fails, and so does a stale entry left behind by a fix.
  const observed = {};
  for (const r of results) {
    if (!r.issues.length) continue;
    observed[`${r.kind} × ${r.state}`] = [...new Set(r.issues.map((i) => i.split(":")[0]))].sort();
  }
  const expectedLedger = Object.fromEntries(
    Object.entries(KNOWN_DIVERGENCES).map(([key, codes]) => [key, [...codes].sort()]),
  );
  assert.deepEqual(observed, expectedLedger);
});

test("no kind exposes ARIA for a state it does not declare", async () => {
  const offenders = [];
  for (const kind of ALL_KINDS) {
    const fixture = mountOne(kind);
    await settle();
    for (const issue of inspectUnsupportedStateAria(fixture.root, kind)) {
      offenders.push(`${kind}: ${issue.message}`);
    }
    fixture.dispose();
  }
  assert.deepEqual(
    [...new Set(offenders.map((line) => line.split(":")[0]))],
    KNOWN_UNSUPPORTED_ARIA,
    `\n  ${offenders.join("\n  ")}\n`,
  );
});
