/**
 * The phrase a diagnostic promises to carry, and the two messages that answer to one code.
 *
 * `MDY_DYNAMIC_DIAGNOSTICS` publishes, for each code, the `phrase` its message carries. That pairing
 * is the only reason to publish a phrase at all: a consumer or a tool that wants to react to a kind
 * of problem matches on it.
 *
 * Six of the seven keep it. `MDY_DYNAMIC_UNSAFE_NAME` keeps it from one document shape and not the
 * other:
 *
 *     flat list   Dropped dynamic field "__proto__": name is reserved or contains forbidden path separators.
 *     tree        unsafe child name.
 *
 * One code, two messages. The second carries no phrase, names no field and gives no reason — the
 * `path` is populated in both, so the information exists, but a consumer matching the published
 * phrase sees half the cases.
 *
 * It is the same shape as the other findings around it: the flat list is the well-served path and the
 * tree is the poorer relation. Here it costs a sentence rather than a rule, which is why it is filed
 * where it is rather than beside them.
 */

import { MDY_DYNAMIC_DIAGNOSTICS, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const hostile = "__proto__";
const leaf = { node: "field", field: { kind: "text", label: "L" } };

/** Documents that reach a code, in whichever shapes reach it. */
const TRIGGERS = Object.freeze([
  ["MDY_DYNAMIC_UNSUPPORTED_VERSION", "flat", { version: 9, fields: [{ name: "f", kind: "text", label: "L" }] }],
  ["MDY_DYNAMIC_DUPLICATE_NAME", "flat", { version: 3, fields: [
    { name: "f", kind: "text", label: "L" }, { name: "f", kind: "text", label: "L" }] }],
  ["MDY_DYNAMIC_UNSAFE_NAME", "flat", { version: 3, fields: [{ name: hostile, kind: "text", label: "L" }] }],
  ["MDY_DYNAMIC_UNSAFE_NAME", "tree", { version: 3, schema: { node: "group", children: { [hostile]: leaf } } }],
  ["MDY_DYNAMIC_UNKNOWN_KIND", "flat", { version: 3, fields: [{ name: "f", kind: "wormhole", label: "L" }] }],
  ["MDY_DYNAMIC_UNKNOWN_KIND", "tree", { version: 3, schema: { node: "group", children: {
    f: { node: "field", field: { kind: "wormhole", label: "L" } } } } }],
  ["MDY_DYNAMIC_OPTIONS_REQUIRED", "flat", { version: 3, fields: [{ name: "f", kind: "select", label: "L" }] }],
  ["MDY_DYNAMIC_PATTERN_TOO_LONG", "flat", { version: 3, fields: [
    { name: "f", kind: "text", label: "L", validators: { pattern: "a".repeat(300) } }] }],
  ["MDY_DYNAMIC_PATTERN_TOO_COSTLY", "flat", { version: 3, fields: [
    { name: "f", kind: "text", label: "L", validators: { pattern: "(a+)+$" } }] }],
]);

battle(
  {
    claims: ["DYN-003"],
    title: "a diagnostic carries the phrase its code publishes, whichever shape produced it",
    open: "reported, not enforced: finding 104, open in battle-tests/reports/open-findings.md",
    environments: ["node"],
  },
  async (ctx) => {
    const phraseOf = new Map(MDY_DYNAMIC_DIAGNOSTICS.map((entry) => [entry.code, entry.phrase]));

    // The premise: phrases are published and non-empty, or there is nothing here to keep.
    expectClaim([...phraseOf.values()].every((phrase) => typeof phrase === "string" && phrase.length > 0), {
      claimIds: ["DYN-003"],
      what: "a published diagnostic has no phrase, so there is no promise about its message to check",
      detail: JSON.stringify([...phraseOf]),
    });

    const missing = [];
    const carried = [];
    for (const [code, shape, document] of TRIGGERS) {
      const parsed = parseDynamicForm(document, { mode: "strict" });
      const diagnostic = (parsed.diagnostics ?? []).find((each) => each.code === code);
      if (diagnostic === undefined) continue;

      const phrase = phraseOf.get(code);
      const message = String(diagnostic.message ?? "");
      if (message.includes(phrase)) carried.push(`${code} (${shape})`);
      else missing.push({ code, shape, phrase, message, path: diagnostic.path ?? null });
    }
    ctx.log.note("what each diagnostic said", { carried, missing });

    // The control: most messages do carry their phrase, so one that does not is a message rather
    // than a promise nothing keeps.
    expectClaim(carried.length >= missing.length + 3, {
      claimIds: ["DYN-003"],
      what: "hardly any message carries its published phrase, which makes this a question about what phrases are for rather than a defect in one of them",
      detail: JSON.stringify({ carried: carried.length, missing: missing.length }),
    });

    expectEqual(missing, [], {
      claimIds: ["DYN-003"],
      what: "a diagnostic's message does not carry the phrase its published entry says it carries, so a consumer matching on that phrase misses it",
    });
  },
);
