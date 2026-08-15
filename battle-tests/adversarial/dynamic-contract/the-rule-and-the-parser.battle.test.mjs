/**
 * The author-time check and the parser, on the same documents.
 *
 * ADR 0024 sets the rule's job in one sentence: it decides nothing about validity, it hands the
 * reconstructed document to `parseDynamicForm` and reports what comes back. A rule that knew a list of
 * kinds separately would be a second answer to a question the parser already answers, and the two
 * would agree only until the next release.
 *
 * So the two are compared here on documents the parser has an opinion about. They agree on all of them
 * but one, and the one is where the rule decides whether a literal is a document at all: it looks for
 * "a version the parser knows" beside one of the two slots that carry a form. `{ version: 4, fields:
 * [...] }` is therefore not a document to it and it says nothing, while the parser refuses that
 * document with `MDY_DYNAMIC_UNSUPPORTED_VERSION`.
 *
 * The signal the heuristic reads is the thing that is wrong. An author who bumps a version by mistake,
 * or writes one for a Modyra newer than theirs, gets silence at the moment it would have cost nothing
 * and a refusal at runtime.
 *
 * What the rule deliberately does not see is not asked about here: ADR 0024 states that a document
 * assembled from a spread cannot be reconstructed, and the rule's own comment states that a bare array
 * is not detected because every array literal would become a candidate. Both are limits with reasons,
 * and a battle that called them findings would be arguing with a decision rather than testing one.
 */

import { Linter } from "eslint";
import { parseDynamicForm } from "@modyra/core";
import plugin from "@modyra/eslint-plugin";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const linter = new Linter();

/** The diagnostic codes the rule reports for a source literal. */
function codesFromRule(source) {
  const messages = linter.verify(source, {
    plugins: { modyra: plugin },
    rules: { "modyra/valid-dynamic-form": "error" },
  });
  return messages.map((message) => /\(([A-Z_0-9]+)\)$/.exec(message.message)?.[1] ?? message.message);
}

/** The diagnostic codes the parser reports for the same document. */
const codesFromParser = (document) =>
  parseDynamicForm(document, { mode: "strict" }).diagnostics.map((entry) => entry.code);

/** Documents that are all one field list, differing only in what is wrong with them. */
const CASES = Object.freeze([
  ["a clean document", { version: 3, fields: [{ name: "a", kind: "text" }] }],
  ["a duplicate name", { version: 3, fields: [{ name: "a", kind: "text" }, { name: "a", kind: "text" }] }],
  ["a reserved name", { version: 3, fields: [{ name: "__proto__", kind: "text" }] }],
  ["an unknown kind", { version: 3, fields: [{ name: "a", kind: "wormhole" }] }],
  ["a select with no options", { version: 3, fields: [{ name: "a", kind: "select" }] }],
  ["version 1", { version: 1, fields: [{ name: "a", kind: "text" }, { name: "a", kind: "text" }] }],
  ["a version nobody supports", { version: 4, fields: [{ name: "a", kind: "text" }] }],
]);

battle(
  {
    claims: ["DYN-003", "DYN-001"],
    title: "the author-time check reports what the parser reports",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the rule is wired and does report something, so silence below is the rule's answer
    // rather than a plugin that never ran.
    expectClaim(codesFromRule(`parseDynamicForm({version:3, fields:[{name:"a",kind:"text"},{name:"a",kind:"text"}]});`).length > 0, {
      claimIds: ["DYN-003"],
      what: "the rule reported nothing for a duplicate name, so it is not running at all",
    });

    const disagreed = [];
    for (const [what, document] of CASES) {
      const source = `parseDynamicForm(${JSON.stringify(document)});`;
      const fromRule = [...new Set(codesFromRule(source))].sort();
      const fromParser = [...new Set(codesFromParser(document))].sort();
      ctx.log.note("one document, two checks", { what, fromRule, fromParser });
      if (JSON.stringify(fromRule) !== JSON.stringify(fromParser)) disagreed.push({ what, fromRule, fromParser });
    }

    expectEqual(disagreed, [], {
      claimIds: ["DYN-003", "DYN-001"],
      what: "the author-time check and the parser disagree about a document, so which one an author believes decides what they learn",
      detail: JSON.stringify(disagreed),
    });
  },
);
