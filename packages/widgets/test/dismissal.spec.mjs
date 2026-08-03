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

// ─── §13/§24: focus must not outrank a pointer ───────────────────────────────

test("§13 — an interaction begun inside suppresses focus dismissal until it resolves", () => {
  const o = overlay();
  assert.equal(o.interactionFromInside(), false, "nothing in flight");

  o.pointerdown(IN, PRIMARY);
  assert.equal(o.interactionFromInside(), true, "focus must not close now");

  // §24's critical sequence: the drag continues outside, focus leaves, and the release is outside.
  o.click(OUT);
  assert.equal(o.dismissed, 0, "began inside, so it never dismisses");
  assert.equal(o.interactionFromInside(), false, "resolved — focus may decide again");
});

test("§13 — an interaction begun outside does not suppress focus dismissal", () => {
  // Focus leaving is a different question. Only an *inside* origin has a claim on the popup.
  const o = overlay();
  o.pointerdown(OUT, PRIMARY);
  assert.equal(o.interactionFromInside(), false);
});

test("§13 — a cancelled inside interaction releases the suppression", () => {
  const o = overlay();
  o.pointerdown(IN, PRIMARY);
  assert.equal(o.interactionFromInside(), true);
  o.pointercancel(PRIMARY.pointerId);
  assert.equal(o.interactionFromInside(), false, "cancelled, so focus is free to decide");
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

// ─── §4: completion is the pointer's release, and `click` is the tail ────────

test("§4 — a release outside completes the interaction, with no click at all", () => {
  // WebKit synthesises no mouse events and no `click` for a tap on an element it does not consider
  // clickable — a page's own background included. Waiting for a click there waits forever, which is
  // why nothing dismissed on Safari.
  const o = overlay();
  o.pointerdown(OUT, PRIMARY);
  o.pointerup(OUT, PRIMARY.pointerId);
  assert.equal(o.dismissed, 1);
});

test("§4 — a release completes only what its own pointer began", () => {
  const o = overlay();
  o.pointerdown(OUT, PRIMARY);
  o.pointerup(OUT, 99);
  assert.equal(o.dismissed, 0, "a second finger lifting is not the first one's answer");
  o.pointerup(OUT, PRIMARY.pointerId);
  assert.equal(o.dismissed, 1);
});

test("§4 — a release inside the branch completes without dismissing", () => {
  // Pressed outside, released in the popup. The interaction ended inside, and the rule is about
  // where it *ends* as much as where it began.
  const o = overlay();
  o.pointerdown(OUT, PRIMARY);
  o.pointerup(IN, PRIMARY.pointerId);
  assert.equal(o.dismissed, 0);
  assert.equal(o.phase(), "idle", "and it is resolved, not left armed for a later click");
});

test("§18 — release and click together still dismiss at most once", () => {
  // Every engine but WebKit sends both. The release decides and leaves the machine idle; the click
  // that follows finds nothing to resolve.
  const o = overlay();
  o.pointerdown(OUT, PRIMARY);
  o.pointerup(OUT, PRIMARY.pointerId);
  o.click(OUT);
  assert.equal(o.dismissed, 1);
});

test("§16 — a cancelled gesture is not completed by the release that follows", () => {
  // The scroll case, and the reason completion could move off `click`: a browser that takes a
  // gesture over to scroll says so directly, rather than by withholding a click.
  const o = overlay();
  o.pointerdown(OUT, PRIMARY);
  o.pointercancel(PRIMARY.pointerId);
  o.pointerup(OUT, PRIMARY.pointerId);
  assert.equal(o.dismissed, 0);
});

test("§15 — a release with no observed press does not dismiss", () => {
  const o = overlay();
  o.pointerup(OUT, PRIMARY.pointerId);
  assert.equal(o.dismissed, 0);
});
