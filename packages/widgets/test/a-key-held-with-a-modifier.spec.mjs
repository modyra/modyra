/**
 * A key declared bare does not answer a press with a modifier held.
 *
 * `Cmd+Space` switches the platform's input source, `Cmd+ArrowDown` goes to the end of a document,
 * `Cmd+Z` undoes. Somebody holding the modifier is reaching for one of those. A control that also
 * answers with its own bare-key meaning makes the press do two things, and the second was not asked
 * for — the panel opens under the gesture that was meant to leave it.
 *
 * `matchesKeyGesture` has always said so: a binding that declares `modifier: "primary"` requires the
 * modifier, and one that declares none requires its absence. What it did not have was a road. The
 * question every renderer actually asks — "does this kind mean anything by this key" — took a
 * *string*, so the modifier never reached the only function that reads it. Mutating that function
 * moved no check in either tier, because nothing on the deciding path called it.
 *
 * So this asserts the road, not the rule: asked with the event, the answer changes; asked with a
 * bare key, it does not, because a caller naming a literal is asking what the contract declares
 * rather than what somebody just pressed.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { keyBindingFor, keyMeans, MDY_POPUP_OPENERS, matchesKeyGesture } from "../dist/index.js";

/** The kinds that open something, from the catalogue rather than a list kept here. */
const OPENING = Object.keys(MDY_POPUP_OPENERS);

const press = (key, extra = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...extra });

test("the resolver already refuses a bare binding under a held modifier", () => {
  // The rule, stated where it lives. If this ever fails, the road below is carrying the wrong answer
  // rather than no answer, which is a different repair.
  const bare = { key: "Enter", intent: "open" };
  assert.equal(matchesKeyGesture(bare, press("Enter")), true);
  assert.equal(matchesKeyGesture(bare, press("Enter", { metaKey: true })), false);
  assert.equal(matchesKeyGesture(bare, press("Enter", { ctrlKey: true })), false);
});

test("a kind does not mean `open` by a key pressed with the modifier held", () => {
  const answering = [];
  for (const kind of OPENING) {
    for (const key of ["Enter", " ", "ArrowDown", "ArrowUp"]) {
      if (!keyMeans(kind, press(key), "open", false)) continue;
      answering.push(`${kind} bare ${key === " " ? "Space" : key}`);
      for (const held of [{ metaKey: true }, { ctrlKey: true }]) {
        if (keyMeans(kind, press(key, held), "open", false)) {
          assert.fail(`${kind} opens on ${Object.keys(held)[0]}+${key === " " ? "Space" : key}. `
            + "That press belongs to the platform, and the panel arrives under the gesture that was "
            + "meant to leave it");
        }
      }
    }
  }
  // The other direction, so a renderer cannot satisfy this by answering no key at all.
  assert.ok(answering.length >= 6,
    `only ${answering.length} bare opening gestures answer — this asserts nothing about refusing them`);
});

test("a caller naming a literal still asks what the contract declares", () => {
  // Two questions in one function, and they have to stay distinguishable: `keyMeans(kind, "Tab", …)`
  // is a renderer asking whether the table says anything about Tab, with no press in hand. Made to
  // mean "a bare Tab press" it would answer the same, and made to require an event it would break
  // every site that has none.
  const kind = OPENING[0];
  assert.equal(keyBindingFor(kind, "Enter", false)?.intent, "open");
  assert.equal(keyMeans(kind, "Enter", "open", false), true);
});
