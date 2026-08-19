/**
 * One field name, and the three published doors that answer differently about it.
 *
 * `@modyra/core`'s guards say why a name matters, in their own words: a widget id is built from the
 * field's name, and *"whitespace splits an id reference into several, each resolving to nothing — so
 * the control would have no accessible name"*, while `__` *"separates the segments of a generated id,
 * so this name would collide with another field's parts"*. The comment beside them states the
 * intention plainly — **"the same rules hold on both paths"**, a document and a list written in code,
 * *"and only the response differs"*.
 *
 * Three doors, one name:
 *
 *     isSafeFieldPath("a b")            true        the published guard a consumer would check with
 *     createForm({ "a b": field() })    accepted    the form holds it
 *     assertUsableWidgetId("a b")       refused     "cannot be a widget id"
 *     a document naming it              refused     assertSafeDynamicName, by name
 *
 * So a form written in code carries a field the widget layer will not build an id for. The refusal
 * arrives at render time, from another package, about a name that core took and the guard blessed —
 * and the same name arriving in a document is refused at the door, which is the asymmetry the comment
 * says is not there.
 *
 * `a__b` is the same story with a different ending: not a refusal at render time but a collision, two
 * elements answering to one id, which is the failure `MDY_ID_DELIMITER` exists to prevent.
 *
 * Green when the three answers agree — whichever way. A name a form may hold is a name a widget id can
 * be built from, or the guard published for checking says so before the form is built.
 */

import { createForm, field, isSafeFieldPath } from "@modyra/core";
import { assertUsableWidgetId } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** What each published door says about one name. */
function doorsOn(name) {
  let held = false;
  try {
    const form = createForm({ [name]: field("v") }, { devWarnings: false });
    held = Object.keys(form.getValue()).includes(name);
    form.destroy();
  } catch { held = false; }

  let usableAsId = true;
  try {
    assertUsableWidgetId(name);
  } catch { usableAsId = false; }

  return { guardSaysSafe: isSafeFieldPath(name), held, usableAsId };
}

battle(
  {
    claims: ["SEC-001", "A11Y-001", "API-001"],
    title: "a name a form may hold is one a widget id can be built from",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: an ordinary name is taken by all three, so what the names below find is the name
    // rather than a door that refuses everything.
    const ordinary = doorsOn("ok");
    expectEqual(ordinary, { guardSaysSafe: true, held: true, usableAsId: true }, {
      claimIds: ["API-001"],
      what: "an ordinary field name is not accepted by all three doors, so nothing below is about the name",
    });

    // And the direction the guards were built for still holds, so the disagreement below is not the
    // guard having stopped working.
    const hostile = doorsOn("__proto__");
    expectClaim(!hostile.guardSaysSafe && !hostile.held, {
      claimIds: ["SEC-001"],
      what: "a prototype key is accepted as a field name, which is a plainer defect than the one this battle is about",
      detail: JSON.stringify(hostile),
    });

    const disagreements = [];
    for (const name of ["a b", "a\tb", "a__b"]) {
      const doors = doorsOn(name);
      ctx.log.note("one name, three doors", { name, ...doors });
      if (doors.held !== doors.usableAsId || doors.guardSaysSafe !== doors.usableAsId) {
        disagreements.push({ name, ...doors });
      }
    }

    expectEqual(disagreements, [], {
      claimIds: ["SEC-001", "A11Y-001"],
      what: "a form holds a name the widget layer will not build an id from, and the published guard calls it safe — so the refusal arrives at render time, from another package, about a name core took",
    });
  },
);
