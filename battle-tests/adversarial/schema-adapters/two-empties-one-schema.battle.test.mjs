/**
 * Two ways for a field to be empty, and a schema that accepts one of them.
 *
 * `createZodForm(schema)` derives a whole form from a `z.object()`. A leaf it cannot seed starts at
 * `null`, which the guide states plainly — *"Leaves are `Output | null` (null = not filled in)"* — and
 * the bridge does read a `.default()` where one is given, so `null` is a choice rather than the only
 * thing available.
 *
 * `z.string()` does not accept `null`. So a form derived from the most ordinary schema a consumer
 * writes reports a **type error** on arrival — *"Invalid input: expected string, received null"* — and
 * `canSubmit` is false before anything has been touched.
 *
 * The other empty is accepted. `""` is a string, so a user who types one character and deletes it
 * leaves the field empty and the form valid. The same field, empty both times: refused when it was
 * never filled, accepted once it has been.
 *
 * Two keystrokes apart, and the direction is the wrong one — the state a person reaches by
 * interacting is the permissive one. A consumer reading `z.string()` as "must be answered" gets `""`
 * in the payload.
 *
 * Neither half is zod behaving oddly: `z.string()` rejects `null` and accepts `""`, exactly as its own
 * `safeParse` does. What the two halves together say is that the form's chosen representation of
 * *unfilled* is not one its schema admits, while the user's representation of *emptied* is.
 */

import { createForm, field, required } from "@modyra/core";
import { createZodForm } from "@modyra/zod";
import { z } from "zod";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const messages = (form, path) => form.errorsFor(path)().map((each) => each.message);

battle(
  {
    claims: ["SCH-001"],
    title: "a derived form's own empty is one its schema accepts",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the bridge validates, and a value the schema likes is accepted. Without it, an
    // invalid form below would say nothing about which value was refused.
    const derived = createZodForm(z.object({ name: z.string() }), { devWarnings: false });
    derived.f.name.set("Ada");
    expectClaim(derived.state.valid() && messages(derived, "name").length === 0, {
      claimIds: ["SCH-001"],
      what: "a derived form refused a value its schema accepts, so the refusals below are not specific",
      detail: () => JSON.stringify(messages(derived, "name")),
    });

    // The second control: refusing an empty answer is expressible, and a hand-declared form does it
    // with a sentence about the answer rather than about a type.
    const declared = createForm({ name: field("", [required()]) }, { devWarnings: false });
    declared.f.name.set("Ada");
    declared.f.name.set("");
    expectEqual(messages(declared, "name"), ["This field is required"], {
      claimIds: ["SCH-001"],
      what: "a hand-declared required field no longer refuses an empty answer",
    });

    // What the same derived field says about its two empties.
    const fresh = createZodForm(z.object({ name: z.string() }), { devWarnings: false });
    const onArrival = {
      value: fresh.getValue().name,
      valid: fresh.state.valid(),
      canSubmit: fresh.state.canSubmit(),
      messages: messages(fresh, "name"),
    };

    fresh.f.name.set("Ada");
    fresh.f.name.set("");
    const afterEmptying = {
      value: fresh.getValue().name,
      valid: fresh.state.valid(),
      canSubmit: fresh.state.canSubmit(),
      messages: messages(fresh, "name"),
    };
    ctx.log.note("the same field, empty twice", { onArrival, afterEmptying });

    // The contradiction inside one state rather than across two. `required` drives
    // `aria-required`, so a field that is valid, empty and required at the same moment tells
    // assistive technology it must be answered while the form says it has been.
    const requiredOf = (form, path) => {
      const state = form.getField(path)?.();
      const flag = state?.required;
      return typeof flag === "function" ? flag() : flag;
    };
    ctx.log.note("the same moment, three ways", {
      value: fresh.getValue().name,
      valid: fresh.state.valid(),
      required: requiredOf(fresh, "name"),
    });

    expectClaim(!(requiredOf(fresh, "name") === true && fresh.state.valid() && fresh.getValue().name === ""), {
      claimIds: ["SCH-001"],
      what: "a field is required, empty and valid in the same state",
      detail: () => JSON.stringify({
        value: fresh.getValue().name,
        valid: fresh.state.valid(),
        required: requiredOf(fresh, "name"),
      }),
    });

    // The form's own unfilled value has to be one its schema admits. Anything else means a form that
    // refuses itself before a person has done anything, in the schema's type vocabulary rather than
    // in a sentence about the answer.
    expectClaim(onArrival.valid && onArrival.canSubmit, {
      claimIds: ["SCH-001"],
      what: "a derived form is refused before it is touched, by the schema that built it",
      detail: () => JSON.stringify(onArrival),
    });

    // And the two empties have to agree with each other. Whichever answer is right, a field cannot be
    // refused when it was never filled and accepted once it has been emptied.
    expectEqual([afterEmptying.valid, afterEmptying.canSubmit], [onArrival.valid, onArrival.canSubmit], {
      claimIds: ["SCH-001"],
      what: "emptying a field reaches a verdict the same field never had while unfilled",
      detail: () => JSON.stringify({ onArrival, afterEmptying }),
    });

    // The control that consistency is expressible today: one constraint away, both empties are
    // refused, in the same vocabulary at both moments.
    const constrained = createZodForm(z.object({ name: z.string().min(1) }), { devWarnings: false });
    constrained.f.name.set("Ada");
    constrained.f.name.set("");
    expectClaim(!constrained.state.valid() && messages(constrained, "name").length > 0, {
      claimIds: ["SCH-001"],
      what: "a constrained schema no longer refuses an emptied field, so consistency is not expressible",
      detail: () => JSON.stringify(messages(constrained, "name")),
    });

    // Where a person meets it rather than where a probe does. A collection's row is seeded the same
    // way, so the form becomes unsubmittable as a result of the most ordinary action a collection
    // form has — adding a row — with a type error on a cell nobody has touched.
    const withRows = createZodForm(z.object({ rows: z.array(z.object({ sku: z.string() })) }), { devWarnings: false });
    const emptyList = { valid: withRows.state.valid(), canSubmit: withRows.state.canSubmit() };

    // The control: an empty collection is a form that can be sent, so what changes below is the row.
    expectClaim(emptyList.valid && emptyList.canSubmit, {
      claimIds: ["SCH-001"],
      what: "a derived form with an empty collection cannot be sent, so adding a row is not what changes it",
      detail: () => JSON.stringify(emptyList),
    });

    withRows.f.rows.push();
    const oneRow = {
      value: withRows.getValue().rows,
      valid: withRows.state.valid(),
      canSubmit: withRows.state.canSubmit(),
      messages: messages(withRows, "rows.0.sku"),
    };
    ctx.log.note("a row a person added", oneRow);

    expectClaim(oneRow.canSubmit, {
      claimIds: ["SCH-001"],
      what: "adding a row made the form unsendable, with a message about a cell nobody touched",
      detail: () => JSON.stringify(oneRow),
    });

    derived.destroy();
    declared.destroy();
    fresh.destroy();
    constrained.destroy();
    withRows.destroy();
  },
);
