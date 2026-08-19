/**
 * The codes a parse can report, against the list the package publishes.
 *
 * `MDY_DYNAMIC_DIAGNOSTICS` is exported, and it is what a consumer switches on: each entry a `code`
 * and the `phrase` its message carries. It is the only published account of what a parse can say.
 *
 * The parser says more. Driving it with one malformed document per known mistake, plus a mode it
 * does not know, plus every published fixture, seven codes come back that the list does not have:
 *
 *     MDY_DYNAMIC_INVALID_FIELD              a validator of the wrong type
 *     MDY_DYNAMIC_INVALID_RULE               a rule pointing somewhere it may not
 *     MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE    a layout naming a field that is not there
 *     MDY_DYNAMIC_INVALID_LAYOUT             a column count outside 1..12
 *     MDY_DYNAMIC_INVALID_NODE               a node kind nobody declared
 *     MDY_DYNAMIC_INVALID_RECORD             a record with no item
 *     MDY_DYNAMIC_INVALID_ARRAY              an array initial value that is not a list
 *
 * Every one is reachable from an ordinary mistake, and a consumer handling the published list and
 * falling through on anything else meets a diagnostic they were never told about, on documents they
 * will certainly receive.
 *
 * The corpus reaches **every** published code, which is what makes an undeclared one a hole in the
 * list rather than a corpus that wandered somewhere unusual. Two of them cost what they cost: a leaf
 * 125 groups down for the path limit, and a hundred thousand and one declarations for the count.
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

/** Deep enough that the leaf's path passes the 512 characters a path may be. */
function nestedBy(depth) {
  let node = leaf({});
  for (let index = depth - 1; index >= 0; index -= 1) node = { node: "group", children: { [`g${index}`]: node } };
  return node;
}

/** Wide enough that the reader stops counting what the document declares. */
function wideBy(count) {
  const children = {};
  for (let index = 0; index < count; index += 1) children[`f${index}`] = leaf({});
  return { node: "group", children };
}

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
  ["a node kind nobody declared", { version: 3, schema: { node: "group", children: {
    rows: { node: "wormhole", label: "R", item: { node: "group", children: {} } } } } }],
  ["a record with no item", { version: 3, schema: { node: "group", children: {
    rows: { node: "record", label: "R" } } } }],
  ["an array initial value that is not a list", { version: 3, schema: { node: "group", children: {
    rows: { node: "array", label: "A", item: { node: "group", children: {} }, initialValue: "x" } } } }],
  ["two options of one value", { version: 3, fields: [{ name: "f", kind: "select", label: "L",
    options: [{ value: "a", label: "A" }, { value: "a", label: "B" }] }] }],
  ["a validator written on the field", { version: 3, fields: [
    { name: "f", kind: "text", label: "L", required: true }] }],
  ["a required a slider always satisfies", { version: 3, fields: [
    { name: "f", kind: "slider", label: "L", validators: { required: true } }] }],
  ["a condition that is not an expression", { version: 4, schema: { node: "group", children: {
    f: { ...leaf({}), when: "yes" } } } }],
  ["a context key nothing declares", { version: 4, schema: { node: "group", children: {
    f: { ...leaf({}), when: { op: "equals", operands: [{ context: "tier" }, "gold"] } } } } }],
  ["a member the contract does not name", { version: 3, fields: [{ name: "f", kind: "text", label: "L" }],
    rules: [{ effect: "hidden", target: "f", when: { field: "f", operator: "equals", value: "x" }, extra: 1 }] }],
  ["a path past the length limit", { version: 3, schema: nestedBy(125) }],
  ["more declarations than the reader counts", { version: 3, schema: wideBy(100_001) }],
]);

/** A mode is not a document, and it is the one refusal a corpus of documents cannot reach. */
const MISTAKEN_MODE = "nope";

battle(
  {
    claims: ["DYN-003"],
    title: "every code a parse reports is one the published list has",
    open: "reported, not enforced: finding 103, open in battle-tests/reports/open-findings.md",
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
      // A fixture's context twin is not a document: it holds what a host supplies, and parsing it
      // as one would put a refusal in this table that no published document produces.
      for (const file of readdirSync(join(FIXTURES, version)).filter((each) => each.endsWith(".json") && !each.endsWith(".context.json"))) {
        const parsed = parseDynamicForm(JSON.parse(readFileSync(join(FIXTURES, version, file), "utf8")), {
          mode: "strict",
        });
        for (const diagnostic of parsed.diagnostics ?? []) record(diagnostic.code, `${version}/${file}`);
      }
    }

    // The mode the reader is given is refused like a document is, and no document can carry it.
    for (const diagnostic of parseDynamicForm({ version: 3, fields: [] }, { mode: MISTAKEN_MODE }).diagnostics ?? []) {
      record(diagnostic.code, "a mode this reader does not know");
    }

    const undeclared = [...seen].filter(([code]) => !declared.has(code)).map(([code, from]) => ({ code, from }));
    const unreached = [...declared].filter((code) => !seen.has(code));
    ctx.log.note("what a parse can say", { seen: [...seen.keys()], undeclared, unreached });

    // The control: the corpus reaches every published code, so an undeclared one is a code the list
    // is missing rather than a corpus that wandered somewhere unusual.
    expectEqual(unreached, [], {
      claimIds: ["DYN-003"],
      what: "the corpus no longer reaches every published code, so it has stopped exercising the paths it compares against",
    });

    expectEqual(undeclared, [], {
      claimIds: ["DYN-003"],
      what: "a parse reported a diagnostic code the published list does not have, so a consumer switching on that list falls through on an ordinary document",
    });
  },
);
