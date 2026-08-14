/**
 * Focus, borrowed by a widget and handed back.
 *
 * `createFocusCustodian`'s own sentence is the claim: focus is borrowed, not taken. A widget records
 * who held it, moves it, and gives it back when it closes — and the failure the module exists to
 * prevent is focus ending up on `<body>`, where a keyboard user has to start again from the top of
 * the page.
 *
 * ADR 0013 lists nested popups and the order they dismiss in as not covered, so this attacks that
 * first: two overlays closed out of order, an overlay whose remembered target lives inside another
 * that is still open, and a target that was removed while the widget was open. All three hold, and
 * are here because the module's fallbacks are the part a single-overlay test never exercises.
 *
 * What does not hold is repetition. A widget that closes and is then disposed calls `restore` twice
 * — the two paths do not know about each other — and the second call takes focus back into the
 * widget it had just handed it away from.
 *
 * Out of scope, and said so by the module rather than by this battle: whether a candidate is
 * visible. `isReachable` reads `isConnected`, `disabled`, `aria-hidden` and the `hidden` attribute,
 * and the docblock calls itself "deliberately not a full tabbability implementation".
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { installDocument } from "../../harness/dom-env.mjs";

const env = installDocument();
const widgets = await import("@modyra/widgets");
const { createFocusCustodian } = widgets;

/** A fresh page: a trigger holding focus, and a widget root beside it. */
function staged({ inside = "inside" } = {}) {
  env.document.body.innerHTML = "";
  const make = (tag, id) => {
    const element = env.document.createElement(tag);
    element.id = id;
    return element;
  };
  const trigger = make("button", "trigger");
  const root = make("div", "panel");
  const within = make("button", inside);
  root.append(within);
  env.document.body.append(trigger, root);
  trigger.focus();
  return { trigger, root, within };
}

const activeId = () => env.document.activeElement?.id || env.document.activeElement?.tagName || "(none)";

battle(
  {
    claims: ["A11Y-002"],
    title: "a widget hands focus back to somewhere real, however its page came apart",
    environments: ["node"],
  },
  async (ctx) => {
    // The one the module names: the element that held focus is gone by the time the widget closes.
    const gone = staged();
    const custodian = createFocusCustodian(() => gone.root);
    custodian.remember();
    gone.within.focus();
    gone.trigger.remove();
    ctx.log.note("the remembered element left while the widget was open", {});

    const landedAfterRemoval = custodian.restore();
    expectClaim(landedAfterRemoval !== null && activeId() !== "BODY", {
      claimIds: ["A11Y-002"],
      what: "focus fell to the document body when the remembered element was gone",
      detail: `landed on ${landedAfterRemoval?.id ?? "(nothing)"}, active ${activeId()}`,
    });

    // Two overlays, closed in the order a click outside both produces rather than the tidy one.
    env.document.body.innerHTML = "";
    const page = staged();
    const outer = createFocusCustodian(() => page.root);
    outer.remember();
    page.within.focus();

    const innerRoot = env.document.createElement("div");
    innerRoot.id = "inner";
    const innerButton = env.document.createElement("button");
    innerButton.id = "innerButton";
    innerRoot.append(innerButton);
    env.document.body.append(innerRoot);
    const inner = createFocusCustodian(() => innerRoot);
    inner.remember();
    innerButton.focus();
    ctx.log.note("two overlays open, about to close outermost first", {});

    page.root.remove();
    expectEqual(outer.restore()?.id ?? null, "trigger", {
      claimIds: ["A11Y-002"],
      what: "the outer overlay did not hand focus back to what opened it",
    });

    innerRoot.remove();
    inner.restore();
    expectClaim(activeId() !== "BODY", {
      claimIds: ["A11Y-002"],
      what: "closing the second overlay dropped focus to the document body",
      detail: `active ${activeId()}`,
    });

    // And the honest answer when there is genuinely nowhere: `restore` says so rather than pretending.
    env.document.body.innerHTML = "";
    const doomed = staged();
    const orphan = createFocusCustodian(() => doomed.root);
    orphan.remember();
    doomed.within.focus();
    doomed.trigger.remove();
    doomed.root.remove();
    ctx.log.note("nothing left to hand focus back to", {});

    expectEqual(orphan.restore(), null, {
      claimIds: ["A11Y-002"],
      what: "restore claimed to have placed focus when there was nowhere to place it",
    });
  },
);

battle(
  {
    claims: ["A11Y-002"],
    title: "a widget that has handed focus back does not take it again",
    environments: ["node"],
  },
  async (ctx) => {
    const page = staged();
    const custodian = createFocusCustodian(() => page.root);
    custodian.remember();
    page.within.focus();

    const handedBack = custodian.restore();
    ctx.log.note("focus handed back once", { landed: handedBack?.id });

    // The control: the first restore did what it is for, so what follows is about the second call
    // rather than about a custodian that never worked.
    expectEqual(handedBack?.id ?? null, "trigger", {
      claimIds: ["A11Y-002"],
      what: "the first restore did not hand focus back to the trigger",
    });

    // A closing widget and a disposing one both call `restore`, and neither knows about the other.
    // Focus is borrowed, not taken — so a custodian holding nothing has nothing to hand back, and
    // pulling focus into the widget it just left is taking it.
    const again = custodian.restore();
    ctx.log.note("restore called a second time", { landed: again?.id, active: activeId() });

    expectEqual(again, null, {
      claimIds: ["A11Y-002"],
      what: "a second restore took focus back into the widget",
      detail: `landed on ${again?.id ?? "(nothing)"}`,
    });

    expectEqual(activeId(), "trigger", {
      claimIds: ["A11Y-002"],
      what: "a second restore moved focus away from where the first had put it",
    });
  },
);
