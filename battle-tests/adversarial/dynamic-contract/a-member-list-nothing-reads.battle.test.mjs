/**
 * The nine member lists the contract publishes, and the one nothing checks against.
 *
 * `MDY_DYNAMIC_MEMBERS` names what each slot of a document may carry, and
 * `MDY_DYNAMIC_UNKNOWN_MEMBER` is what a parse says about a member outside the list. The pair is the
 * answer to a document written against a contract this reader does not have: report it where it is
 * written, keep reading, and let strict mode refuse the document as a whole.
 *
 * Eight of the nine slots are held to it. `layoutSlot` — a v3 slot, `{ref, at}` — is not:
 *
 *     a stray member on a columns node   MDY_DYNAMIC_UNKNOWN_MEMBER at /layout/0, strict refuses
 *     a stray member on a slot           nothing, in a section or in a columns row alike
 *
 * A slot is the one node where the member carries the meaning. `at` is where a field says which
 * column it sits in at which size, so a slot written `att` or `ats` is a placement that will not
 * happen — and the document parses clean, in strict mode, with the misspelled member **kept in the
 * parsed layout** and handed to whatever draws it.
 *
 * Green when a member outside `MDY_DYNAMIC_MEMBERS.layoutSlot` is reported the way one outside the
 * other eight lists is.
 */

import { MDY_DYNAMIC_MEMBERS, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const FIELD = { name: "f", kind: "text", label: "L" };

/** A columns row holding one slot, which is where a slot's `at` is legal. */
const withSlot = (slot, over = {}) => ({
  version: 3,
  fields: [FIELD],
  layout: [{ kind: "columns", id: "c", at: { base: 2 }, columns: [[slot]], ...over }],
});

const unknownMembers = (document) =>
  parseDynamicForm(document, { mode: "strict" }).diagnostics
    .filter((diagnostic) => diagnostic.code === "MDY_DYNAMIC_UNKNOWN_MEMBER")
    .map((diagnostic) => diagnostic.path);

battle(
  {
    claims: ["DYN-003", "DYN-001"],
    title: "a member outside a published list is reported, whichever list it is outside",
    environments: ["node"],
  },
  async (ctx) => {
    // The premise: there is a list for a slot to be held to, and it is short enough that a stray
    // member is obviously stray.
    expectEqual([...MDY_DYNAMIC_MEMBERS.layoutSlot].sort(), ["at", "ref"], {
      claimIds: ["DYN-003"],
      what: "the contract no longer publishes the members a slot may carry, so there is nothing to hold one to",
    });

    // The control: the node one level up is held to its own list, so the mechanism is present and
    // reaches layout — what the measurement finds is the slot rather than layout in general.
    const onTheRow = unknownMembers(withSlot({ ref: "f" }, { zzStray: 1 }));
    ctx.log.note("a stray member on the columns node above the slot", { reported: onTheRow });
    expectClaim(onTheRow.length > 0, {
      claimIds: ["DYN-003"],
      what: "a stray member on a layout node is not reported either, so this is not about slots",
    });

    const inARow = unknownMembers(withSlot({ ref: "f", zzStray: 1 }));
    const inASection = unknownMembers({
      version: 3,
      fields: [FIELD],
      layout: [{ kind: "section", id: "s", children: [{ ref: "f", zzStray: 1 }] }],
    });
    ctx.log.note("a stray member on the slot itself", { inARow, inASection });

    // And what it costs, which is why this is a slot's problem rather than a tidiness one: `at` is
    // the member a placement is written in, and a misspelling of it is a placement that never happens.
    const typo = parseDynamicForm(withSlot({ ref: "f", att: { base: { column: 2 } } }), { mode: "strict" });
    ctx.log.note("a placement spelled wrongly", {
      ok: typo.ok,
      kept: JSON.stringify(typo.layout?.[0]?.columns?.[0]?.[0]),
    });

    expectClaim(inARow.length > 0 && inASection.length > 0, {
      claimIds: ["DYN-003", "DYN-001"],
      what: "a member outside the slot's published list is not reported, so a misspelled placement parses clean and is handed to a renderer as written",
      detail: JSON.stringify({ inARow, inASection, typoAccepted: typo.ok }),
    });
  },
);
