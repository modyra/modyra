/**
 * A panel does not open under a press that belongs to the platform.
 *
 * `Cmd+Space` switches the input source, `Cmd+ArrowDown` goes to the end of a document, `Cmd+Z`
 * undoes. Somebody holding the modifier is reaching for one of those. A control that also answers
 * with its own bare-key meaning makes the press do two things, and the panel arrives under the
 * gesture that was meant to leave it.
 *
 * Asked of the renderer rather than of the resolver, because the resolver was already right and was
 * on no road: the question every renderer asks took a *key name*, so what was held with the press
 * never reached the only function that reads it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const fixture = await import("./support/state-fixture.mjs");
const { MDY_POPUP_OPENERS } = await import("../../widgets/dist/index.js");

const OPENING_KEYS = ["Enter", " ", "ArrowDown", "ArrowUp"];
const demonstrated = [];

async function pressOn(kind, key, held) {
  const mounted = await fixture.mount(kind);
  await mounted.settle();
  const opener = fixture.openerOf(mounted.root, kind);
  opener?.focus();
  opener?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...held }));
  await mounted.settle();
  const opened = mounted.root.querySelector("[aria-expanded='true']") !== null;
  mounted.dispose();
  return { opened, reachable: opener !== null && opener !== undefined };
}

for (const kind of Object.keys(MDY_POPUP_OPENERS)) {
  test(`${kind}: a key that opens it does not open it with the modifier held`, async () => {
    for (const key of OPENING_KEYS) {
      const plain = await pressOn(kind, key, {});
      assert.ok(plain.reachable, `${kind} declares an opener the page does not carry`);
      if (plain.opened) demonstrated.push(`${kind} ${key === " " ? "Space" : key}`);

      for (const held of [{ metaKey: true }, { ctrlKey: true }]) {
        const modified = await pressOn(kind, key, held);
        assert.equal(modified.opened, false,
          `${kind} opens on ${Object.keys(held)[0].replace("Key", "")}+${key === " " ? "Space" : key}. `
          + "That press belongs to the platform, and the panel arrives under the gesture that was "
          + "meant to leave it");
      }
    }
  });
}

test("and a bare press really does open something here", () => {
  // The anti-tautology control for the whole file: if nothing opens, every refusal above is a
  // renderer answering no key at all, which would satisfy them and satisfy nobody using it.
  assert.ok(demonstrated.length >= 4,
    `only ${demonstrated.length} bare opening gestures were seen (${demonstrated.join(", ")}) — the `
    + "refusals above are then about presses that do nothing either way");
});
