/**
 * The DOM contract, with the overlay open.
 *
 * Every conformance suite in this repository inspects a widget at rest, and a resting overlay widget
 * renders none of its popup. Forty-five parts across six kinds — the listbox and its options, the
 * calendar grid and its cells, the clock face — therefore had their classes, parents, order,
 * semantics and cardinality checked nowhere at all. `overlayOnlyParts` names them precisely, which
 * is what makes this suite's scope a measurement rather than a guess.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");
const { inspectWidgetDom, } = await import("../../widgets/dist/testing/index.js");
const { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, overlayOnlyParts } = await import("../../widgets/dist/index.js");
const { FIELDS, partsOf } = await import("./contract-parts.mjs");

/** The element that opens this kind's overlay — one kind, one part, so no other kind's class matches. */
const openerOf = (root, kind) => {
  const opener = MDY_POPUP_OPENERS[kind]?.opener;
  const classes = opener ? MDY_WIDGET_CONTRACTS[kind]?.parts?.[opener]?.classes ?? [] : [];
  return classes.length === 0 ? null : root.querySelector(classes.map((cls) => `.${cls}`).join(""));
};

const OVERLAY_FIELDS = FIELDS.filter((f) => MDY_WIDGET_CONTRACTS[f.kind].capabilities.overlay);

/**
 * Parts that stay absent even with the overlay open, per kind.
 *
 * A state, not a waiver: `empty` is the "no results" note and these fixtures have an option, while
 * `loading` needs a field that is fetching. `absentParts` asserts they really are absent, so a
 * renderer that shows a no-results note over a populated list still fails.
 */
const ABSENT_WHILE_OPEN = {
  select: ["empty", "loading"],
  multiselect: ["empty", "loading", "chip", "optionStep", "optionCount"],
  // The single-date picker commits on the click; the range needs a confirmation because a range is
  // only meaningful once both ends are chosen, so it — and only it — renders the action bar.
  datepicker: ["actions"],
  daterange: [],
  timepicker: [],
  colors: [],
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

test("every overlay kind conforms while it is open", async () => {
  assert.equal(OVERLAY_FIELDS.length, 6, "the catalogue's overlay kinds are not all in the fixture");

  const failures = [];
  for (const field of OVERLAY_FIELDS) {
    const host = document.createElement("div");
    document.body.append(host);
    const mounted = mountMdyForm(host, [field], { submitLabel: null });
    try {
      const root = host.querySelector(`[data-mdy-field="${field.name}"]`);
      const affordance = openerOf(root, field.kind);
      assert.ok(affordance, `${field.kind}: no opener affordance to click`);
      affordance.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await settle();

      // The element that *carries* the relation is the part the contract names, which is not always
      // the one a pointer lands on: a datepicker's opener is its typeable control, and the calendar
      // button beside it is a second affordance for the same popup.
      const parts = partsOf(root, field.kind);
      const declaredOpener = parts[MDY_POPUP_OPENERS[field.kind].opener];
      assert.ok(declaredOpener, `${field.kind}: the declared opener part is not mapped`);
      assert.equal(
        declaredOpener.getAttribute("aria-expanded"),
        "true",
        `${field.kind}: the opener did not open it`,
      );

      const issues = inspectWidgetDom(root, field.kind, {
        parts,
        absentParts: ABSENT_WHILE_OPEN[field.kind] ?? [],
        strictClasses: true,
        // The overlay is showing, so the parts that only exist inside it are required of this run.
        open: true,
      });
      if (issues.length) {
        failures.push(`${field.kind}: ${issues.map((i) => `${i.code}:${i.part}`).join(", ")}`);
      }
    } finally {
      mounted.dispose();
      host.remove();
    }
  }
  assert.deepEqual(failures, []);
});

test("the suite covers every part that only exists while open", () => {
  const uncovered = [];
  for (const field of OVERLAY_FIELDS) {
    const absent = new Set(ABSENT_WHILE_OPEN[field.kind] ?? []);
    for (const part of overlayOnlyParts(field.kind)) {
      if (!absent.has(part)) continue;
      // Declared absent while open is legitimate, but it has to stay a small, named list rather
      // than a way to opt a part out of ever being looked at.
      uncovered.push(`${field.kind}.${part}`);
    }
  }
  assert.ok(
    uncovered.length <= 8,
    `too many overlay parts excused while open: ${uncovered.join(", ")}`,
  );
});
