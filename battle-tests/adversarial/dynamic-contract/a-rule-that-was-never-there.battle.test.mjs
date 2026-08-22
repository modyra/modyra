/**
 * A rule a document declares, and a form that does not have it.
 *
 * `spec/dynamic-form-v3.schema.json` publishes the shape of a document, and its `validators` object
 * is closed: `"additionalProperties": false`, over `required`, `email`, `min`, `max`, `minLength`,
 * `maxLength` and `pattern`. Anything else is not a document.
 *
 * `parseDynamicForm` takes one anyway. `{ multipleOf: 3 }`, `{ step: 0.5 }`, a misspelled
 * `minLenght` — each is accepted, `ok: true`, the field counted, and **no diagnostic at all**. The
 * rule is then simply not there: the value the author meant to constrain is unconstrained, and the
 * form reports itself valid.
 *
 * That is the one place this engine says nothing. An unknown field *kind* is refused by name. A
 * duplicate field name raises `MDY_DYNAMIC_DUPLICATE_NAME`. A pattern that will not compile is
 * skipped *with* a diagnostic. A rule naming a path the form does not declare is refused where it
 * arrives. A validator key nobody implements is dropped in silence.
 *
 * The documents this contract exists for are the ones nobody typed by hand — a CMS, a saved project,
 * a model's output, which `docs/guides/ai-generated-forms.md` is a whole guide about. A misspelling
 * in one of those produces a form with a rule missing and nothing anywhere that says so.
 *
 * The allowed set is read from the published schema rather than copied into this file, so a key added
 * to the contract later stops being a finding here without anyone editing this battle.
 *
 * The second battle is the same disappearance by a different route. `rules` and `validations` arrive
 * with contract v2 — the guide says so in a heading. A document that declares one and says
 * `version: 1` keeps neither, and is told nothing. `version: 1` is the envelope
 * `docs/guides/ai-generated-forms.md` publishes in the prompt it tells readers to give a model.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { buildDynamicValidators, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const SCHEMA = resolve(HERE, "..", "..", "..", "spec", "dynamic-form-v3.schema.json");

/** Keys a document may put in `validators`, according to the published schema. */
function allowedByTheSchema() {
  const schema = JSON.parse(readFileSync(SCHEMA, "utf8"));
  const validators = schema.$defs?.validators ?? schema.definitions?.validators ?? null;
  return {
    closed: validators?.additionalProperties === false,
    keys: Object.keys(validators?.properties ?? {}),
  };
}

/** Keys the schema forbids, chosen to be the ones an author would plausibly write. */
const UNKNOWN = Object.freeze([
  ["multipleOf", 3],
  ["step", 0.5],
  ["minLenght", 3],
  ["maximum", 5],
  ["wormhole", 7],
]);

const documentWith = (validators) => ({
  version: 2,
  fields: [{ name: "f", kind: "number", label: "L", validators }],
});

