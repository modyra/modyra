/**
 * Shared map from contract parts to the elements Plain renders for them, plus the parts a widget
 * legitimately does not render in its initial closed, error-free state.
 */
const { findPartElement } = await import("../../widgets/dist/testing/index.js");
const { MDY_WIDGET_CONTRACTS } = await import("../../widgets/dist/index.js");

const option = { value: "x", label: "X" };
export const FIELDS = [
  { name: "a", kind: "text", label: "A" },
  { name: "b", kind: "email", label: "B" },
  { name: "c", kind: "password", label: "C" },
  { name: "d", kind: "textarea", label: "D" },
  { name: "e", kind: "number", label: "E" },
  { name: "f", kind: "slider", label: "F" },
  { name: "g", kind: "checkbox", label: "G" },
  { name: "h", kind: "toggle", label: "H" },
  { name: "i", kind: "radio", label: "I", options: [option] },
  { name: "j", kind: "segmented", label: "J", options: [option] },
  // Both of the kind's shapes, because the contract declares both and a harness walking one of them
  // reports the other conforming without having looked at it. `k` is the platform's chooser, which
  // is what a select with no opinion is; `k2` is the combobox this library builds. ADR 0176.
  { name: "k", kind: "select", label: "K", options: [option] },
  { name: "k2", kind: "select", label: "K2", searchable: true, options: [option] },
  { name: "l", kind: "multiselect", label: "L", options: [option] },
  { name: "m", kind: "datepicker", label: "M" },
  { name: "n", kind: "timepicker", label: "N" },
  { name: "o", kind: "daterange", label: "O" },
  { name: "p", kind: "file", label: "P" },
  { name: "q", kind: "colors", label: "Q" },
];

/**
 * Where each contract part lives in Plain's DOM — **derived from the contract, not listed here**.
 *
 * This was a switch over seventeen kinds mapping every part to a hand-written selector: ninety of
 * them, each naming a class the catalogue already declares. A resolver that knows a widget's
 * structure from outside the contract is what Milestone G's third proof forbids, and it was also a
 * second copy — a part that gained a class had to be told twice.
 *
 * `findPartElement` derives the selector, disambiguates same-class parts by their declared order,
 * falls back to the declared semantic element where a part has no class, and reaches a portalled
 * popup through the opener's `aria-controls` rather than by scanning the document.
 *
 * **Measured before the switch was deleted**, every kind against every state the contract declares
 * for it — 1682 parts resolved identically, **none differently, none lost**, and 91 found that the
 * hand-written map never listed. An earlier attempt was reverted for being measured at rest only,
 * which passed the closed-state suite and failed three others.
 */
export function partsOf(root, kind) {
  const out = {};
  for (const node of MDY_WIDGET_CONTRACTS[kind].structure.nodes) {
    if (node.part === "root") continue;
    out[node.part] = findPartElement(root, kind, node.part, { portalRoots: [root.ownerDocument.body] });
  }
  return out;
}

/**
 * Parts the widget owns but does not render in its initial, closed, error-free state. A closed
 * overlay's contents are absent by construction; listing them here is deliberate, not a waiver.
 */
export const ABSENT = {
  select: ["loading", "empty"],
  // The value chips and the placeholder belong to the compact trigger a renderer may show instead
  // of the field's own grid; this one shows the grid, as the catalogue declares. The count and the steppers
  // are counter mode's.
  multiselect: ["optionCount", "optionStep", "loading", "empty"],
  datepicker: ["actions"],
  // Nothing absent: `timepicker-field.ts` builds the clock from the contract's own classes, dial
  // included. Naming a part here asserts it is gone rather than switching its checks off, so an
  // entry that outlives the renderer justifying it fails instead of passing quietly.
  timepicker: [],
  daterange: [],
  colors: [],
  file: ["fileItem"],
};

/**
 * Structural parity gaps Plain still has against the contract, recorded rather than waived: the
 * conformance test asserts this map matches reality exactly, so a gap can neither appear silently
 * nor outlive its fix. Empty means every kind renders the contract's anatomy.
 */
export const KNOWN_DIVERGENCES = {
  // Empty. F-08 is closed: every opener names the popup it opens, the relation select and
  // multiselect always had. Keep it empty — the assertion matches both ways, so a new divergence
  // fails and a stale entry fails too.
};
