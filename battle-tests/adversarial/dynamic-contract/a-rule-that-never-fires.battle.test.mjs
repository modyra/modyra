/**
 * A cross-field check an author wrote that will never run, and a document that reports itself fine.
 *
 * `validateExpression` states the purpose in its own words: an expression arriving from a document is
 * checked at parse time "rather than surfacing later as a rule that silently never fires". A
 * document's `validations` are where that matters most — they are the checks an author adds to
 * protect data that no single field can protect, and their dependency paths are derived from the
 * expression rather than declared beside it.
 *
 * Every malformed path is refused: `__proto__`, `a..b`, `.a`, `a.` are rejected as not being field
 * paths, and `ghost` and `ghost.deep` as naming nothing the document declares. One value is not. The
 * empty string parses, is kept, and becomes a dependency on a path no field has, so the check never
 * runs against any value the form can hold — including against `undefined`, which is what the path
 * reads.
 *
 * The same value in the other place a document expresses a condition, a rule's `when.field`, is
 * refused. So the two condition surfaces disagree about exactly one input, and it is the one that
 * fails silently.
 *
 * A document is written by a model as often as by a person here — that is what the guide's published
 * prompt is for — and a generated `""` is a check that looks present in the document, reports `ok`,
 * and defends nothing.
 */

import { buildDynamicValidations, buildFlatFormSchema, createForm, parseDynamicFields, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const FIELDS = Object.freeze([{ name: "a", kind: "text" }, { name: "b", kind: "text" }]);

/** A document whose one cross-field check reads `path`. */
const withValidation = (path) => ({
  version: 3,
  fields: [...FIELDS],
  validations: [{ when: { op: "equals", operands: [{ path }, "x"] }, message: "boom", target: "b" }],
});

/** The same condition as a rule, which is the other way a document says "when". */
const withRule = (field) => ({
  version: 3,
  fields: [...FIELDS],
  rules: [{ effect: "hidden", target: "b", when: { field, operator: "equals", value: "x" } }],
});

/** Whether a check built from `path` ever reports, over every value the form can be driven to. */
function everFires(path) {
  const validators = buildDynamicValidations([
    { when: { op: "equals", operands: [{ path }, "x"] }, message: "boom", target: "b" },
  ]);
  const form = createForm(buildFlatFormSchema(parseDynamicFields([...FIELDS])), { devWarnings: false, validators });
  try {
    const fired = [];
    for (const [name, value] of [["a", "x"], ["b", "x"], ["a", "z"], ["b", ""], ["a", ""]]) {
      form.f[name].set(value);
      if (form.errorsFor("b")().length > 0) fired.push(`${name}=${JSON.stringify(value)}`);
    }
    return fired;
  } finally {
    form.destroy();
  }
}

battle(
  {
    claims: ["DYN-003", "VAL-003"],
    title: "a validation the parser keeps is one that can fire",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: a check reading a real field is kept and does fire. Everything below is measured
    // against this rather than against an assumption about how a document check behaves.
    const real = parseDynamicForm(withValidation("a"), { mode: "strict" });
    expectClaim(real.ok && (real.validations?.length ?? 0) === 1, {
      claimIds: ["DYN-003"],
      what: "a validation reading a declared field was not kept, so nothing below is comparable",
      detail: JSON.stringify(real.diagnostics),
    });

    expectClaim(everFires("a").length > 0, {
      claimIds: ["VAL-003"],
      what: "a validation reading a declared field never reported, so this battle cannot tell silence apart from working",
    });

    // Every path a document could carry that names nothing usable. The parser refuses all but one.
    const kept = [];
    for (const path of ["__proto__", "prototype", "constructor", "a.__proto__.b", "a..b", ".a", "a.", "ghost", "ghost.deep", ""]) {
      const parsed = parseDynamicForm(withValidation(path), { mode: "strict" });
      if (parsed.ok) kept.push({ path, fires: everFires(path) });
    }
    ctx.log.note("paths a validation may read that the parser keeps", { kept });

    for (const entry of kept) {
      expectClaim(entry.fires.length > 0, {
        claimIds: ["DYN-003", "VAL-003"],
        what: `a validation reading ${JSON.stringify(entry.path)} was kept with no diagnostic and never fires against any value`,
        detail: "validateExpression exists so a malformed expression is reported at parse time rather than surfacing later as a rule that silently never fires",
      });
    }
  },
);

battle(
  {
    claims: ["DYN-003"],
    title: "both ways a document says when agree about which paths are conditions",
    open: "reported, not enforced: finding 28, open in battle-tests/reports/open-findings.md",
    environments: ["node"],
  },
  async (ctx) => {
    // A document expresses a condition twice over: an expression inside `validations`, and
    // `when.field` inside `rules`. A path one accepts and the other refuses is an author learning the
    // rule from whichever they wrote first.
    const disagreed = [];
    for (const path of ["a", "ghost", "ghost.deep", "__proto__", ""]) {
      const asValidation = parseDynamicForm(withValidation(path), { mode: "strict" }).ok;
      const asRule = parseDynamicForm(withRule(path), { mode: "strict" }).ok;
      if (asValidation !== asRule) disagreed.push({ path, asValidation, asRule });
    }
    ctx.log.note("paths the two condition surfaces judge differently", { disagreed });

    expectEqual(disagreed, [], {
      claimIds: ["DYN-003"],
      what: "a path is a condition in one half of the document format and not in the other",
    });
  },
);
