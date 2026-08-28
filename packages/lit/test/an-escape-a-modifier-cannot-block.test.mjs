/**
 * Escape closes a panel whatever is held with it, and does so because the catalogue says so.
 *
 * The rule is ADR 0168's: a gesture that *adds* is refused under the platform's accelerator, one
 * that *removes* is honoured whatever is held. Answering a dismissal wrongly costs a reopen;
 * refusing one leaves somebody inside a panel with the way out not working, under a modifier nobody
 * thinks to test.
 *
 * What this check is really about is the second half of that sentence. Every renderer already closed
 * on a modified `Escape` — and kept closing with the declaration deleted from the contract, because
 * each compared the key by hand. Correct, and correct for its own reasons: the catalogue could lose
 * the line and nothing anywhere would move. So the assertion is paired with a deletion, and the
 * deletion is what gives the green its meaning.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const fixture = await import("./support/state-fixture.mjs");
const { MDY_POPUP_OPENERS, MDY_WIDGET_KEYBOARD } = await import("../../widgets/dist/index.js");

const dismissed = [];

async function openThenPress(kind, held) {
  const mounted = await fixture.mount(kind);
  await mounted.settle();
  const opener = fixture.openerOf(mounted.root, kind);
  opener?.focus();
  mounted.drive("open");
  await mounted.settle();
  if (mounted.root.querySelector("[aria-expanded='true']") === null) {
    mounted.dispose();
    return { opened: false };
  }
  const from = mounted.root.ownerDocument.activeElement ?? opener;
  from.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true, ...held }));
  await mounted.settle();
  const stillOpen = mounted.root.querySelector("[aria-expanded='true']") !== null;
  mounted.dispose();
  return { opened: true, stillOpen };
}

for (const kind of Object.keys(MDY_POPUP_OPENERS)) {
  test(`${kind}: Escape closes it whatever is held with it`, async () => {
    for (const held of [{}, { metaKey: true }, { ctrlKey: true }, { altKey: true, shiftKey: true }]) {
      const result = await openThenPress(kind, held);
      if (!result.opened) continue;
      const how = Object.keys(held).join("+").replace(/Key/g, "") || "bare";
      assert.equal(result.stillOpen, false,
        `${kind} stays open on ${how} Escape. The way out is not conditional on what else a hand was `
        + "resting on, and a panel that refuses it is a keyboard trap that only appears under a "
        + "modifier — which is why nobody finds it");
      dismissed.push(`${kind} ${how}`);
    }
  });
}

test("and the catalogue is what says so, not each renderer's own comparison", () => {
  // The property the assertions above cannot show on their own. A renderer comparing the key by hand
  // passes them and keeps passing them when the declaration is deleted — which is the state this
  // whole check was written to leave. Read from the contract here so that deleting the line makes
  // this red *as well as* the ones above, in every renderer at once.
  for (const kind of Object.keys(MDY_POPUP_OPENERS)) {
    const escape = (MDY_WIDGET_KEYBOARD[kind] ?? [])
      .find((binding) => binding.key === "Escape" && binding.when === "open");
    assert.ok(escape !== undefined, `${kind} opens a panel and declares no way out of it`);
    assert.equal(escape.modifier, "any",
      `${kind}'s dismissal does not say it answers a held modifier. A renderer may still close on `
      + "one — every one of them did — but then the behaviour is the renderer's rather than the "
      + "contract's, and the next renderer has no reason to agree");
  }
});

test("and Escape really was dismissing something", () => {
  assert.ok(dismissed.length >= 8,
    `only ${dismissed.length} dismissals were seen — the checks above are then about panels that never opened`);
});
