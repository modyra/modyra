/**
 * The scenarios every demo renders cover every kind the vocabulary declares.
 *
 * The demos are what a reader is shown, and a kind no page draws is a control that silently is not
 * there — the absent one being, by construction, the one nobody thinks to look for. The census that
 * started this arc found five demos showing zero kinds and one renderer at two of seventeen while
 * shipping all seventeen components; a number that nobody was checking is how that lasted.
 *
 * Checked in both directions, because both go wrong and they fail differently: a kind added to the
 * vocabulary with nowhere to appear, and a scenario naming a kind that no longer exists.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

const { MDY_FIELD_KINDS } = await import("../../../packages/core/dist/index.js");
const { SCENARIOS, STORY_SCENARIOS, kindsCovered, storyCoverage } =
  await import("../../../examples/shared/scenarios/index.js");

test("every kind the vocabulary declares is drawn by some scenario", () => {
  const covered = new Set(kindsCovered());
  const missing = MDY_FIELD_KINDS.filter((kind) => !covered.has(kind));

  assert.deepEqual(missing, [], `no scenario draws: ${missing.join(", ")}`);
  assert.equal(covered.size, MDY_FIELD_KINDS.length);
});

test("no scenario draws a kind the vocabulary does not declare", () => {
  // The other direction: a scenario left naming a kind that has been renamed or retired would
  // otherwise keep a demo pointing at a control the library no longer has.
  const declared = new Set(MDY_FIELD_KINDS);
  const unknown = kindsCovered().filter((kind) => !declared.has(kind));

  assert.deepEqual(unknown, [], `drawn but not declared: ${unknown.join(", ")}`);
});

test("every field a scenario declares says what it is and what it starts from", () => {
  for (const scenario of SCENARIOS) {
    const fields = scenario.fields();
    assert.ok(fields.length > 0, `${scenario.name} declares no fields`);
    for (const field of fields) {
      assert.ok(field.name, `${scenario.name}: a field has no name`);
      assert.ok(field.kind, `${scenario.name}.${field.name} has no kind`);
      assert.ok(field.label, `${scenario.name}.${field.name} has no label, so a page would draw it unnamed`);
      // `initial` may legitimately be null, false, 0 or "" — the point is that it was declared, not
      // that it is truthy. A kind whose empty is left out gets `undefined`, and a control handed
      // that shows a state its own contract says it is never in.
      assert.ok("initial" in field, `${scenario.name}.${field.name} declares no starting value`);
    }
  }
});

test("the options a scenario hands out are copies, not one array shared", () => {
  // A page that reorders or edits its options would otherwise change every other page built from
  // the same declaration — one demo's mutation arriving in another's controls.
  const first = SCENARIOS.flatMap((scenario) => scenario.fields()).find((field) => field.options);
  assert.ok(first, "no scenario declares options, so this asserts nothing");

  const again = SCENARIOS.flatMap((scenario) => scenario.fields()).find((field) => field.name === first.name);
  assert.notEqual(first.options, again.options, "two reads share one options array");
  assert.deepEqual(first.options, again.options, "two reads disagree about the options");
});

test("how many kinds also live inside a story — reported, not enforced", () => {
  // Deliberately not a threshold. A kind pushed into a story to raise this would make the story
  // worse and the number meaningless; what it is for is being readable before anyone proposes one.
  const counts = storyCoverage();
  const inAStory = [...counts.values()].filter((n) => n > 0).length;

  console.log(
    `[scenarios] ${inAStory} of ${MDY_FIELD_KINDS.length} kinds appear in at least one of the `
    + `${STORY_SCENARIOS.length} story scenario(s)`,
  );
  assert.equal(counts.size, MDY_FIELD_KINDS.length, "the report does not cover every declared kind");
});
