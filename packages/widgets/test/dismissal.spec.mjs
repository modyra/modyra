/**
 * Light dismiss, against the normative truth tables.
 *
 * The policy is stated as tables over an interaction's origin and completion, and these assert them
 * row by row. Asserted against the rule directly rather than through a renderer: a renderer test
 * proves the wiring, and would pass just as happily on a rule that was wrong in the same way in
 * every adapter.
 *
 * The negative rows carry the weight. A dismissal rule is easy to make pass by closing eagerly —
 * what is hard, and what the tables exist for, is the set of interactions that must **not** close it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createLightDismiss, isPrimaryInteraction } from "../dist/index.js";

const IN = "inside";
const OUT = "outside";
const PRIMARY = { pointerId: 1, isPrimary: true, button: 0 };

function overlay({ open = true } = {}) {
  let dismissed = 0;
  const policy = createLightDismiss({
    isInside: (target) => target === IN,
    dismiss: () => { dismissed += 1; },
    isOpen: () => open,
  });
  return {
    ...policy,
    get dismissed() { return dismissed; },
    close() { open = false; },
    open() { open = true; },
  };
}

/** One interaction: press, then complete. */
function interact(o, { from, to, origin = PRIMARY }) {
  o.pointerdown(from, origin);
  o.click(to);
}

// ─── §4: the main table ──────────────────────────────────────────────────────

test("§4 — a closed overlay is never dismissed, whatever the interaction", () => {
  for (const [from, to] of [[IN, IN], [IN, OUT], [OUT, IN], [OUT, OUT]]) {
    const o = overlay({ open: false });
    interact(o, { from, to });
    assert.equal(o.dismissed, 0, `closed overlay, ${from} -> ${to}`);
  }
});

test("§4 — only outside -> outside dismisses", () => {
  const rows = [
    [IN, IN, 0, "wholly internal"],
    [IN, OUT, 0, "drag from inside to outside"],
    [OUT, IN, 0, "began outside, completed inside"],
    [OUT, OUT, 1, "complete outside interaction"],
  ];
  for (const [from, to, expected, why] of rows) {
    const o = overlay();
    interact(o, { from, to });
    assert.equal(o.dismissed, expected, why);
  }
});

// ─── §6: pointer type and button ─────────────────────────────────────────────

test("§6 — only a primary pointer on the primary button can dismiss", () => {
  const rows = [
    [{ pointerId: 1, isPrimary: true, button: 0 }, 1, "primary pointer, primary button"],
    [{ pointerId: 1, isPrimary: true, button: 1 }, 0, "middle button"],
    [{ pointerId: 1, isPrimary: true, button: 2 }, 0, "right button"],
    [{ pointerId: 2, isPrimary: false, button: 0 }, 0, "secondary pointer"],
    [{ pointerId: 2, isPrimary: false, button: 2 }, 0, "secondary pointer, right button"],
  ];
  for (const [origin, expected, why] of rows) {
    const o = overlay();
    interact(o, { from: OUT, to: OUT, origin });
    assert.equal(o.dismissed, expected, why);
  }
});

test("§6 — the predicate itself", () => {
  assert.equal(isPrimaryInteraction({ pointerId: 1, isPrimary: true, button: 0 }), true);
  assert.equal(isPrimaryInteraction({ pointerId: 1, isPrimary: true, button: 2 }), false);
  assert.equal(isPrimaryInteraction({ pointerId: 3, isPrimary: false, button: 0 }), false);
});

// ─── §16: cancellation ───────────────────────────────────────────────────────

test("§16 — pointercancel never dismisses, from either origin", () => {
  for (const from of [IN, OUT]) {
    const o = overlay();
    o.pointerdown(from, PRIMARY);
    o.pointercancel(PRIMARY.pointerId);
    o.click(OUT);
    assert.equal(o.dismissed, 0, `cancelled from ${from}`);
  }
});

