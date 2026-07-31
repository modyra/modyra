/**
 * The state matrix, driven against the Plain renderer.
 *
 * The traversal, the report and the divergence bookkeeping are shared — `collectStateMatrix` in
 * `@modyra/widgets/testing` — so this file is only a driver. Angular and Lit have their own, and all
 * three answer to the same judgement.
 *
 * That split was the design from the start and went unused for a while, which is how a defect fixed
 * in Plain and still live in Angular and Lit passed for closed.
 *
 * Divergences are recorded, not fixed, unless a batch says otherwise. The ledger is asserted both
 * ways: a new divergence fails, and so does a stale entry that outlived its fix.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");
const { collectStateMatrix, normalizeStateLedger } = await import("../../widgets/dist/testing/index.js");
const { partsOf } = await import("./contract-parts.mjs");

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
const NEEDS_OPTIONS = new Set(["radio", "segmented", "select", "multiselect"]);

const KINDS = [
  "text", "email", "password", "textarea", "number", "slider",
  "checkbox", "toggle",
  "radio", "segmented", "select", "multiselect",
  "datepicker", "daterange", "timepicker", "colors",
  "file",
];

/** A value each kind will actually accept — a filled state reached with a rejected value is empty. */
function valueFor(kind) {
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
    default: return "value";
  }
}

function controlOf(root) {
  return root.querySelector(".mdy-input-wrapper input, .mdy-input-wrapper textarea, .mdy-input-wrapper select") ??
    root.querySelector("input, textarea, select");
}

function mount(kind) {
  const host = document.createElement("div");
  document.body.append(host);
  const field = {
    name: "f", kind, label: "F", validators: { required: true },
    ...(NEEDS_OPTIONS.has(kind) ? { options: OPTIONS } : {}),
  };
  const mounted = mountMdyForm(host, [field], { submitLabel: null });
  const root = host.querySelector(`[data-mdy-field="f"]`);
  const handle = mounted.form.f.f;

  return {
    root,
    parts: () => partsOf(root, kind),
    control: () => controlOf(root),
    // Plain's effects land on a task rather than synchronously.
    settle: () => new Promise((resolve) => setTimeout(resolve, 20)),
    dispose: () => { mounted.dispose(); host.remove(); },
    drive(state) {
      switch (state) {
        case "pristine": return true;
        case "empty": handle.set(""); return true;
        case "filled": handle.set(valueFor(kind)); return true;
        case "touched": handle.markAsTouched(); return true;
        case "invalid": handle.set(""); handle.markAsTouched(); return true;
        case "focused":
          (controlOf(root) ?? root.querySelector("button, [tabindex]"))?.focus?.();
          return true;
        case "selected": handle.set(valueFor(kind)); return true;
        case "disabled": mounted.form.setDisabled("f", () => true); return true;
        case "readonly": mounted.form.setReadonly("f", () => true); return true;
        case "open": {
          const trigger = root.querySelector(
            ".mdy-select__trigger, .mdy-datepicker__toggle, .mdy-timepicker__toggle, .mdy-colors__toggle-area, .mdy-multiselect__search-btn",
          );
          if (!trigger) return false;
          trigger.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
          return true;
        }
        // Nothing in the public API puts a field into a loading state; async options are the
        // adapter's own concern. Recorded rather than faked.
        case "loading": return false;
        default: return false;
      }
    },
  };
}

/**
 * Plain's remaining divergences.
 *
 * `readonly` is closed, and so is the half of batch D that had a projection to fix: select,
 * multiselect, datepicker and timepicker now apply the native `disabled` as well as the ARIA, and
 * select exposes `aria-invalid`.
 *
 * What is left is one finding, not six. **`daterange`, `colors` and `file` have no a11y projection
 * at all** — no controller in `@modyra/widgets` builds one, so these renderers apply the *static*
 * part contract and nothing state-driven. They expose no `aria-invalid`, no `aria-disabled`, no
 * `aria-required` and no `aria-describedby`, which means their error messages are not announced.
 * That is wider than these six rows and is its own batch, on every adapter at once.
 */
const KNOWN_DIVERGENCES = {
  "daterange × disabled": ["STATE_ARIA_MISSING"],
  "colors × disabled": ["STATE_ARIA_MISSING"],
  "file × disabled": ["STATE_ARIA_MISSING"],

  "daterange × invalid": ["STATE_ARIA_MISSING"],
  "colors × invalid": ["STATE_ARIA_MISSING"],
  "file × invalid": ["STATE_ARIA_MISSING"],
};

const matrix = await collectStateMatrix({ kinds: KINDS, mount });

test("every declared state of every kind is asserted", () => {
  console.log(matrix.report("plain, every kind"));
  assert.equal(
    matrix.asserted + matrix.undrivable.length,
    matrix.expected,
    "a kind × state pair was silently skipped",
  );
});

test("plain's divergences are exactly the recorded ones", () => {
  assert.deepEqual(matrix.observed, normalizeStateLedger(KNOWN_DIVERGENCES));
});

test("no kind exposes ARIA for a state it does not declare", () => {
  assert.deepEqual(matrix.unsupportedAria, []);
});
