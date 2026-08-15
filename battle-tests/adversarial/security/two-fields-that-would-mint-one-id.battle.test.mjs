/**
 * The two names that would build the same id, refused at both doors.
 *
 * Every id a form generates is a widget id joined to a part by `MDY_ID_DELIMITER`, which is `__`. The
 * join is the whole scheme: `label[for]`, `aria-describedby`, `aria-errormessage`, the popup a
 * control names, the radio group's `name` — all of them are that string.
 *
 * Two fields can therefore reach the same id by different routes. A field called `a__b` asking for
 * its `label` and a field called `a` asking for a part called `b__label` both arrive at
 * `a__b__label`, and neither looks wrong on its own. What follows is a label pointing at another
 * field's input, an error announced on the wrong control, and a form nobody can debug from either
 * half.
 *
 * Both doors are shut, and this pins both. `isValidWidgetId` refuses a name carrying the delimiter
 * and the part-id functions **throw** rather than warn, so the collision cannot be built. And the
 * document parser refuses such a name before it becomes a field at all, which is what keeps the
 * widget-layer guard from being the last line — a name that reached it would already be a crash
 * where a diagnostic belonged.
 *
 * That ordering is the point. It is finding 118's shape with the layers the right way round.
 */

import { parseDynamicForm } from "@modyra/core";
import { MDY_ID_DELIMITER, defaultWidgetIdFactory, fieldShellPartIds, isValidWidgetId } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Names that carry the delimiter, and so could reach another field's ids. */
const COLLIDING = Object.freeze(["a__b", "a__label", "plan__errors", "a__b__c"]);

/** Names that are ordinary, including the one that differs by a single character. */
const ORDINARY = Object.freeze(["a", "a_b", "a-b", "a.b", "rows.0.plan", "1"]);

battle(
  {
    claims: ["SEC-001", "A11Y-001"],
    title: "a widget id cannot carry the join that builds its parts",
    environments: ["node"],
  },
  async (ctx) => {
    ctx.log.note("the string every generated id is built with", { delimiter: MDY_ID_DELIMITER });

    // The collision the guard exists to prevent, as arithmetic rather than as a bug: two different
    // fields asking for two different parts, arriving at one id.
    const fromColliding = defaultWidgetIdFactory.part("a__b", "label");
    const fromOrdinary = defaultWidgetIdFactory.part("a", `b${MDY_ID_DELIMITER}label`);
    ctx.log.note("two routes to one id", { fromColliding, fromOrdinary });

    expectEqual(fromColliding, fromOrdinary, {
      claimIds: ["A11Y-001"],
      what: "the two routes no longer meet, so the guard below is protecting against nothing",
    });

    for (const name of ORDINARY) {
      expectClaim(isValidWidgetId(name), {
        claimIds: ["A11Y-001"],
        what: `an ordinary widget id ${JSON.stringify(name)} was refused`,
      });
    }

    for (const name of [...COLLIDING, "", " ", "a b", "__proto__"]) {
      expectClaim(!isValidWidgetId(name), {
        claimIds: ["SEC-001"],
        what: `${JSON.stringify(name)} was accepted as a widget id`,
      });
    }

    // And the guard is enforced where the ids are built, not only offered as a question.
    for (const name of COLLIDING) {
      let refused = null;
      try {
        fieldShellPartIds(name);
      } catch (error) {
        refused = String(error.message);
      }

      expectClaim(refused !== null && refused.includes(name), {
        claimIds: ["SEC-001"],
        what: `building the parts of ${JSON.stringify(name)} was allowed, or refused without naming it`,
        detail: String(refused),
      });
    }

    // The control: an ordinary name builds its parts, so the refusals above are the delimiter rather
    // than a builder that refuses everything.
    expectEqual(fieldShellPartIds("plan"), {
      labelId: "plan__label",
      descriptionId: "plan__description",
      errorId: "plan__errors",
    }, {
      claimIds: ["A11Y-001"],
      what: "an ordinary field could not build the ids its parts are named by",
    });
  },
);

battle(
  {
    claims: ["SEC-001", "DYN-001"],
    title: "a document cannot declare a name that would collide",
    environments: ["node"],
  },
  async (ctx) => {
    // The layer that matters for untrusted data: refused as a document, with a diagnostic, rather
    // than accepted and thrown at later.
    for (const name of COLLIDING) {
      const parsed = parseDynamicForm({ version: 3, fields: [{ name, kind: "text", label: "L" }] }, { mode: "strict" });
      ctx.log.note("a document naming a field after the join", {
        name,
        ok: parsed.ok,
        diagnostics: (parsed.diagnostics ?? []).map((each) => each.code),
      });

      expectClaim(parsed.ok === false && (parsed.diagnostics ?? []).length > 0, {
        claimIds: ["SEC-001", "DYN-001"],
        what: `a document declaring a field called ${JSON.stringify(name)} was accepted, so the crash is a renderer's to have`,
        detail: JSON.stringify(parsed.diagnostics ?? []),
      });
    }

    // The control: a name one character away is ordinary and passes, so the refusals are the
    // delimiter rather than underscores.
    const fine = parseDynamicForm({ version: 3, fields: [{ name: "a_b", kind: "text", label: "L" }] }, { mode: "strict" });
    expectClaim(fine.ok === true && fine.acceptedCount === 1, {
      claimIds: ["DYN-001"],
      what: "a field named with a single underscore was refused",
      detail: JSON.stringify(fine.diagnostics ?? []),
    });
  },
);
