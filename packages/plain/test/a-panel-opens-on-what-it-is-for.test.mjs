/**
 * Every panel opens on the thing it was opened to operate, and the contract names which part.
 *
 * Five kinds already answered this way in all three renderers before anything was declared — a
 * select lands on its filter box, a calendar on a day, a timepicker on the hour, a colours field on
 * a swatch. Those five are asserted here as what they are: a finding written down, not a change.
 * Nothing in this renderer moved to make them pass.
 *
 * The sixth is the one that had three answers across three renderers, and the contract now settles
 * it: the filter box where there is one, the first option where there is not — never the chip that
 * removes a choice, and never the trigger the panel was opened from. ADR 0197.
 *
 * **The configuration is stated beside every assertion.** A multiselect with a filter box and one
 * without are different questions, and reading two runs that differ in configuration as one answer
 * is exactly how three renderers looked like three opinions when two were being asked something else.
 *
 * **And the landing is asserted rather than the press.** The opener is focused first, because a
 * pointer press leaves it focused and this environment does not, and the panel is asserted open
 * before focus is read: focus after a panel that never opened says nothing about opening.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");
const { focusPartOnOpen, partClasses } = await import("../../widgets/dist/index.js");

const option = { value: "x", label: "X" };
const settle = () => new Promise((resolve) => setTimeout(resolve, 40));

/** Every kind that opens a panel of ours, with the configuration each answer belongs to. */
const CASES = [
  { kind: "select", extra: { options: [option], searchable: true } },
  { kind: "multiselect", extra: { options: [option] } },
  { kind: "multiselect", extra: { options: [option], searchable: true } },
  { kind: "datepicker", extra: {} },
  { kind: "daterange", extra: {} },
  { kind: "timepicker", extra: {} },
  { kind: "colors", extra: {} },
];

for (const { kind, extra } of CASES) {
  const shown = extra.searchable === true ? " (searchable)" : extra.searchable === false ? " (not searchable)" : "";
  test(`${kind}${shown} opens on the part the contract names`, async () => {
    const host = document.createElement("div");
    document.body.append(host);
    mountMdyForm(host, [{ name: "f", kind, label: "F", ...extra }], { submitLabel: null });
    await settle();

    const opener = host.querySelector('[data-mdy-field="f"] [aria-expanded]');
    assert.ok(opener, `${kind} drew no opener, so nothing was opened`);
    opener.focus();
    assert.equal(document.activeElement, opener, "the opener did not take focus, so the press is read from the wrong place");
    opener.click();
    await settle();
    assert.equal(opener.getAttribute("aria-expanded"), "true", `${kind}: the panel did not open, so where focus went says nothing`);

    const part = focusPartOnOpen(kind, extra);
    assert.ok(part, `${kind} opens a panel and the contract names no part for it`);
    const expected = partClasses(kind, part)[0];
    assert.equal(typeof expected, "string", `${kind}: the part "${part}" carries no class to find it by`);

    const landed = document.activeElement;
    assert.notEqual(landed, document.body, `${kind}: the panel opened and focus is on the document`);
    assert.ok(
      landed.classList.contains(expected),
      `${kind}${shown}: focus landed on .${landed.className} and the contract names "${part}" (.${expected})`,
    );

    // The class alone cannot tell the two apart, and the two are the whole decision: an option in the
    // panel and a chip in the strip both carry `mdy-chip`, and the chip is the control that *removes*
    // a value. Asserted by where the element is, which is the property that differs — a check that
    // only read the class would pass on the behaviour this replaced.
    if (part === "option") {
      const inPanel = partClasses(kind, "options").some((cls) => landed.closest(`.${cls}`) !== null);
      assert.ok(inPanel, `${kind}${shown}: focus landed on a chip outside the panel — the strip's chips remove a value, they do not offer one`);
      assert.ok(!landed.classList.contains("mdy-chip--value"), `${kind}${shown}: focus landed on a value chip rather than an option`);
    }
    host.remove();
  });
}
