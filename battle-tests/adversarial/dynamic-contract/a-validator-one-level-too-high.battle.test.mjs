/**
 * A constraint written one level up from where it lives, and nothing that says so.
 *
 * The contract keeps a field's constraints in `validators`: `{ required, email, min, max, minLength,
 * maxLength, pattern }`, declared as `MdyDynamicValidators` and taught that way by every example in
 * `docs/guides/ai-generated-forms.md` — a guide that exists because documents are written by models
 * and has to spell out, in its own words, that *"validators may only contain: required (boolean),
 * …"*.
 *
 * Written one level up, on the field itself, they do nothing:
 *
 *   { name: "x", kind: "text", validators: { required: true } }   1 extra validator, marksRequired
 *   { name: "x", kind: "text", required: true }                   no validator, no diagnostic
 *
 * `buildDynamicFieldValidators` — the function the product uses to turn a document's field into
 * rules — is where this was measured, so it is not an artefact of one caller. `required` at the top
 * level is not part of `MdyDynamicFieldBase` at all: it is parsed, **kept on the field**, and read by
 * nobody. No validation, no `required()` on the handle, no `aria-required`.
 *
 * This battle does **not** ask the parser to refuse every property it does not know. Ignoring the
 * unknown is what lets a v3 document be read by a parser that predates v3, and that is worth more
 * than catching a typo. It asks something narrower and in the contract's own vocabulary: a property
 * whose name **is** a validator the contract declares, appearing where validators do not live, is
 * reported. Nothing about forward compatibility requires staying silent about a word the contract
 * already owns.
 *
 * The cost of the silence is the ordinary one: a field that was meant to be required is submitted
 * empty, and a pattern that was meant to bound a value never runs — with `ok: true` in strict mode,
 * whose promise is that a partly valid document is never accepted.
 */

import { buildDynamicFieldValidators, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Every name `MdyDynamicValidators` declares, with a value of the type it declares for it. */
const VALIDATOR_NAMES = Object.freeze({
  required: true,
  email: true,
  min: 1,
  max: 10,
  minLength: 2,
  maxLength: 8,
  pattern: "^a",
});

/** A field of the kind each constraint makes sense for, so the constraint is never refused on its merits. */
const KIND_FOR = Object.freeze({ min: "number", max: "number" });

function parseWith(field) {
  const parsed = parseDynamicForm({ version: 2, fields: [field] }, "strict");
  return {
    ok: parsed.ok,
    codes: parsed.diagnostics.map((each) => each.code),
    built: parsed.fields[0] ? buildDynamicFieldValidators(parsed.fields[0]) : null,
  };
}

battle(
  {
    claims: ["DYN-004", "VAL-001"],
    title: "a constraint written where constraints do not live is reported",
    environments: ["node"],
  },
  async (ctx) => {
    const observed = Object.entries(VALIDATOR_NAMES).map(([name, value]) => {
      const kind = KIND_FOR[name] ?? "text";
      const inPlace = parseWith({ name: "x", kind, label: "X", validators: { [name]: value } });
      const tooHigh = parseWith({ name: "x", kind, label: "X", [name]: value });
      return {
        name,
        inPlaceBuilds: inPlace.built ? inPlace.built.validators.length : 0,
        tooHighBuilds: tooHigh.built ? tooHigh.built.validators.length : 0,
        tooHighAccepted: tooHigh.ok,
        tooHighSaid: tooHigh.codes,
      };
    });
    ctx.log.note("each constraint, in its place and one level up", observed);

    // The instrument: in its proper place every one of them builds something, or "one level up
    // builds nothing" would be a statement about constraints that never work.
    const baseline = parseWith({ name: "x", kind: "text", label: "X" }).built.validators.length;
    expectClaim(
      observed.every((row) => row.inPlaceBuilds > baseline),
      {
        claimIds: ["VAL-001"],
        what: "a constraint builds nothing even where it belongs, so the probe is wrong before the contract is",
        detail: JSON.stringify({ baseline, observed }),
      },
    );

    // Either the misplaced constraint still takes effect, or the document is told about it.
    expectEqual(
      observed
        .filter((row) => row.tooHighBuilds <= baseline && row.tooHighSaid.length === 0)
        .map((row) => row.name),
      [],
      {
        claimIds: ["DYN-004", "VAL-001"],
        what: "a constraint written one level up neither takes effect nor is reported, so a field meant to be constrained is submitted unconstrained in silence",
      },
    );
  },
);
