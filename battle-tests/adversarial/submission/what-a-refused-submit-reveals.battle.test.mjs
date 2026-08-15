/**
 * The difference between a submit that goes and one that does not.
 *
 * A form refuses its own submission when it is invalid, and the refusal has to be visible or the
 * button simply stops working. The engine makes it visible by marking every field touched, which is
 * what the renderers use to decide whether a field may paint its verdict — a pristine field with a
 * failing rule shows nothing until somebody has been there.
 *
 * The other half is the one that is easy to lose: an *accepted* submit must not touch anything. A
 * form that marks every field on the way out leaves the user looking at a page full of freshly
 * touched controls for a submission that succeeded, and a second, corrected submit would be
 * indistinguishable from the first.
 *
 * Neither half is asserted anywhere else in this suite, and both are load-bearing: the first is why a
 * refused submit explains itself, the second is why an accepted one is quiet. This battle exists to
 * hold them, not because either is currently wrong.
 */

import { createForm, field, group, record, required } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 50));

const PATHS = Object.freeze(["a", "b", "rows.r1.code"]);

/** A form with a leaf, a required leaf and a collection cell, so touching is visible at each depth. */
function formWithDepth() {
  return createForm(
    {
      a: field(""),
      b: field("", [required()]),
      rows: record(group({ code: field("") }), { initial: { r1: { code: "" } } }),
    },
    { devWarnings: false },
  );
}

/** Which of the declared paths report themselves touched right now. */
function touchedPaths(form) {
  return PATHS.filter((path) => {
    const handle = path.split(".").reduce((node, step) => node?.[step] ?? node?.row?.(step), form.f);
    return handle?.touched?.() === true;
  });
}

battle(
  {
    claims: ["SUB-001", "VAL-003"],
    title: "a refused submit reveals every field, an accepted one touches none",
    environments: ["node"],
  },
  async (ctx) => {
    // A form the engine will refuse: `b` is required and empty.
    const refused = formWithDepth();
    await settled();

    expectEqual(touchedPaths(refused), [], {
      claimIds: ["SUB-001"],
      what: "a form nobody has used already reports touched fields",
    });

    let ranOnRefusal = false;
    await refused.submit(() => {
      ranOnRefusal = true;
    });
    await settled();
    ctx.log.note("a submit the form refused", {
      touched: touchedPaths(refused),
      handlerRan: ranOnRefusal,
      submitCount: refused.state.submitCount(),
    });

    // The handler must not run, or an invalid form reaches a server.
    expectClaim(ranOnRefusal === false, {
      claimIds: ["SUB-001"],
      what: "an invalid form ran its submit handler",
    });

    // And every field is now touched, at every depth, so each one may paint what is wrong with it.
    // A collection cell is included deliberately: it is the depth a shallow implementation misses.
    expectEqual(touchedPaths(refused), PATHS, {
      claimIds: ["VAL-003"],
      what: "a refused submit did not reveal every field, so a form can refuse without explaining",
    });

    expectEqual(refused.state.submitCount(), 0, {
      claimIds: ["SUB-001"],
      what: "a refused submit was counted as one that happened",
    });
    refused.destroy();

    // The other half: a form that passes.
    const accepted = formWithDepth();
    accepted.f.b.set("filled in");
    await settled();

    let sent = null;
    await accepted.submit((value) => {
      sent = value;
    });
    await settled();
    ctx.log.note("a submit the form accepted", {
      touched: touchedPaths(accepted),
      sent,
      submitCount: accepted.state.submitCount(),
    });

    expectClaim(sent !== null, {
      claimIds: ["SUB-001"],
      what: "a valid form did not run its submit handler",
    });

    // Nothing was touched on the way out. A successful submission is not a reason to mark a page.
    expectEqual(touchedPaths(accepted), [], {
      claimIds: ["VAL-003"],
      what: "an accepted submit marked fields touched, so a successful submission leaves the page changed",
    });

    expectEqual(accepted.state.submitCount(), 1, {
      claimIds: ["SUB-001"],
      what: "an accepted submit was not counted",
    });
    accepted.destroy();
  },
);
