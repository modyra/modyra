/**
 * The check that would have caught the last defect, and why it did not.
 *
 * `@modyra/widgets/testing` publishes `inspectUnsupportedStateAria`: given a rendered widget and its
 * kind, it reports any ARIA attribute belonging to a state the kind does not declare. It is the
 * instrument for exactly the defect a checkbox announcing `aria-readonly` is, it is correct, and
 * three adapter suites assert its verdict is empty. All three are green.
 *
 * They are green because of where the check is pointed. `collectStateMatrix` drives each kind
 * through the states it *declares*, and then, in a separate pass described in its own comment as
 * "about the states a widget is not in", mounts one more fixture and inspects it — with nothing
 * driven. So the widget is inspected in its default state only.
 *
 * A projection that emits the forbidden attribute unconditionally would be caught. One that emits it
 * only when a consumer sets the state cannot be: the state is undeclared, so the matrix never drives
 * it, so the attribute never appears while the check is looking. `state.readonly ? "true" : null` is
 * the second shape, and it is the shape the defect actually has.
 *
 * The gap is structural rather than a missing case: the loop's own bound is the declared states, so
 * no fixture reaches an undeclared one. Widening it means driving each kind into the states it does
 * not declare and asserting nothing is announced — which is what a consumer does the moment they set
 * `readonly` on a checkbox because their form has a read-only mode.
 *
 * Both halves are asserted here with a fixture this battle owns, so the finding does not depend on
 * any adapter's renderer: the checker catches the attribute when it is there, and the matrix returns
 * a clean verdict on a widget that carries it under a state the matrix will not drive.
 */

import { collectStateMatrix, inspectUnsupportedStateAria } from "@modyra/widgets/testing";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { installDocument } from "../../harness/dom-env.mjs";

/**
 * A checkbox that announces `aria-readonly` when it is read-only, and nothing when it is not.
 *
 * This is the projection's behaviour written as a fixture rather than a renderer's, because the
 * question is what the *instrument* sees, not which adapter produced the DOM.
 */
function readonlyAnnouncingCheckbox(document) {
  const root = document.createElement("div");
  const input = document.createElement("input");
  input.setAttribute("type", "checkbox");
  root.append(input);

  return {
    root,
    input,
    setReadonly(on) {
      if (on) input.setAttribute("aria-readonly", "true");
      else input.removeAttribute("aria-readonly");
    },
  };
}

battle(
  {
    claims: ["A11Y-004"],
    title: "the matrix reports a clean widget while the widget announces an undeclared state",
    environments: ["node"],
  },
  async (ctx) => {
    const dom = installDocument();
    try {
      // The control: pointed at a widget that is in the state, the checker does its job. Every
      // assertion below is about where it is pointed, not about whether it works.
      const caught = readonlyAnnouncingCheckbox(dom.document);
      caught.setReadonly(true);
      const issues = inspectUnsupportedStateAria(caught.root, "checkbox");
      ctx.log.note("the checker, pointed at a read-only checkbox", {
        codes: issues.map((each) => each.code),
      });

      expectClaim(issues.some((each) => each.code === "STATE_ARIA_UNSUPPORTED"), {
        claimIds: ["A11Y-004"],
        what: "the checker does not report aria-readonly on a checkbox, so this battle measures nothing",
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
          const widget = readonlyAnnouncingCheckbox(dom.document);
          return {
            root: widget.root,
            parts: () => ({ control: widget.input }),
            control: () => widget.input,
            drive: (state) => {
              driven.push(state);
              // A consumer's form has a read-only mode, so this is the state the widget is put in
              // — by the consumer, never by the matrix, because the kind does not declare it.
              if (state === "readonly") widget.setReadonly(true);
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

      // The matrix never asks for the undeclared state, which is what leaves the widget in its
      // default shape for the one pass that would have reported it.
      expectClaim(!driven.includes("readonly"), {
        claimIds: ["A11Y-004"],
        what: "the matrix drove checkbox into readonly, so the blind spot this battle describes is closed",
        detail: JSON.stringify(driven),
      });

      // And so it returns clean on a widget that announces a state its kind does not have. This is
      // the assertion a fix turns: driving each kind through the states it does *not* declare, and
      // reporting what is announced there.
      expectEqual(matrix.unsupportedAria, ["checkbox"], {
        claimIds: ["A11Y-004"],
        what: "the matrix reported no undeclared-state ARIA for a widget that announces it under that very state",
        detail: JSON.stringify({ driven, unsupportedAria: matrix.unsupportedAria }),
      });

      // The control for the control: the same widget, inspected while it is in the state the
      // matrix declined to drive it into, is reported. So the empty verdict above is where the
      // check was pointed and not the checker failing on this fixture.
      const inState = readonlyAnnouncingCheckbox(dom.document);
      inState.setReadonly(true);
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
          const always = readonlyAnnouncingCheckbox(dom.document);
          always.setReadonly(true);
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
