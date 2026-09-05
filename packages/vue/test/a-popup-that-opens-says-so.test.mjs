import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();

const config = await import("../conformance.config.mjs");
const { MDY_I18N_MESSAGES_DEFAULT, MDY_SHARED_REGION_ID, MDY_POPUP_OPENERS } = await import("@modyra/widgets");

/**
 * A popup that opens says so.
 *
 * `overlayLifecycleTransition` — the one policy every adapter opens and closes by — returns an
 * `announce` alongside the new state, and the words are published in five languages. The announcer
 * is shipped and wired. This renderer computed the answer and dropped it.
 *
 * Belt and braces rather than a blackout, and that is why it went unnoticed: `aria-expanded` already
 * changes, so a reader that *inspects* the control learns the state. What was missing is being told
 * — the difference between information available on request and information delivered when it
 * changes, which for a panel that appears elsewhere on the page is the difference between noticing
 * and not.
 */
const KINDS = Object.keys(MDY_POPUP_OPENERS).filter((kind) => config.kinds.includes(kind));

const spoken = () => (document.getElementById(MDY_SHARED_REGION_ID)?.textContent ?? "").trim();

test("this config draws kinds that open, or the bench guards nothing", () => {
  assert.ok(KINDS.length > 0);
});

for (const kind of KINDS) {
  test(`${kind}: opening is announced`, async () => {
    document.getElementById(MDY_SHARED_REGION_ID)?.remove();
    const fixture = await config.mount(kind, {});
    await fixture.settle?.();
    assert.equal(spoken(), "", `${kind}: something was announced before anything happened`);

    assert.ok(fixture.drive?.("open"), `${kind}: cannot be opened`);
    await fixture.settle?.();
    // The live region is drained on a timer, and measured that drain lands at ~120ms: the words are
    // queued when the state moves and written a beat later. Read sooner, this bench reported an
    // empty region for a renderer that had announced correctly — the instrument's clock, not the
    // subject. Waited generously rather than tuned to the measurement, so a slower machine does not
    // turn a green into a red.
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(spoken(), MDY_I18N_MESSAGES_DEFAULT.overlayOpened);
    fixture.dispose?.();
  });
}
