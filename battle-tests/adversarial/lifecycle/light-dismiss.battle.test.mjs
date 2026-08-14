/**
 * Closing a popup because of something that happened outside it — and only then.
 *
 * `createLightDismiss` decides whether a pointer interaction closes an overlay, and the rule is
 * narrower than "a click landed outside": the interaction has to have *begun* outside as well.
 * Selecting text inside a popup and releasing past its edge is one gesture that ends outside and
 * started inside, and closing on it takes the popup away mid-drag.
 *
 * Several rules interact, each written against a specific way of getting it wrong, and none of them
 * had a battle:
 *
 *   - a right-click or middle-click begins no interaction — dismissing on one closes the popup
 *     underneath the context menu the user just asked for;
 *   - a second finger lifting is not the first finger's answer;
 *   - a `click` with no observed press is a keyboard activation or a scripted `.click()`, and must
 *     not satisfy a rule about *pointer* interactions;
 *   - `pointercancel` decides nothing: the browser took the gesture, so there is no answer to give;
 *   - while an interaction that began inside is unresolved, focus leaving the branch must not close
 *     the overlay either, or the focus path reinstates the dismissal the pointer path refuses.
 *
 * The first battle drives 5000 randomised event sequences against a model written from those
 * sentences rather than from the implementation — the gate is "primary pointer, primary button"
 * because the prose says so, not because the code does. The second pins each named scenario
 * directly, so a failure says which rule broke rather than only that something did.
 */

import { createLightDismiss, isPrimaryInteraction } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** A press that begins an interaction, unless told otherwise. */
const press = (over = {}) => ({ pointerId: 1, button: 0, isPrimary: true, ...over });

/** A dismisser over a branch where the string "in" is inside and everything else is out. */
function dismisser(open = { value: true }) {
  const closed = [];
  const machine = createLightDismiss({
    isOpen: () => open.value,
    isInside: (target) => target === "in",
    dismiss: () => closed.push(true),
  });
  return { machine, open, dismissals: () => closed.length };
}

/**
 * The documented rule, written independently: a dismissal happens exactly when a primary press
 * began outside an open branch and the interaction it started ended outside.
 */
function referenceModel() {
  let armed = null;
  let tracked = null;
  return {
    pointerdown(inside, origin, open) {
      if (!open || !(origin.isPrimary && origin.button === 0)) {
        armed = null;
        tracked = null;
        return false;
      }
      tracked = origin.pointerId;
      armed = inside ? "inside" : "outside";
      return false;
    },
    pointerup(inside, pointerId, open) {
      if (pointerId !== undefined && tracked !== null && pointerId !== tracked) return false;
      const was = armed;
      armed = null;
      tracked = null;
      return was === "outside" && open && !inside;
    },
    click(inside, open) {
      const was = armed;
      armed = null;
      tracked = null;
      return was === "outside" && open && !inside;
    },
    pointercancel(pointerId) {
      if (tracked !== null && pointerId !== tracked) return false;
      armed = null;
      tracked = null;
      return false;
    },
    reset() {
      armed = null;
      tracked = null;
      return false;
    },
    fromInside: () => armed === "inside",
  };
}

battle(
  {
    claims: ["UI-005"],
    title: "the machine agrees with the rule it is documented to implement",
    environments: ["node"],
  },
  async (ctx) => {
    let seed = 20260814;
    const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const pick = (choices) => choices[Math.floor(random() * choices.length)];

    let steps = 0;
    let dismissed = 0;
    const divergences = [];

    for (let run = 0; run < 500 && divergences.length === 0; run += 1) {
      const state = dismisser({ value: true });
      const reference = referenceModel();
      const log = [];

      for (let step = 0; step < 10; step += 1) {
        const inside = random() < 0.5;
        const target = inside ? "in" : "out";
        const pointerId = pick([1, 1, 1, 2]);
        const before = state.dismissals();
        let expected = false;

        switch (pick(["down", "up", "click", "cancel", "reset", "toggle"])) {
          case "down": {
            const origin = press({ pointerId, button: pick([0, 0, 0, 2]), isPrimary: pick([true, true, false]) });
            expected = reference.pointerdown(inside, origin, state.open.value);
            state.machine.pointerdown(target, origin);
            log.push(`down ${target} p${pointerId} b${origin.button}${origin.isPrimary ? "" : " secondary"}`);
            break;
          }
          case "up":
            expected = reference.pointerup(inside, pointerId, state.open.value);
            state.machine.pointerup(target, pointerId);
            log.push(`up ${target} p${pointerId}`);
            break;
          case "click":
            expected = reference.click(inside, state.open.value);
            state.machine.click(target);
            log.push(`click ${target}`);
            break;
          case "cancel":
            expected = reference.pointercancel(pointerId);
            state.machine.pointercancel(pointerId);
            log.push(`cancel p${pointerId}`);
            break;
          case "reset":
            expected = reference.reset();
            state.machine.reset();
            log.push("reset");
            break;
          default:
            state.open.value = !state.open.value;
            log.push(`open=${state.open.value}`);
        }

        steps += 1;
        const actually = state.dismissals() > before;
        if (actually) dismissed += 1;
        if (actually !== expected || state.machine.interactionFromInside() !== reference.fromInside()) {
          divergences.push({ log: [...log], actually, expected });
          break;
        }
      }
    }

    ctx.log.note("randomised pointer sequences against the documented rule", { steps, dismissed });

    // The control: the sequences reach a dismissal sometimes, so agreeing is agreeing about
    // something rather than about a machine that never fires.
    expectClaim(dismissed > 0, {
      claimIds: ["UI-005"],
      what: "no sequence produced a dismissal, so the comparison is between two machines that never act",
      detail: JSON.stringify({ steps, dismissed }),
    });

    expectEqual(divergences, [], {
      claimIds: ["UI-005"],
      what: "the machine and the rule it documents disagree about a pointer sequence",
      detail: JSON.stringify(divergences.slice(0, 2)),
    });
  },
);

