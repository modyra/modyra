/**
 * The codes a parse can report, against the list the package publishes.
 *
 * `MDY_DYNAMIC_DIAGNOSTICS` is exported, and it is what a consumer switches on: seven entries, each a
 * `code` and the `phrase` its message carries. It is the only published account of what a parse can
 * say.
 *
 * The parser says more. Driving it with one malformed document per known mistake, plus every
 * published fixture, three codes come back that the list does not have —
 * `MDY_DYNAMIC_INVALID_FIELD`, `MDY_DYNAMIC_INVALID_RULE`, `MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE`.
 * All three are reachable from an ordinary mistake: a validator of the wrong type, a rule pointing
 * somewhere it may not, a layout naming a field that is not there.
 *
 * A consumer handling the seven and falling through on anything else meets a diagnostic they were
 * never told about, on documents they will certainly receive.
 *
 * The corpus is deliberately built from mistakes rather than from fuzzing, so each row is a thing an
 * author does. `__proto__` is spelled as a computed key: written as a literal in an object it sets
 * the prototype and creates no property at all, which made an earlier pass report the unsafe-name
 * code as unreachable when it fires perfectly well.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { MDY_DYNAMIC_DIAGNOSTICS, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const FIXTURES = resolve(HERE, "..", "..", "..", "spec", "fixtures", "dynamic-form");

const leaf = (over) => ({ node: "field", field: { kind: "text", label: "L", ...over } });
const hostileName = "__proto__";

/** One document per mistake an author makes. */
const MISTAKES = Object.freeze([
  ["a version nothing supports", { version: 9, fields: [{ name: "f", kind: "text", label: "L" }] }],
  ["two fields of one name", { version: 3, fields: [
    { name: "f", kind: "text", label: "L" }, { name: "f", kind: "text", label: "L" }] }],
  ["a name that is reserved", { version: 3, schema: { node: "group", children: { [hostileName]: leaf({}) } } }],
  ["a kind nobody declared", { version: 3, schema: { node: "group", children: { f: leaf({ kind: "wormhole" }) } } }],
  ["a select with no options", { version: 3, fields: [{ name: "f", kind: "select", label: "L" }] }],
  ["options that are not a list", { version: 3, fields: [{ name: "f", kind: "select", label: "L", options: "x" }] }],
  ["a pattern past the length limit", { version: 3, fields: [
    { name: "f", kind: "text", label: "L", validators: { pattern: "a".repeat(300) } }] }],
  ["a pattern that backtracks", { version: 3, fields: [
    { name: "f", kind: "text", label: "L", validators: { pattern: "(a+)+$" } }] }],
  ["a pattern that is not a string", { version: 3, schema: { node: "group", children: {
    f: leaf({ validators: { pattern: 7 } }) } } }],
  ["a rule pointing nowhere", { version: 3, fields: [{ name: "f", kind: "text", label: "L" }],
    rules: [{ effect: "hidden", target: "NOPE", when: { field: "f", operator: "equals", value: "x" } }] }],
  ["a layout naming nothing", { version: 3, fields: [{ name: "f", kind: "text", label: "L" }],
    layout: [{ kind: "section", id: "s", children: ["NOPE"] }] }],
  ["a column count outside 1..12", { version: 3, fields: [{ name: "f", kind: "text", label: "L" }],
    layout: [{ kind: "columns", id: "c", at: { base: 99 }, columns: [[{ ref: "f" }]] }] }],
  ["a validator of the wrong type", { version: 3, fields: [
    { name: "f", kind: "number", label: "L", validators: { min: "five" } }] }],
]);

battle(
  {
    claims: ["DYN-003"],
    title: "every code a parse reports is one the published list has",
    environments: ["node"],
  },
  async (ctx) => {
    const declared = new Set(MDY_DYNAMIC_DIAGNOSTICS.map((entry) => entry.code));

    // The premise: there is a published list to compare against.
    expectClaim(declared.size >= 5, {
      claimIds: ["DYN-003"],
      what: "the published diagnostic list is nearly empty, so there is nothing to compare a parse against",
      detail: JSON.stringify([...declared]),
    });

    const seen = new Map();
    const record = (code, from) => {
      if (!seen.has(code)) seen.set(code, from);
    };

    for (const [what, document] of MISTAKES) {
      const parsed = parseDynamicForm(document, { mode: "strict" });
      for (const diagnostic of parsed.diagnostics ?? []) record(diagnostic.code, what);
    }
    for (const version of readdirSync(FIXTURES)) {
      for (const file of readdirSync(join(FIXTURES, version))) {
        const parsed = parseDynamicForm(JSON.parse(readFileSync(join(FIXTURES, version, file), "utf8")), {
          mode: "strict",
        });
        for (const diagnostic of parsed.diagnostics ?? []) record(diagnostic.code, `${version}/${file}`);
      }
    }

    const undeclared = [...seen].filter(([code]) => !declared.has(code)).map(([code, from]) => ({ code, from }));
    const unreached = [...declared].filter((code) => !seen.has(code));
    ctx.log.note("what a parse can say", { seen: [...seen.keys()], undeclared, unreached });

    // The control: the corpus reaches most of the published list, so an undeclared code is a code the
    // list is missing rather than a corpus that wandered somewhere unusual.
    expectClaim(declared.size - unreached.length >= declared.size / 2, {
      claimIds: ["DYN-003"],
      what: "this corpus triggers less than half the published list, so it is not exercising the ordinary paths",
      detail: JSON.stringify({ declared: [...declared], unreached }),
    });

    expectEqual(undeclared, [], {
      claimIds: ["DYN-003"],
      what: "a parse reported a diagnostic code the published list does not have, so a consumer switching on that list falls through on an ordinary document",
    });
  },
);