battle(
  {
    claims: ["DYN-001", "DYN-003"],
    title: "a validator key the published schema forbids is one the parser says something about",
    open: "reported, not enforced: finding 26, open in battle-tests/reports/open-findings.md",
    environments: ["node"],
  },
  async (ctx) => {
    const schema = allowedByTheSchema();
    ctx.log.note("what the published schema allows in validators", schema);

    // The premise: the schema really is closed. If it stopped being, an unknown key would be a
    // document the contract admits and there would be nothing here to find.
    expectClaim(schema.closed && schema.keys.length > 0, {
      claimIds: ["DYN-001"],
      what: "the published schema does not close the validator set, so an unknown key is not a contract violation",
      detail: JSON.stringify(schema),
    });

    // The control: a key the schema does allow is parsed *and* enforced, so silence below is about
    // the key rather than about a parser that builds no rules at all.
    const known = parseDynamicForm(documentWith({ minLength: 3 }));
    const knownRules = buildDynamicValidators({ minLength: 3 }).validators;
    expectClaim(known.ok && known.acceptedCount === 1 && knownRules.length === 1, {
      claimIds: ["DYN-001"],
      what: "a validator the schema allows was not parsed into a rule, so this battle measures nothing",
      detail: JSON.stringify({ ok: known.ok, accepted: known.acceptedCount, rules: knownRules.length }),
    });

    expectClaim(knownRules.flatMap((run) => run("ab")).length > 0, {
      claimIds: ["DYN-001"],
      what: "the rule the schema allows does not refuse a value it should, so enforcement is not what is measured",
    });

    const silent = [];
    for (const [key, value] of UNKNOWN) {
      if (schema.keys.includes(key)) continue;

      const parsed = parseDynamicForm(documentWith({ [key]: value }));
      const rules = buildDynamicValidators({ [key]: value }).validators;
      const said = (parsed.diagnostics ?? []).map((each) => `${each.code ?? ""} ${each.message ?? ""}`.trim());
      const named = said.some((line) => line.includes(key));

      ctx.log.note("a validator key the schema forbids", {
        key, ok: parsed.ok, accepted: parsed.acceptedCount, rules: rules.length, said,
      });

      // Either the document is refused, or something names the key. What must not happen is a form
      // that reports itself whole while the rule its document declared is absent.
      if (rules.length === 0 && parsed.ok && !named) {
        silent.push({ key, ok: parsed.ok, accepted: parsed.acceptedCount, rules: rules.length, diagnostics: said });
      }
    }

    expectEqual(silent, [], {
      claimIds: ["DYN-001", "DYN-003"],
      what: "a document declared a rule the published schema forbids, the parser accepted it without a word, and the rule is not in the form",
    });
  },
);

/** A rule and a validation, each well formed, each arriving with contract v2. */
const RULE = Object.freeze({
  effect: "hidden",
  target: "g",
  when: { field: "f", operator: "equals", value: "x" },
});
const VALIDATION = Object.freeze({
  when: { op: "equals", operands: [{ path: "f" }, "x"] },
  message: "m",
});
const TWO_FIELDS = Object.freeze([
  { name: "f", kind: "text", label: "L" },
  { name: "g", kind: "text", label: "G" },
]);

battle(
  {
    claims: ["DYN-001", "DYN-003"],
    title: "a construct a version predates is one the parser says something about",
    open: "reported, not enforced: finding 26, open in battle-tests/reports/open-findings.md",
    environments: ["node"],
  },
  async (ctx) => {
    const lost = [];
    for (const [what, key, value] of [["a rule", "rules", RULE], ["a validation", "validations", VALIDATION]]) {
      const kept = [];
      for (const version of [1, 2, 3]) {
        const parsed = parseDynamicForm({ version, fields: TWO_FIELDS, [key]: [value] });
        const said = (parsed.diagnostics ?? []).map((each) => `${each.code ?? ""} ${each.message ?? ""}`.trim());
        kept.push({ version, ok: parsed.ok, kept: (parsed[key] ?? []).length, said });
      }
      ctx.log.note(`${what}, at each envelope version`, { kept });

      // The control: the versions that have this construct keep it, so a version that drops it is
      // the version rather than a parser that never reads them.
      for (const row of kept.filter((each) => each.version >= 2)) {
        expectEqual(row.kept, 1, {
          claimIds: ["DYN-001"],
          what: `${what} was not kept at version ${row.version}, so this battle cannot tell a version gap from a parser that reads nothing`,
          detail: JSON.stringify(row),
        });
      }

      const first = kept.find((each) => each.version === 1);
      if (first.kept === 0 && first.ok && first.said.length === 0) {
        lost.push({ what, ...first });
      }
    }

    expectEqual(lost, [], {
      claimIds: ["DYN-001", "DYN-003"],
      what: "a document declared a construct its envelope version predates, the parser accepted the document, dropped the construct, and said nothing",
    });
  },
);