battle(
  {
    claims: ["UI-005"],
    title: "each way of getting this wrong stays wrong",
    environments: ["node"],
  },
  async (ctx) => {
    // A gesture that starts inside and ends outside: selecting text in a popup and releasing past
    // its edge. Closing here takes the popup away mid-drag.
    const drag = dismisser();
    drag.machine.pointerdown("in", press());
    drag.machine.pointerup("out", 1);
    ctx.log.note("a drag out of the popup", { dismissals: drag.dismissals() });

    expectEqual(drag.dismissals(), 0, {
      claimIds: ["UI-005"],
      what: "a gesture that began inside the popup closed it by ending outside",
    });

    // The control for that one: the same release, from a press that began outside, does close it.
    const outside = dismisser();
    outside.machine.pointerdown("out", press());
    outside.machine.pointerup("out", 1);
    ctx.log.note("a press and release both outside", { dismissals: outside.dismissals() });

    expectEqual(outside.dismissals(), 1, {
      claimIds: ["UI-005"],
      what: "an interaction entirely outside the popup did not close it",
    });

    // A right-click and a middle-click begin no interaction, so the popup survives the context
    // menu the user just asked for.
    for (const button of [1, 2]) {
      const secondary = dismisser();
      secondary.machine.pointerdown("out", press({ button }));
      secondary.machine.pointerup("out", 1);
      ctx.log.note("a non-primary button outside", { button, dismissals: secondary.dismissals() });

      expectEqual(secondary.dismissals(), 0, {
        claimIds: ["UI-005"],
        what: `button ${button} outside the popup closed it`,
      });
    }

    // A second finger lifting is not the first one's answer.
    const twoFingers = dismisser();
    twoFingers.machine.pointerdown("out", press({ pointerId: 1 }));
    twoFingers.machine.pointerup("out", 2);
    ctx.log.note("a second pointer releasing", { dismissals: twoFingers.dismissals() });

    expectEqual(twoFingers.dismissals(), 0, {
      claimIds: ["UI-005"],
      what: "a second pointer's release completed the first pointer's interaction",
    });

    // A click with no press observed is a keyboard activation or a scripted `.click()`.
    const scripted = dismisser();
    scripted.machine.click("out");
    ctx.log.note("a click with no press before it", { dismissals: scripted.dismissals() });

    expectEqual(scripted.dismissals(), 0, {
      claimIds: ["UI-005"],
      what: "a click with no pointer interaction behind it closed the popup",
    });

    // The browser taking the gesture decides nothing, and leaves nothing armed behind it.
    const cancelled = dismisser();
    cancelled.machine.pointerdown("out", press());
    cancelled.machine.pointercancel(1);
    cancelled.machine.click("out");
    ctx.log.note("a cancelled gesture followed by a click", { dismissals: cancelled.dismissals() });

    expectEqual(cancelled.dismissals(), 0, {
      claimIds: ["UI-005"],
      what: "a cancelled gesture still closed the popup through the click that followed it",
    });

    // And the precedence rule the focus path depends on: while a press that began inside is
    // unresolved, focus leaving must not be read as a dismissal.
    const holding = dismisser();
    holding.machine.pointerdown("in", press());
    ctx.log.note("an unresolved press that began inside", {
      fromInside: holding.machine.interactionFromInside(),
    });

    expectClaim(holding.machine.interactionFromInside() === true, {
      claimIds: ["UI-005"],
      what: "an unresolved press that began inside is not reported as such, so the focus path may close the overlay",
    });

    holding.machine.pointerup("in", 1);
    expectClaim(holding.machine.interactionFromInside() === false, {
      claimIds: ["UI-005"],
      what: "a resolved interaction is still reported as unresolved, which blocks the focus path forever",
    });

    // The gate itself, since both battles lean on it.
    expectEqual(
      [isPrimaryInteraction(press()), isPrimaryInteraction(press({ button: 2 })), isPrimaryInteraction(press({ isPrimary: false }))],
      [true, false, false],
      {
        claimIds: ["UI-005"],
        what: "the primary-interaction gate no longer answers for the primary pointer and button alone",
      },
    );
  },
);
