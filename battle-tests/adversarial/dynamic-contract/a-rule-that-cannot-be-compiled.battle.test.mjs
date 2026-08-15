/**
 * A rule an author wrote that cannot be compiled, and a strict parser that approves it.
 *
 * `validators.pattern` is a string in a document, and a string is not always a regular expression.
 * The engine knows: the layer that compiles it skips an unparseable source and says so —
 * *Skipped dynamic pattern validator: invalid RegExp source "["* — which is the behaviour
 * `document-patterns` describes as the engine treating that string as needing care.
 *
 * The parser above it does not know. `parseDynamicForm` reports **no diagnostic**, keeps the rule in
 * its output, and answers `ok: true` in **strict** mode. So a document with a pattern that cannot be
 * compiled passes the gate an author runs before saving, and produces a field with no pattern rule on
 * it.
 *
 * What the author is told, at the moment they could still fix it, is nothing. What they are told
 * later is a `console.warn` in development, which production removes — and a rule they believe is
 * protecting their data is not there.
 *
 * Both doors are in the battle, because the finding is the difference between them: the lower one
 * knows the pattern is bad, so the parser could.
 *
 * Sibling of the pattern-cost finding: the same operand, the other way of being unusable.
 */

import {
  buildDynamicFieldValidators,
  buildDynamicValidators,
  parseDynamicForm,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const documentWith = (validators) => ({
  version: 3,
  fields: [{ name: "f", kind: "text", label: "F", validators }],
});

/** Parse in both modes and report what the author would be told and what survived. */
function parsed(validators) {
  const lenient = parseDynamicForm(documentWith(validators), { mode: "lenient" });
  const strict = parseDynamicForm(documentWith(validators), { mode: "strict" });
  const field = (lenient.fields ?? [])[0] ?? null;
  let compiled = null;
  try {
    compiled = (buildDynamicFieldValidators(field).validators ?? []).length;
  } catch {
    compiled = "threw";
  }
  return {
    diagnostics: (lenient.diagnostics ?? []).map((each) => each.code),
    strictOk: strict.ok,
    kept: field?.validators ?? null,
    compiled,
  };
}

/** Whatever the compiling layer says while it builds one rule. */
function whileCompiling(source) {
  const said = [];
  const realWarn = console.warn;
  console.warn = (...parts) => said.push(parts.join(" "));
  let built;
  try {
    built = (buildDynamicValidators({ pattern: source }).validators ?? []).length;
  } finally {
    console.warn = realWarn;
  }
  return { built, said };
}

battle(
  {
    claims: ["DYN-003", "VAL-004"],
    title: "a pattern the engine cannot compile is one the parser says so about",
    environments: ["node"],
  },
  async (ctx) => {
    // The first control: a pattern that compiles is kept, compiled and unremarked.
    const good = parsed({ pattern: "^a+$" });
    ctx.log.note("a pattern that compiles", good);

    expectEqual([good.diagnostics, good.strictOk], [[], true], {
      claimIds: ["DYN-003"],
      what: "a document with a working pattern was reported on, so nothing below is about the pattern",
      detail: JSON.stringify(good),
    });

    // The second control, and the reason this is a gap rather than an absence: the layer underneath
    // knows the source is not a regular expression, and drops the rule rather than throwing.
    const compiling = whileCompiling("[");
    const working = whileCompiling("^a+$");
    ctx.log.note("what the compiling layer knows", { compiling, working });

    expectClaim(compiling.built < working.built && compiling.said.some((line) => line.includes("[modyra]")), {
      claimIds: ["VAL-004"],
      what: "the compiling layer no longer detects an unparseable pattern, so the parser has nothing it could have known",
      detail: JSON.stringify({ compiling, working }),
    });

    // And the parser above it.
    const bad = parsed({ pattern: "[" });
    ctx.log.note("a pattern that cannot be compiled", bad);

    // The premise: the rule survived the parse, so what follows is about what the author was told.
    expectEqual(bad.kept, { pattern: "[" }, {
      claimIds: ["DYN-003"],
      what: "the unparseable pattern did not survive the parse, so there is nothing kept to report",
    });

    // Either repair closes it: report it where a document is read, or drop the rule the parser cannot
    // keep. What this refuses is a strict gate approving a document whose rule will never run.
    expectClaim(bad.diagnostics.length > 0 || bad.strictOk === false, {
      claimIds: ["DYN-003", "VAL-004"],
      what: "a document whose pattern cannot be compiled was approved by strict mode with nothing reported",
      detail: JSON.stringify(bad),
    });
  },
);
