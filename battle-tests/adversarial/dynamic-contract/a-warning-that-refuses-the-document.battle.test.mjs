/**
 * The one warning a parse can report, and what it costs.
 *
 * `MdyDynamicDiagnostic.severity` is published as `"warning" | "error"`, so a consumer reads it to
 * tell what must be fixed from what is worth knowing. Every advisory finding the parser has — a
 * validator written on the field, a required a slider always satisfies, two options of one value —
 * carries `severity: "error"`. Exactly one diagnostic in the parser is a warning:
 * `MDY_DYNAMIC_COUNT_INCOMPLETE`, which says the counts are a floor because the reader stopped
 * counting.
 *
 * Strict mode accepts a document only when it reports nothing at all, so that warning refuses the
 * document. Measured, one declaration over the reader's counting budget:
 *
 *     99,999 declarations   strict: ok, 99,999 fields      lenient: ok, 99,999 fields
 *    100,001 declarations   strict: refused, 0 fields      lenient: ok, 100,001 fields
 *
 * Nothing in the second document is malformed. It is refused for a fact about the reader, and the
 * two modes disagree about the whole document rather than about a field in it.
 *
 * The battle asks that a diagnostic the parser itself calls a warning does not refuse the document.
 * Either repair answers it: strict fails on errors and not on warnings, or the parser stops calling
 * this a warning and says the document is too large to read.
 */

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { parseDynamicForm } from "@modyra/core";

/** A group of `count` well-formed leaves. Nothing here is malformed at any size. */
function wideBy(count) {
  const children = {};
  for (let index = 0; index < count; index += 1) {
    children[`f${index}`] = { node: "field", field: { kind: "text", label: "L" } };
  }
  return { version: 3, schema: { node: "group", children } };
}

/** What each mode makes of one document. */
function bothModes(document) {
  const strict = parseDynamicForm(document, { mode: "strict" });
  const lenient = parseDynamicForm(document);
  return {
    strict: { ok: strict.ok, fields: strict.fields.length },
    lenient: { ok: lenient.ok, fields: lenient.fields.length },
    severities: [...new Set(strict.diagnostics.map((diagnostic) => `${diagnostic.code}:${diagnostic.severity}`))],
  };
}

battle(
  {
    claims: ["DYN-003"],
    title: "a diagnostic the parser calls a warning does not refuse the document",
    environments: ["node"],
    requires: ["structural"],
  },
  async (ctx) => {
    // The control: a large document is not refused for being large, so what the measurement below
    // finds is the counting budget and not the size.
    const under = bothModes(wideBy(99_999));
    ctx.log.note("just under the reader's counting budget", under);
    expectEqual(under, { strict: { ok: true, fields: 99_999 }, lenient: { ok: true, fields: 99_999 }, severities: [] }, {
      claimIds: ["DYN-003"],
      what: "a document of well-formed fields is already refused below the counting budget, so nothing below is about the budget",
    });

    const over = bothModes(wideBy(100_001));
    ctx.log.note("one declaration over it", over);

    // The premise: the only thing this document is told is a warning.
    expectEqual(over.severities, ["MDY_DYNAMIC_COUNT_INCOMPLETE:warning"], {
      claimIds: ["DYN-003"],
      what: "the document over the budget is refused for something other than the count, so this battle is measuring the wrong thing",
    });

    // And a warning is not a refusal: strict keeps the fields, as the mode that reads the same
    // document leniently does.
    expectClaim(over.strict.ok && over.strict.fields === over.lenient.fields, {
      claimIds: ["DYN-003"],
      what: "a warning refused the whole document in strict mode, so a document with nothing malformed in it yields no fields at all",
      detail: JSON.stringify(over),
    });
  },
);
