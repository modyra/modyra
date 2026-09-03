/**
 * No press is answered by two declarations of the same kind.
 *
 * A binding is found by asking the catalogue what answers a press, and the answer is the *first*
 * declaration that matches. So two declarations that both match one press are not two behaviours —
 * they are one behaviour and one dead declaration, and which of them is dead depends on the order
 * they happen to be pushed in. That is the shape this suite keeps finding under other names: a rule
 * that exists, reads correctly, and is reached by nothing.
 *
 * **What this does not forbid, and the distinction is the whole design.** A bare declaration answers
 * a press carrying `Shift` or `Alt`, deliberately: those modify the *act* rather than choosing a
 * different gesture. `PageUp` moves the calendar a month and `Shift+PageUp` moves it a year — one
 * binding, two magnitudes, the modifier read by whoever carries the movement out. Only `Ctrl` and
 * `Meta` select between declarations, because only those are the platform's own accelerator.
 *
 * So the guard is on the pairs, not on the modifiers: two declarations that a single press can both
 * satisfy, for the same kind, the same phase and the same part.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MDY_WIDGET_KEYBOARD, matchesKeyGesture } from "../dist/index.js";

/** Every gesture a press can carry, as the matcher reads them. */
const HOLDS = [
  { name: "bare", held: {} },
  { name: "Ctrl", held: { ctrlKey: true } },
  { name: "Meta", held: { metaKey: true } },
  { name: "Shift", held: { shiftKey: true } },
  { name: "Alt", held: { altKey: true } },
  { name: "Ctrl+Shift", held: { ctrlKey: true, shiftKey: true } },
  { name: "Ctrl+Alt", held: { ctrlKey: true, altKey: true } },
];

const press = (key, held) => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...held });

/** A binding's address: two bindings only compete when a person could be standing in one place. */
const addressOf = (binding) => `${binding.when ?? "either"}/${binding.on ?? "the control"}`;

test("the table declares at least one gesture that is not bare, or this measures nothing", () => {
  // The premise. If every binding were bare, every pair below would be decided by the key name alone
  // and this file would be asserting that two identical strings are not equal.
  const modified = Object.values(MDY_WIDGET_KEYBOARD).flat().filter((one) => one.modifier !== undefined);
  assert.ok(modified.length > 0, "no binding declares a modifier, so nothing here separates two declarations");
});

for (const kind of Object.keys(MDY_WIDGET_KEYBOARD)) {
  test(`${kind}: one press, one declaration`, () => {
    const bindings = MDY_WIDGET_KEYBOARD[kind];
    const shadowed = [];

    for (let i = 0; i < bindings.length; i += 1) {
      for (let j = i + 1; j < bindings.length; j += 1) {
        const [first, second] = [bindings[i], bindings[j]];
        // Different key, phase or part means a person could never make one press that reaches both.
        if (first.key !== second.key) continue;
        if (addressOf(first) !== addressOf(second)) continue;
        for (const { name, held } of HOLDS) {
          const event = press(first.key, held);
          if (matchesKeyGesture(first, event) && matchesKeyGesture(second, event)) {
            shadowed.push(
              `${name}+${first.key} at ${addressOf(first)} is answered by both `
              + `${first.intent}${first.modifier ? `(${first.modifier})` : "(bare)"} and `
              + `${second.intent}${second.modifier ? `(${second.modifier})` : "(bare)"} — `
              + "the first wins and the second is a declaration nothing can reach",
            );
          }
        }
      }
    }

    assert.deepEqual(shadowed, [], shadowed.join("\n"));
  });
}
