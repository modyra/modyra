/**
 * Every part a person operates is named by something the contract declares.
 *
 * Most are named by being pointed at — a caption's `for`, an opener's `aria-controls` — and the
 * relations say so. Six are not, and they are not machinery: a person types in a panel's search box,
 * in the second date of a range, in each half of a time. Nothing said what those are called, so each
 * renderer chose, and they chose differently — one built the name by hand from the caption and an
 * English word, another read it from the message table, and a page in Italian said "end".
 *
 * `MDY_PART_NAMES` is the sentence that was missing. The words already existed for every one of them;
 * what did not was which word belongs to which part.
 *
 * The two tables are held to each other in both directions, because a binding to a message that does
 * not exist and a control named by nobody fail the same way at a page and differently here.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MDY_I18N_MESSAGES_DEFAULT,
  MDY_PART_NAMES,
  MDY_WIDGET_CONTRACTS,
  MDY_WIDGET_KINDS,
  MDY_WIDGET_RELATIONS,
} from "../dist/index.js";

/** Every part some relation names, either as its source or as somewhere a reference lands. */
function partsInARelation(kind) {
  const named = new Set();
  for (const relation of MDY_WIDGET_RELATIONS[kind] ?? []) {
    named.add(relation.from);
    for (const target of relation.to) named.add(target);
  }
  return named;
}

test("every binding names a message the package publishes", () => {
  const bindings = Object.entries(MDY_PART_NAMES);
  assert.ok(bindings.length >= 4, `only ${bindings.length} bindings — this asserts nothing`);
  for (const [part, key] of bindings) {
    assert.equal(typeof MDY_I18N_MESSAGES_DEFAULT[key], "string",
      `${part} says it is named by ${key} and no such message exists. A pointer to nothing is worse `
      + "than no pointer: it stops the search");
  }
});

test("every binding names a part the contract declares", () => {
  for (const part of Object.keys(MDY_PART_NAMES)) {
    const [kind, name] = part.split(".");
    assert.ok(MDY_WIDGET_KINDS.includes(kind), `${part} names a kind the catalogue does not have`);
    assert.ok(name in MDY_WIDGET_CONTRACTS[kind].parts,
      `${part} names a part ${kind} does not declare, so the binding is about nothing`);
  }
});

test("a part is named by a relation or by a message, never by both and never by neither", () => {
  const both = [];
  const neither = [];
  for (const kind of MDY_WIDGET_KINDS) {
    const pointed = partsInARelation(kind);
    for (const node of MDY_WIDGET_CONTRACTS[kind].structure.nodes) {
      if (!["input", "select", "textarea"].includes(node.element)) continue;
      const key = `${kind}.${node.part}`;
      const bound = key in MDY_PART_NAMES;
      if (pointed.has(node.part) && bound) both.push(key);
      // The one exception is machinery: a part nothing points at *and* nothing names, because nobody
      // reaches it. It is recorded in its own check, and a control that joins it there has to earn
      // the classification by being unreachable rather than by being left out here.
      if (!pointed.has(node.part) && !bound) neither.push(key);
    }
  }
  assert.deepEqual(both, [],
    "a part is named twice, by a relation and by a message. Two ways to name one element is the "
    + "divergence this binding removes, not a redundancy that makes it safer");
  assert.deepEqual(neither, ["colors.control"],
    "a part renders a control and neither a relation nor a message names it, so what a person hears "
    + "there is each renderer's own decision");
});

test("a message bound to a part is translated everywhere the package speaks", async () => {
  // A name that falls back to English on a translated page is the defect this binding exists to stop
  // being possible one renderer at a time. Read from the presets rather than from a list of locales.
  const { MDY_I18N_PRESETS } = await import("../dist/index.js");
  const locales = Object.entries(MDY_I18N_PRESETS ?? {});
  assert.ok(locales.length >= 2, `only ${locales.length} locale(s) — this asserts nothing`);
  for (const [locale, messages] of locales) {
    for (const [part, key] of Object.entries(MDY_PART_NAMES)) {
      assert.equal(typeof messages[key], "string",
        `${part} is named by ${key} and ${locale} does not carry it, so that page says it in English`);
    }
  }
});

test("two parts of one kind are not named the same thing", () => {
  /**
   * The property a renderer check cannot hold.
   *
   * A check that asserts "the box says what the binding says" reads the expected value through the
   * binding, so changing the binding moves both sides together and the check stays green — measured:
   * pointing a range's second box at the *first* box's message broke nothing anywhere. It is a
   * tautology about following the table, which is worth having and is not a statement about the
   * table being right.
   *
   * What can be said from here is that two controls a person tells apart must be told apart: the two
   * halves of a range, the two halves of a time. If they share a name, a reader hears the same words
   * on both and has no way to know which one they are in.
   */
  const byKind = new Map();
  for (const [part, key] of Object.entries(MDY_PART_NAMES)) {
    const kind = part.split(".")[0];
    if (!byKind.has(kind)) byKind.set(kind, []);
    byKind.get(kind).push([part, key]);
  }
  const shared = [];
  for (const [kind, bindings] of byKind) {
    if (bindings.length < 2) continue;
    const seen = new Map();
    for (const [part, key] of bindings) {
      if (seen.has(key)) shared.push(`${kind}: ${seen.get(key)} and ${part} both say ${key}`);
      seen.set(key, part);
    }
  }
  assert.deepEqual(shared, [],
    "two parts of one kind are announced as the same words, so a reader in one cannot tell it from "
    + "the other");

  // And the perimeter, so a table with one binding per kind cannot pass this by having nothing to
  // compare: at least one kind must declare two.
  assert.ok([...byKind.values()].some((bindings) => bindings.length >= 2),
    "no kind binds two parts, so the comparison above never runs");
});
