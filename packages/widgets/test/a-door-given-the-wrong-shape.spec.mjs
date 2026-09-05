import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as widgets from "../dist/index.js";

/**
 * A door handed an object without the field it needs refuses, and says which field.
 *
 * A **value** of the wrong shape is a verdict (ADR 0208): it is a person's data, the page survives it
 * and the verdict channel reports it. An **argument** of the wrong shape is a defect in the calling
 * code, and a code defect is answered loudly, to the builder, rather than quietly to the page. Two
 * audiences, two policies, one coherence: a wrong shape never passes in silence.
 *
 * The roster is **derived from the source**, never listed here: a guard put on one twin and not the
 * other is how the pair drifts, and this file would be the place that hid it.
 */

/** Every door that calls the guard, and the fields each one demands, read from the source. */
function guarded() {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) { walk(path); continue; }
      if (!entry.endsWith(".ts")) continue;
      const source = readFileSync(path, "utf8");
      for (const [, door, shape, list] of source.matchAll(
        /given\("(\w+)",\s*"([^"]*)",\s*\w+,\s*\[([^\]]*)\]\)/g,
      )) {
        found.push({ door, shape, fields: [...list.matchAll(/"(\w+)"/g)].map((one) => one[1]) });
      }
    }
  };
  walk("packages/widgets/src");
  return found;
}

const ROSTER = guarded();

test("the roster is not empty, or this file guards nothing", () => {
  assert.ok(ROSTER.length > 5, `only ${ROSTER.length} doors call the guard`);
});

test("every guarded door is exported, or nobody can hand it anything", () => {
  const hidden = ROSTER.filter(({ door }) => typeof widgets[door] !== "function").map((one) => one.door);
  // A door reachable only from inside cannot be given the wrong shape by a consumer, and guarding it
  // is still right — but this bench can only exercise the ones a caller can reach.
  assert.deepEqual(hidden.filter((door) => door === "given"), []);
});

for (const { door, fields } of ROSTER) {
  if (typeof widgets[door] !== "function") continue;
  test(`${door}: refuses an object missing a field, and names it`, () => {
    for (const missing of fields) {
      // Every field but one: the refusal has to name the one that is gone, not merely refuse.
      const argument = Object.fromEntries(fields.filter((f) => f !== missing).map((f) => [f, false]));
      assert.throws(
        () => widgets[door](argument),
        (error) => {
          assert.match(String(error.message), new RegExp(`\\.${missing}\\b`));
          assert.match(String(error.message), /expects/);
          return true;
        },
        `${door} accepted an object without .${missing}`,
      );
    }
  });
}

test("a well-formed state still gets two answers, not one", () => {
  // The other direction, and the reason it is here: a guard that threw on everything would pass the
  // tests above and answer nothing. Each door is asked in the two states it exists to tell apart —
  // the pair, not the healthy case, because a door that always says the same thing looks healthy on
  // whichever half you try first.
  const pairs = [
    ["fieldIsRequired",
      [{ required: true, interactivity: "enabled" }, { required: false, interactivity: "enabled" }]],
    ["showsAsInvalid",
      [{ disabled: false, valid: false }, { disabled: false, valid: true }]],
  ];
  for (const [door, [one, other]] of pairs) {
    assert.notEqual(widgets[door](one), widgets[door](other), `${door} answers both states the same`);
  }
});
