import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();

const config = await import("../conformance.config.mjs");
const fixture = await import("./support/state-fixture.mjs");
const { MDY_CANONICAL_FILLED } = await import("@modyra/widgets/testing");

/**
 * A date field shows the date it holds.
 *
 * `entryText` is not the text of the control: it is the text somebody typed that could **not** be
 * read as a date, and every path that produces a value clears it. Bound to the box on its own, the
 * box is empty for every readable value — so a field holding a date submits it while showing
 * nothing, which is the worst shape a defect takes here: it submits and it is invisible.
 *
 * The text is therefore two questions answered in order — what could not be read, and failing that,
 * what is held — and both are asked of the contract rather than composed per renderer, because
 * composed per renderer is how one of them came to answer only the first half.
 */
// Taken from the contract's own filled values rather than written here: a kind whose value shape
// this bench guessed would be measuring the guess.
const HOLDS = Object.fromEntries(
  ["datepicker", "daterange"].map((kind) => [kind, MDY_CANONICAL_FILLED[kind]]),
);

for (const [kind, value] of Object.entries(HOLDS)) {
  if (!config.kinds.includes(kind)) continue;
  test(`${kind}: the box shows the value the field holds`, async () => {
    const fixture = await config.mount(kind, { value });
    await fixture.settle?.();
    const boxes = [...fixture.root.querySelectorAll("input")].filter((one) => one.type === "text");
    assert.ok(boxes.length > 0, `${kind}: no text box to read`);
    // Asserted as "not empty" rather than against a formatted string: which words a date becomes is
    // the locale's business, and pinning them here would make this bench a second date formatter.
    assert.deepEqual(
      boxes.map((box) => box.value.trim() !== ""),
      boxes.map(() => true),
      `${kind}: holds ${JSON.stringify(value)} and shows nothing`,
    );
    fixture.dispose?.();
  });
}

/**
 * Text the field cannot read is an error the field raises, held to the same rule as any other.
 *
 * Two promises, asserted apart because they are separate: while the field is live and holding text
 * it cannot read, it is wrong and says so; once it is switched off it is not the user's problem and
 * says nothing. `showsAsInvalid` does not care where an error came from.
 *
 * The announcement and the words are read together on purpose. Reported after the projection was
 * read, the message appeared under a control still saying `aria-invalid="false"` — which is one
 * field disagreeing with itself, and passes any check that looks at only one of the two.
 */
test("datepicker: text it cannot read is announced, and goes quiet when switched off", async () => {
  // **No validators.** Mounted with the conformance config's defaults the field carries `required`,
  // so it is already invalid and already showing a message — and every assertion below passes with
  // the entry error never reported at all. Measured: with the report removed under a clean build,
  // that version of this test stayed green. The only error in play here has to be the entry's.
  const mounted = await fixture.mount("datepicker", {
    validators: false, value: MDY_CANONICAL_FILLED.datepicker,
  });
  await mounted.settle?.();
  const box = [...mounted.root.querySelectorAll("input")].find((one) => one.type === "text");
  assert.ok(box, "no text box");

  box.value = "not a date";
  for (const kind of ["input", "change"]) box.dispatchEvent(new window.Event(kind, { bubbles: true }));
  box.dispatchEvent(new window.FocusEvent("blur", { bubbles: true }));
  await mounted.settle?.();

  const said = () => ({
    invalid: box.getAttribute("aria-invalid"),
    explained: (mounted.root.querySelector('[id$="__errors"]')?.textContent ?? "").trim() !== "",
  });
  assert.deepEqual(said(), { invalid: "true", explained: true });

  assert.ok(mounted.drive?.("disabled"), "this fixture cannot take the field out of play");
  await mounted.settle?.();
  assert.deepEqual(said(), { invalid: "false", explained: false });
  mounted.dispose?.();
});