test("§16 — a pointercancel from a different pointer does not clear the tracked one", () => {
  const o = overlay();
  o.pointerdown(OUT, PRIMARY);
  o.pointercancel(99);
  o.click(OUT);
  assert.equal(o.dismissed, 1, "the tracked interaction was never cancelled");
});

test("§16 — reset abandons an interaction in flight", () => {
  // window.blur, document hidden, unmount.
  const o = overlay();
  o.pointerdown(OUT, PRIMARY);
  o.reset();
  o.click(OUT);
  assert.equal(o.dismissed, 0);
});

test("§16 — a new press supersedes an incomplete one", () => {
  const o = overlay();
  o.pointerdown(OUT, PRIMARY);
  o.pointerdown(IN, PRIMARY);
  o.click(OUT);
  assert.equal(o.dismissed, 0, "the surviving origin is the second, which was inside");
});

// ─── §15: clicks with no pointer interaction behind them ─────────────────────

test("§15 — a click with no observed interaction does not dismiss", () => {
  // A keyboard activation, or `.click()` from application code. The capability names a *pointer*
  // interaction, so an activation that had none cannot satisfy it.
  const o = overlay();
  o.click(OUT);
  assert.equal(o.dismissed, 0);
});

// ─── §19: the state machine ──────────────────────────────────────────────────

test("§19 — phases follow the declared transitions", () => {
  const o = overlay();
  assert.equal(o.phase(), "idle");

  o.pointerdown(IN, PRIMARY);
  assert.equal(o.phase(), "tracking-inside");
  o.click(IN);
  assert.equal(o.phase(), "idle");

  o.pointerdown(OUT, PRIMARY);
  assert.equal(o.phase(), "tracking-outside");
  o.pointercancel(PRIMARY.pointerId);
  assert.equal(o.phase(), "idle", "cancelled, then cleaned up");

  o.pointerdown(OUT, PRIMARY);
  o.click(OUT);
  assert.equal(o.phase(), "idle", "dismissed, then cleaned up");
  assert.equal(o.dismissed, 1);
});

test("§19 — a non-primary press leaves the machine idle", () => {
  const o = overlay();
  o.pointerdown(OUT, { pointerId: 1, isPrimary: true, button: 2 });
  assert.equal(o.phase(), "idle");
});

// ─── §18: one interaction produces at most one dismissal ─────────────────────

test("§18 — a single interaction dismisses at most once", () => {
  const o = overlay();
  o.pointerdown(OUT, PRIMARY);
  o.click(OUT);
  o.click(OUT);
  assert.equal(o.dismissed, 1, "the second click has no interaction of its own");
});

test("§18 — an overlay closed mid-interaction is not dismissed again", () => {
  const o = overlay();
  o.pointerdown(OUT, PRIMARY);
  o.close();
  o.click(OUT);
  assert.equal(o.dismissed, 0);
});

// ─── §21: the negative tests the suite must fail on ──────────────────────────

test("§21.1 — an outside press alone, with no completion, does not dismiss", () => {
  const o = overlay();
  o.pointerdown(OUT, PRIMARY);
  assert.equal(o.dismissed, 0, "nothing is decided until the interaction completes");
});

test("§21.2 — a drag begun inside and ended outside does not dismiss", () => {
  const o = overlay();
  interact(o, { from: IN, to: OUT });
  assert.equal(o.dismissed, 0);
});

test("§21.7 — a cancelled interaction does not dismiss", () => {
  const o = overlay();
  o.pointerdown(OUT, PRIMARY);
  o.pointercancel(PRIMARY.pointerId);
  assert.equal(o.dismissed, 0);
});

test("§21.8 — the trigger is inside the branch, so activating it is not an outside interaction", () => {
  // The renderer's `isInside` is what carries this; the rule only has to honour it.
  let dismissed = 0;
  const policy = createLightDismiss({
    isInside: (target) => target === IN || target === "trigger",
    dismiss: () => { dismissed += 1; },
    isOpen: () => true,
  });
  policy.pointerdown("trigger", PRIMARY);
  policy.click("trigger");
  assert.equal(dismissed, 0);
});
