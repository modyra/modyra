/**
 * A value the contract knows is not a date, accepted as one at three doors out of four.
 *
 * `parse.ts` carries `DATE_KINDS` — *"the kinds whose value is an ISO date, so a comparison against
 * them is a date comparison"* — and `isIsoDate` beside it. The two are used, and the message they
 * produce shows the reasoning is already worked out:
 *
 * > `greaterThan` on a datepicker compares dates as text, so "value" must be a full ISO date
 * > (yyyy-MM-dd); "2026-4-3" would order wrongly.
 *
 * The parser therefore knows which kinds hold dates and how to tell whether a string is one. It asks
 * at two doors:
 *
 *   the calendar's minDate/maxDate    checked  (parse.ts:196)
 *   a comparison rule's value         checked  (parse.ts:901)
 *   the field's initialValue          NOT checked
 *   anything written afterwards       NOT checked
 *
 * At the two unchecked doors a datepicker holds whatever text arrives, and the form calls itself
 * valid:
 *
 *   initialValue: "not a date at all"    parsed clean, no diagnostic
 *   set("not a date at all")             valid, no errors, submittable
 *   restored from a tampered draft       valid, no errors, submittable
 *
 * Nor can an author ask for it. The validator vocabulary is `required, email, min, max, minLength,
 * maxLength, pattern` — there is no "is a date", and `pattern` would be retyping what the *kind*
 * already means, badly: `^\\d{4}-\\d{2}-\\d{2}$` accepts `9999-99-99`.
 *
 * The same holds for `timepicker` and `colors`, whose formats the framework also knows —
 * `parseAnyTime` and the colour helpers — and neither is consulted after the value arrives. `email`
 * is the one kind with a way out, because `validators.email` exists.
 *
 * This battle asserts the narrow thing: **a door the parser already guards and a door it does not
 * give the same answer about the same value.** It does not ask for a new validator.
 */

import {
  applyFlatValidators,
  buildFlatFormSchema,
  createForm,
  parseDynamicForm,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const NOT_A_DATE = "not a date at all";
const settle = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));

/** The door the parser is known to guard: a comparison rule's value. */
function throughAComparisonRule(value) {
  const parsed = parseDynamicForm(
    {
      version: 2,
      fields: [
        { name: "d", kind: "datepicker", label: "D" },
        { name: "t", kind: "text", label: "T" },
      ],
      rules: [{ effect: "hidden", target: "t", when: { field: "d", operator: "greaterThan", value } }],
    },
    { mode: "strict" },
  );
  return { accepted: parsed.rules.length > 0, codes: parsed.diagnostics.map((each) => each.code) };
}

/** The door beside it: the calendar's own bounds. */
function throughACalendarBound(value) {
  const parsed = parseDynamicForm(
    // `MdyDynamicCalendarOptions` is mixed into the date field rather than nested under a key, so
    // `minDate` sits directly on the field — which is where `parse.ts:196` looks for it.
    { version: 1, fields: [{ name: "d", kind: "datepicker", label: "D", minDate: value }] },
    { mode: "strict" },
  );
  return { accepted: parsed.fields.length > 0 && parsed.diagnostics.length === 0, codes: parsed.diagnostics.map((each) => each.code) };
}

/** The door that is not guarded: the field's declared initial. */
function throughAnInitialValue(value) {
  const parsed = parseDynamicForm(
    { version: 1, fields: [{ name: "d", kind: "datepicker", label: "D", initialValue: value }] },
    { mode: "strict" },
  );
  return { accepted: parsed.fields.length > 0, codes: parsed.diagnostics.map((each) => each.code) };
}

/** And the one after it: a value written into a live form. */
async function throughAWrite(value) {
  const parsed = parseDynamicForm({ version: 1, fields: [{ name: "d", kind: "datepicker", label: "D" }] }, { mode: "strict" });
  const form = createForm(buildFlatFormSchema(parsed.fields), { devWarnings: false });
  try {
    applyFlatValidators(form, parsed.fields);
    form.f.d.set(value);
    await settle();
    return { accepted: form.state.valid(), codes: form.errorsFor("d")().map((each) => each.kind) };
  } finally {
    form.destroy();
  }
}

battle(
  {
    claims: ["DYN-004", "VAL-003"],
    title: "a value the parser knows is not a date is not taken as one",
    environments: ["node"],
  },
  async (ctx) => {
    const doors = [
      { door: "a comparison rule's value", ...throughAComparisonRule(NOT_A_DATE) },
      { door: "the calendar's minDate", ...throughACalendarBound(NOT_A_DATE) },
      { door: "the field's initialValue", ...throughAnInitialValue(NOT_A_DATE) },
      { door: "a write into a live form", ...(await throughAWrite(NOT_A_DATE)) },
    ];
    ctx.log.note("the same value, at every door a datepicker has", doors);

    // The instrument: a real date must be accepted at every door, or "the value is refused" would
    // describe doors that refuse everything.
    const withARealDate = [
      { door: "a comparison rule's value", ...throughAComparisonRule("2026-04-03") },
      { door: "the calendar's minDate", ...throughACalendarBound("2026-04-03") },
      { door: "the field's initialValue", ...throughAnInitialValue("2026-04-03") },
      { door: "a write into a live form", ...(await throughAWrite("2026-04-03")) },
    ];
    expectClaim(withARealDate.every((entry) => entry.accepted), {
      claimIds: ["DYN-004"],
      what: "a real ISO date is refused somewhere, so the probe is wrong before the contract is",
      detail: JSON.stringify(withARealDate),
    });

    // And the control that makes this a gap rather than a policy: at least one door already refuses.
    expectClaim(doors.some((entry) => !entry.accepted), {
      claimIds: ["DYN-004"],
      what: "no door refuses it, so the framework has no opinion about dates to be inconsistent about",
      detail: JSON.stringify(doors),
    });

    expectEqual(
      doors.filter((entry) => entry.accepted).map((entry) => entry.door),
      [],
      {
        claimIds: ["DYN-004", "VAL-003"],
        what: "a datepicker took a value the parser itself refuses one door over, and the form called itself valid holding it",
      },
    );
  },
);
