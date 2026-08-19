/**
 * The check that would have caught the last defect, and why it did not.
 *
 * `@modyra/widgets/testing` publishes `inspectUnsupportedStateAria`: given a rendered widget and its
 * kind, it reports any ARIA attribute belonging to a state the kind does not declare. It is correct,
 * and three adapter suites assert its verdict is empty. All three are green.
 *
 * They are green because of where the check is pointed. `collectStateMatrix` drives each kind through
 * the states it *declares*, and then, in a separate pass described in its own comment as "about the
 * states a widget is not in", mounts one more fixture and inspects it — with nothing driven. So the
 * widget is inspected in its default state only.
 *
 * A projection that emits the forbidden attribute unconditionally is caught. One that emits it only
 * when a consumer sets the state is not: the state is undeclared, so the matrix never drives it, so
 * the attribute is never present while the check looks. `state.open ? "true" : null` is the second
 * shape, and it is the shape a real defect had.
 *
 * The state is read from the contract rather than named by hand. `MDY_WIDGET_STATE_SUPPORT.checkbox`
 * does not list `open`, and `MDY_WIDGET_STATE_CONTRACTS.open` carries `aria-expanded` — a pair that
 * has to be looked up, because a kind's declared states change: this battle was written against
 * `readonly`, which the checkbox declares now, and measured nothing at all until it was repointed.
 *
 * The gap is structural rather than a missing case: the loop's bound is the declared states, so no
 * amount of adding kinds to it reaches a state nobody declared.
 */

import { collectStateMatrix, inspectUnsupportedStateAria } from "@modyra/widgets/testing";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { installDocument } from "../../harness/dom-env.mjs";

/**
 * A checkbox that announces `aria-expanded` when it is read-only, and nothing when it is not.
 *
 * This is the projection's behaviour written as a fixture rather than a renderer's, because the
 * question is what the *instrument* sees, not which adapter produced the DOM.
 */
/**
 * A checkbox that announces a state its kind does not declare, and only while it is in it.
 *
 * `open` is the state used here because `MDY_WIDGET_STATE_SUPPORT.checkbox` does not list it while
 * `MDY_WIDGET_STATE_CONTRACTS.open` carries `aria-expanded` — which is what makes the attribute one
 * the checker is meant to object to. It has to be read from the contract rather than assumed: the
 * kind declared `readonly` at one point and does now, so a battle naming a state by hand measures
 * whatever the contract happened to say the day it was written.
 */
function stateAnnouncingCheckbox(document) {
  const root = document.createElement("div");
  const input = document.createElement("input");
  input.setAttribute("type", "checkbox");
  root.append(input);

  return {
    root,
    input,
    setAnnouncing(on) {
      if (on) input.setAttribute("aria-expanded", "true");
      else input.removeAttribute("aria-expanded");
    },
  };
}

battle(
  {
    claims: ["A11Y-004"],
    title: "a widget announcing a state only when it is in it is still reported",
    environments: ["node"],
  },
  async (ctx) => {
    const dom = installDocument();
    try {
      // The control: pointed at a widget that is in the state, the checker does its job. Every
      // assertion below is about where it is pointed, not about whether it works.
      const caught = stateAnnouncingCheckbox(dom.document);
      caught.setAnnouncing(true);
      const issues = inspectUnsupportedStateAria(caught.root, "checkbox");
      ctx.log.note("the checker, pointed at a read-only checkbox", {
        codes: issues.map((each) => each.code),
      });

      expectClaim(issues.some((each) => each.code === "STATE_ARIA_UNSUPPORTED"), {
        claimIds: ["A11Y-004"],
        what: "the checker does not report aria-expanded on a checkbox, so this battle measures nothing",
        detail: JSON.stringify(issues),
      });

      // And the same widget through the matrix. `drive` answers honestly for every state the kind
      // declares; `readonly` is not among them, so it is never asked for — which is the whole point.
      const driven = [];
      const matrix = await collectStateMatrix({
        kinds: ["checkbox"],
        // A fresh widget per mount, as every adapter's fixture does. Reusing one would leave the
        // attribute behind from an earlier drive and the matrix would report it for the wrong
        // reason — the check would look sound while the blind spot stayed open.
        mount: () => {
          const widget = stateAnnouncingCheckbox(dom.document);
          return {
            root: widget.root,
            parts: () => ({ control: widget.input }),
            control: () => widget.input,
            drive: (state) => {
              driven.push(state);
              // A consumer's form has a read-only mode, so this is the state the widget is put in
              // — by the consumer, never by the matrix, because the kind does not declare it.
              if (state === "readonly") widget.setAnnouncing(true);
              return state === "disabled" || state === "invalid" || state === "readonly";
            },
            settle: () => {},
            dispose: () => {},
          };
        },
      });
      ctx.log.note("what the matrix drove and what it concluded", {
        driven,
        unsupportedAria: matrix.unsupportedAria,
      });

      // The undeclared state has to be asked for. Without this the assertion below could pass on a
      // widget that was never put into the state at all.
      expectClaim(driven.includes("readonly"), {
        claimIds: ["A11Y-004"],
        what: "the matrix never drove checkbox into readonly, so it cannot see what is announced there",
        detail: JSON.stringify(driven),
      });

      // And the verdict names the kind. A projection emitting the attribute only under the state
      // nobody declared is exactly the shape that was invisible, and it is the shape the fix exists
      // for — this is the assertion that turns if the drive is narrowed back.
      expectEqual(matrix.unsupportedAria, ["checkbox"], {
        claimIds: ["A11Y-004"],
        what: "a widget announcing an undeclared state under that state was reported clean",
        detail: JSON.stringify({ driven, unsupportedAria: matrix.unsupportedAria }),
      });

      // The control for the control: the same widget inspected directly, while it is in the state,
      // is reported. So the verdict above is the matrix reaching the state and not the checker
      // answering the same way for everything.
      const inState = stateAnnouncingCheckbox(dom.document);
      inState.setAnnouncing(true);
      expectClaim(inspectUnsupportedStateAria(inState.root, "checkbox").length > 0, {
        claimIds: ["A11Y-004"],
        what: "the fixture this battle owns is not one the checker reports, so the comparison is unsound",
      });
    } finally {
      dom.restore();
    }
  },
);

battle(
  {
    claims: ["A11Y-004"],
    title: "a widget that always announces it is still caught",
    environments: ["node"],
  },
  async (ctx) => {
    const dom = installDocument();
    try {
      // The other shape, and the reason the check is not simply broken: a projection that emits the
      // forbidden attribute unconditionally is visible in the default state and the matrix reports
      // it. A fix must keep this working while widening what it drives.
      const matrix = await collectStateMatrix({
        kinds: ["checkbox"],
        mount: () => {
          // Fresh, and announcing from the moment it exists — the unconditional projection.
          const always = stateAnnouncingCheckbox(dom.document);
          always.setAnnouncing(true);
          return {
            root: always.root,
            parts: () => ({ control: always.input }),
            control: () => always.input,
            drive: (state) => state === "disabled" || state === "invalid",
            settle: () => {},
            dispose: () => {},
          };
        },
      });
      ctx.log.note("a widget that announces the undeclared state at all times", {
        unsupportedAria: matrix.unsupportedAria,
      });

      expectEqual(matrix.unsupportedAria, ["checkbox"], {
        claimIds: ["A11Y-004"],
        what: "the matrix missed an undeclared state announced unconditionally, which is a wider hole than the one under test",
        detail: JSON.stringify(matrix.unsupportedAria),
      });
    } finally {
      dom.restore();
    }
  },
);
