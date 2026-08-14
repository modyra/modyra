/**
 * A parser's account of its own work.
 *
 * `parseDynamicForm` returns `acceptedCount` and `rejectedCount` beside the fields and the
 * diagnostics. They are how a consumer reports on an untrusted document without re-deriving the
 * answer: "3 fields, 1 rejected — here is why". The guide's whole section on AI-generated documents
 * rests on that account being true, because the document came from somewhere the application does
 * not control.
 *
 * The account does not survive a document with something unknown in it. Two valid fields beside one
 * node whose kind nobody declared come back as no fields at all, `acceptedCount` 0 and
 * `rejectedCount` 0 — three children in, none accepted, none reported as rejected. A field whose
 * *kind* is unknown, or which has no kind, disappears the same way with no diagnostic naming it.
 *
 * Whether the valid fields should have survived is a question this battle deliberately does not
 * answer. The guide says lenient mode is for previews and that "valid fields survive"; claim DYN-003
 * records the opposite position — the whole document is refused when any part is unknown — for the
 * lint rule that reads the same contract. Both are defensible and they cannot both be the rule here.
 *
 * What is wrong under either reading is the counting. If the document was refused whole, three
 * children were rejected and the count says none. If the valid fields should have survived, they did
 * not. The assertions below are the ones that hold whichever way that decision goes.
 */

import { parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const field = (label) => ({ node: "field", field: { kind: "text", label } });
const parse = (children) =>
  parseDynamicForm({ version: 2, schema: { node: "group", children } }, { mode: "lenient" });

battle(
  {
    claims: ["DYN-001", "DYN-003"],
    title: "a parser that dropped something says how much it dropped",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: a document with nothing wrong is counted exactly, so what follows is about the
    // unknown node rather than about counters that never work.
    const clean = parse({ a: field("A"), b: field("B") });
    ctx.log.note("a document with nothing wrong", {
      fields: clean.fields.map((each) => each.name),
      accepted: clean.acceptedCount,
      rejected: clean.rejectedCount,
    });

    expectEqual([clean.fields.length, clean.acceptedCount, clean.rejectedCount], [2, 2, 0], {
      claimIds: ["DYN-001"],
      what: "a clean document was not counted as two accepted and none rejected",
    });

    for (const [what, broken] of [
      ["a node kind nobody declared", { node: "wormhole" }],
      ["a field kind nobody declared", { node: "field", field: { kind: "wormhole" } }],
      ["a field with no kind at all", { node: "field", field: {} }],
    ]) {
      const parsed = parse({ a: field("A"), b: field("B"), odd: broken });
      const kept = parsed.fields.map((each) => each.name);
      ctx.log.note("a document with something unknown in it", {
        what,
        kept,
        accepted: parsed.acceptedCount,
        rejected: parsed.rejectedCount,
        diagnostics: parsed.diagnostics.map((each) => each.code),
      });

      // Three children went in. Whatever the parser decided to do with them, the number it kept and
      // the number it says it rejected have to add up to the number it was given.
      expectEqual(kept.length + parsed.rejectedCount, 3, {
        claimIds: ["DYN-003"],
        what:
          `${what}: three children were parsed, ${kept.length} came back and ${parsed.rejectedCount} ` +
          `are reported as rejected`,
        detail: JSON.stringify({ kept, accepted: parsed.acceptedCount, rejected: parsed.rejectedCount }),
      });

      // And whatever was dropped is explained. A child that disappears without a diagnostic is a
      // document a consumer cannot debug and a person cannot be told about.
      expectClaim(parsed.diagnostics.length > 0, {
        claimIds: ["DYN-003"],
        what: `${what}: a child was dropped and nothing said so`,
        detail: JSON.stringify({ kept, diagnostics: parsed.diagnostics }),
      });
    }
  },
);

battle(
  {
    claims: ["DYN-001", "DYN-003"],
    title: "strict mode refuses a document with anything unknown in it",
    environments: ["node"],
  },
  async (ctx) => {
    // The half of the contract that holds, and the reason the battle above is about counting rather
    // than about the parser being blind: strict mode does exactly what the guide says.
    const strict = (children) =>
      parseDynamicForm({ version: 2, schema: { node: "group", children } }, { mode: "strict" });

    const clean = strict({ a: field("A") });
    expectClaim(clean.ok === true && clean.fields.length === 1, {
      claimIds: ["DYN-001"],
      what: "strict mode refused a document with nothing wrong with it",
      detail: JSON.stringify(clean.diagnostics),
    });

    const refused = strict({ a: field("A"), odd: { node: "wormhole" } });
    ctx.log.note("strict mode against an unknown node", {
      ok: refused.ok,
      fields: refused.fields.length,
      diagnostics: refused.diagnostics.map((each) => `${each.code}@${each.path}`),
    });

    expectEqual([refused.ok, refused.fields.length], [false, 0], {
      claimIds: ["DYN-003"],
      what: "strict mode accepted a document carrying a node nobody declared",
    });

    // The diagnostic names where it is, which is what makes an author able to fix the document.
    expectClaim(refused.diagnostics.some((each) => String(each.path).includes("odd")), {
      claimIds: ["DYN-003"],
      what: "the refusal did not say which part of the document caused it",
      detail: JSON.stringify(refused.diagnostics),
    });
  },
);
