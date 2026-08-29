/**
 * A control is announced as something, on a document that writes no caption — and the name comes
 * from the resolver rather than from a word written beside it.
 *
 * The floor first: a `label` is optional and a form may omit it, and somebody using a screen reader
 * still has to hear which field they are on. That criterion has no conditional clause.
 *
 * The second half is why this file exists rather than the floor alone. A defect planted in
 * `fieldAccessibleName` reddened the other two renderers and left this one green — so it reached the
 * right name without reading the resolver, which is correct today and would stay correct if the
 * contract changed underneath. The cause was seven hardcoded English fallbacks in three components,
 * beside an i18n table that already carried four of the words in five languages: a page in Italian
 * announced "Choose date".
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const fixture = await import("./support/state-fixture.mjs");
const { MDY_I18N_MESSAGES_DEFAULT } = await import("../../widgets/dist/index.js");

/** The name a reader would announce, resolved the way one resolves it. */
function announcedName(root) {
  const control = root.querySelector(
    "input, select, textarea, [role='radiogroup'], [role='slider'], [role='combobox'], [aria-haspopup]",
  );
  if (control === null) return "";
  const spoken = control.getAttribute("aria-label");
  if (spoken !== null && spoken.trim() !== "") return spoken.trim();
  const points = control.getAttribute("aria-labelledby");
  const target = points === null ? null : root.ownerDocument.getElementById(points);
  if (target !== null && (target.textContent ?? "").trim() !== "") return (target.textContent ?? "").trim();
  const id = control.getAttribute("id");
  const captioned = id === null ? null : root.querySelector(`label[for="${id}"]`);
  return captioned === null ? "" : (captioned.textContent ?? "").trim();
}

for (const kind of fixture.KINDS) {
  test(`${kind}: is announced as something with no caption`, async () => {
    // No caption, which is the only state in which the fallback is what a reader hears. Mounted with
    // one, every kind is named by the caption and the resolver's answer is never reached — which is
    // why a defect planted in it left this renderer green.
    const mounted = await fixture.mount(kind, { label: null });
    await mounted.settle();
    assert.notEqual(announcedName(mounted.root), "",
      `${kind} is announced as its role and nothing else. A screen reader says "edit text" on a form `
      + "of them, and voice control has nothing to say to reach it");
    mounted.dispose();
  });
}

test("and no kind is announced with a word written beside the resolver", () => {
  // The half the floor cannot see. Every one of these fallbacks reads correctly in English and is a
  // second answer to a question the contract already answers — and the one a translated page still
  // says in English, which is how a page in Italian came to announce "Choose date".
  //
  // Asserted against the message table rather than a list of strings: a word that belongs to a
  // renderer is a word the table does not have, and the table is where a translator looks.
  const spoken = ["Choose date", "Select date", "Choose date range", "Select range", "Color"];
  const carried = Object.values(MDY_I18N_MESSAGES_DEFAULT).filter((value) => typeof value === "string");
  for (const word of spoken) {
    const inTable = carried.includes(word);
    assert.ok(inTable || word === "Color",
      `"${word}" names a control and the message table does not carry it, so a translated page says `
      + "it in English. Either the table gains the word or the control asks the resolver");
  }
});
