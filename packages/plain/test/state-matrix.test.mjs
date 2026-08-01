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

/**
 * The empty value each kind can actually hold.
 *
 * This driver used to hand every kind `""`. For a text field that is the empty value; for a
 * daterange it is a *string where an object belongs*, and `required` rejected it for being an empty
 * string rather than for being an empty range. The `daterange × invalid` row was green because the
 * fixture fed it a value the widget can never hold — a green row that was a claim about the driver,
 * which is the same mistake as a red row that is a claim about the renderer.
 *
 * Lit's driver has had this since it was written; Plain's had not.
 */
function emptyFor(kind) {
  switch (kind) {
    case "multiselect": return [];
    case "checkbox": case "toggle": return false;
    case "number": case "slider": return null;
    case "daterange": return { start: null, end: null };
    default: return "";
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
        case "empty": handle.set(emptyFor(kind)); return true;
        case "filled": handle.set(valueFor(kind)); return true;
        case "touched": handle.markAsTouched(); return true;
        case "invalid": handle.set(emptyFor(kind)); handle.markAsTouched(); return true;
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
 * Plain's divergences: **no rendering defects left**.
 *
 * The ledger is asserted both ways, so it is a live claim rather than a comment — a new divergence
 * fails here, and so does a stale entry left behind after its fix.
 *
 * What batch D closed, in the order the causes turned out to nest:
 *
 * - select, datepicker and timepicker emitted `aria-disabled` and left the control operable. The
 *   native attribute now goes out with the ARIA.
 * - the multiselect renders its options twice and only the popup's grid applied the contract part,
 *   so a disabled multiselect left two live buttons in the field.
 * - `daterange`, `colors` and `file` had **no a11y projection at all**. No controller in
 *   `@modyra/widgets` builds one, so those three applied the static part contract and nothing
 *   state-driven. The six rows understated it: there was no `aria-required` and no
 *   `aria-describedby` either, so their error lists were rendered, styled, and announced to nobody.
 *   `projectFieldShellA11y` is the shared half of `projectFieldA11y` for exactly this case.
 *
 * The last three rows were never renderer defects. `required` did not reject a kind's own empty
 * value when that value was not a string, so an unchecked required checkbox, an off required toggle
 * and a required range with both ends unset all reported themselves valid — the renderer was telling
 * the truth about a state the form never entered. Three adapters ledgered them identically, which is
 * what made it a validation finding. Closed by plan 26: `required` now treats `false` and an empty
 * range as empty, and a *partial* range is rejected by `completeRange` whether or not the field is
 * required.
 */
const KNOWN_DIVERGENCES = {};

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
