/**
 * The ghost's length is written straight into a custom property, so it has to be a number CSS accepts.
 *
 * `--tp-ghost-reach` is set from `MdyTimepickerDialGhost.reach` and multiplied by `--tp-hand-length`
 * in the sheet. A declaration whose value does not parse is **dropped**, and a dropped declaration
 * leaves the property at whatever it held before — so a non-finite `reach` does not draw a wrong
 * length, it draws the *previous* length and stops responding. A hand that freezes reads as a hand
 * that is tracking something, which is the worst of the available failures.
 *
 * `1b9ad897` moved the guard from magnitude to presence, which is right and is what ADR 0121 asks for:
 *
 *     const reach = hand > 0 && pointer !== undefined ? Math.min(Math.max(pointer, 0) / hand, 1) : 1;
 *
 * `pointer !== undefined` is true of `NaN`, so `NaN` now flows through the arithmetic and out. The
 * previous guard, `pointer > 0`, was false for `NaN` and answered `1` — the wrong length, but a finite
 * one that the sheet would take.
 *
 * That is ADR 0121 read from the other end. The record says a legitimate value must not be
 * indistinguishable from its own absence; the dual is that an **illegitimate** value must not be
 * indistinguishable from a legitimate one. A presence check answers the first question and not the
 * second, and `NaN` is exactly the value that is present without being a number.
 *
 * Asserted as *the result is a finite fraction* over every input the parameter's type admits, rather
 * than as the `NaN` case, so it also holds for `Infinity` and for whatever the next caller passes.
 *
 * Reachability is honest: the shipped renderers derive `pointerReach` from a rect whose fields are
 * always defined, so this is a contract defect rather than a reproduction of something a person has
 * seen. It is filed because a function that feeds CSS owes CSS a usable number, and because the same
 * arithmetic is what a new adapter will call first.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const { timepickerDialPick, timepickerDialGhost, MDY_EVERY_TIME } = await import("@modyra/widgets");

const HAND = 100;

battle(
  {
    claims: ["UI-011"],
    title: "the ghost's length is a number a stylesheet can use",
    environments: ["node"],
  },
  async (ctx) => {
    const pick = timepickerDialPick(210, "hour", "24h", "outer", MDY_EVERY_TIME);
    expectClaim(pick !== null, {
      claimIds: ["UI-011"],
      what: "no pick came back for a plain 24-hour face, so there is no ghost to measure",
      detail: JSON.stringify(pick),
    });

    const cases = [
      { label: "a pointer at the centre", pointerReach: 0, handLength: HAND },
      { label: "an ordinary pointer", pointerReach: 50, handLength: HAND },
      { label: "a pointer past the face", pointerReach: 400, handLength: HAND },
      { label: "a negative distance", pointerReach: -5, handLength: HAND },
      { label: "an unmeasured face", pointerReach: 50, handLength: 0 },
      { label: "no pointer offered", pointerReach: undefined, handLength: HAND },
      { label: "a distance that is not a number", pointerReach: Number.NaN, handLength: HAND },
      { label: "an infinite distance", pointerReach: Number.POSITIVE_INFINITY, handLength: HAND },
      { label: "a face whose size is not a number", pointerReach: 50, handLength: Number.NaN },
    ];

    const seen = cases.map((one) => ({
      label: one.label,
      reach: timepickerDialGhost(215, pick, { ring: "outer", within: 0, ...one })?.reach ?? null,
    }));
    ctx.log.note("what the sheet would be handed", seen.map((one) => `${one.label}: ${String(one.reach)}`));

    for (const one of cases) {
      const ghost = timepickerDialGhost(215, pick, { ring: "outer", within: 0, ...one });
      expectClaim(ghost !== null, {
        claimIds: ["UI-011"],
        what: "the ghost vanished for an input the signature accepts, so there is nothing to draw",
        detail: one.label,
      });

      // The whole property: whatever it is handed, what comes out is a fraction of the hand that a
      // declaration can carry. `--tp-ghost-reach: NaN` is dropped, and a dropped declaration leaves
      // the last good value in place — a hand that has stopped following, looking like one that has not.
      expectClaim(Number.isFinite(ghost.reach), {
        claimIds: ["UI-011"],
        what: "the ghost's length is not a finite number, so the declaration is dropped and the hand keeps the length it last had instead of following the pointer",
        detail: `${one.label} → --tp-ghost-reach: ${String(ghost.reach)}`,
      });

      expectClaim(ghost.reach >= 0 && ghost.reach <= 1, {
        claimIds: ["UI-011"],
        what: "the ghost's length is outside the hand it is a fraction of",
        detail: `${one.label} → ${String(ghost.reach)}`,
      });
    }
  },
);
