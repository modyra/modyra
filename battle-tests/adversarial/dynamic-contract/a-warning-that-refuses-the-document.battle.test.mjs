/**
 * The one warning a parse can report, and what it does not cost.
 *
 * `MdyDynamicDiagnostic.severity` is published as `"warning" | "error"`, so a consumer reads it to
 * tell what must be fixed from what is worth knowing. Strict mode reads it too: it refuses a document
 * that reports an **error**, and a warning leaves the document usable in either mode.
 *
 * Exactly one diagnostic in the parser is a warning. `MDY_DYNAMIC_COUNT_INCOMPLETE` says the counts
 * are a floor because the reader stopped counting — a fact about the reader, not a defect in the
 * document, and the fields are all there to be had:
 *
 *      99,999 declarations   strict: ok,  99,999 fields   lenient: ok,  99,999 fields
 *     100,001 declarations   strict: ok, 100,001 fields   lenient: ok, 100,001 fields
 *
 * The battle holds the two modes to the same answer at the budget's edge, so that a severity the
 * result publishes keeps meaning something at the one door that acts on it.
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
