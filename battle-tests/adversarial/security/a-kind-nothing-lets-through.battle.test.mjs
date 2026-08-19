/**
 * A kind outside the catalogue, offered through every container the contract has.
 *
 * H-4 of `charter/fable5-hunts.md`, marked **defend**: the claim is believed true and mature, so the
 * hunt is to break it rather than to re-verify the happy path. It carries the charter's highest
 * severity if it gives way, because an unregistered kind rendering *is* the remote-contract security
 * boundary: a document is untrusted input, and the closed catalogue is what stands between it and a
 * renderer.
 *
 * `packages/widgets/src/catalog/kinds.ts` is closed by deliberate decision — its header comment is
 * the contract — and `MDY_FIELD_KINDS` is the seventeen. The attack is not the kind itself; it is
 * everything that might carry it past the check while the check is looking somewhere else.
 *
 * Eleven ways in, measured:
 *
 *   a flat field                       refused, MDY_DYNAMIC_UNKNOWN_KIND
 *   a tree leaf                        refused
 *   nested three groups deep           refused
 *   inside a record row                refused
 *   inside an array item               refused
 *   an array inside a record           refused
 *   named by a layout slot             refused
 *   a kind that is an object with toString  refused
 *   a kind in different case           refused
 *   a kind with a trailing space       refused
 *   a field smuggled through a draft   dropped, reported as draft-shape
 *
 * The last is a different door and worth keeping beside the others: a draft carries values, not
 * kinds, so the way to introduce an unregistered control through it would be a *field* the document
 * never declared. That is refused too, and reported.
 *
 * This battle is green and is meant to stay green. It is the pin under the sentence *"the catalogue
 * is closed"*, which is the kind of claim that stops being checked precisely because everyone
 * believes it — and the one whose failure would be worst.
 */

import {
  MDY_FIELD_KINDS,
  buildFlatFormSchema,
  createForm,
  parseDynamicForm,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const UNKNOWN = "richtext";
const leaf = (kind) => ({ node: "field", field: { kind, label: "X" } });

/** Every container this contract has, each carrying the same unregistered kind. */
const WAYS_IN = Object.freeze([
  { how: "a flat field", document: { version: 2, fields: [{ name: "a", kind: UNKNOWN, label: "A" }] } },
  { how: "a tree leaf", document: { version: 2, schema: { node: "group", children: { a: leaf(UNKNOWN) } } } },
  {
    how: "nested three groups deep",
    document: { version: 2, schema: { node: "group", children: { g1: { node: "group", children: { g2: { node: "group", children: { a: leaf(UNKNOWN) } } } } } } },
  },
  {
    how: "inside a record row",
    document: { version: 2, schema: { node: "group", children: { rows: { node: "record", item: { node: "group", children: { a: leaf(UNKNOWN) } } } } } },
  },
  {
    how: "inside an array item",
    document: { version: 2, schema: { node: "group", children: { list: { node: "array", item: { node: "group", children: { a: leaf(UNKNOWN) } } } } } },
  },
  {
    how: "an array inside a record",
    document: { version: 2, schema: { node: "group", children: { rows: { node: "record", item: { node: "group", children: { l: { node: "array", item: { node: "group", children: { a: leaf(UNKNOWN) } } } } } } } } },
  },
  {
    how: "named by a layout slot",
    document: { version: 2, fields: [{ name: "a", kind: UNKNOWN, label: "A" }], layout: [{ kind: "section", id: "s", children: ["a"] }] },
  },
  { how: "a kind that is an object", document: { version: 2, fields: [{ name: "a", kind: { toString: () => "text" }, label: "A" }] } },
  { how: "a kind in different case", document: { version: 2, fields: [{ name: "a", kind: "TEXT", label: "A" }] } },
  { how: "a kind with a trailing space", document: { version: 2, fields: [{ name: "a", kind: "text ", label: "A" }] } },
]);

/** A storage already holding a draft, as a script on the origin could have left one. */
function storageHolding(value) {
  const written = new Map([["k", JSON.stringify({ __mdyDraft: 1, savedAt: Date.now(), value })]]);
  return {
    read: (key) => written.get(key) ?? null,
    write: (key, entry) => {
      written.set(key, entry);
    },
    remove: (key) => {
      written.delete(key);
    },
  };
}

battle(
  {
    claims: ["SEC-001", "DYN-004"],
    title: "no container carries an unregistered kind past the parser",
    environments: ["node"],
  },
  async (ctx) => {
    const observed = WAYS_IN.map((entry) => {
      const parsed = parseDynamicForm(entry.document, { mode: "strict" });
      return {
        how: entry.how,
        fields: parsed.fields.length,
        namedTheKind: parsed.diagnostics.some((each) => each.code === "MDY_DYNAMIC_UNKNOWN_KIND"),
      };
    });
    ctx.log.note("an unregistered kind, offered through every container", observed);

    // The instrument: the same documents with a registered kind must produce something, or
    // "everything is refused" would describe containers that never work.
    //
    // A collection container produces **no field**, and that is not a failure here: the flatten walk
    // stops at the first collection boundary, so the cells live inside the item and the collection is
    // what comes out. Counting either is what makes this a control rather than a second finding — the
    // walk's boundary is recorded as finding 6 and is not what this battle is about.
    const withAKnownKind = WAYS_IN.map((entry) => {
      const text = JSON.stringify(entry.document)
        .replaceAll(`"${UNKNOWN}"`, '"text"')
        .replaceAll('"TEXT"', '"text"')
        .replaceAll('"text "', '"text"');
      const parsed = parseDynamicForm(JSON.parse(text), { mode: "strict" });
      return { how: entry.how, produced: parsed.fields.length + parsed.collections.length };
    });
    expectClaim(
      MDY_FIELD_KINDS.length === 17 && withAKnownKind.filter((row) => row.produced > 0).length >= 8,
      {
        claimIds: ["DYN-004"],
        what: "the same containers produce nothing with a registered kind either, so the refusals below say nothing about the catalogue",
        detail: JSON.stringify(withAKnownKind),
      },
    );

    expectEqual(
      observed.filter((row) => row.fields > 0 || !row.namedTheKind).map((row) => row.how),
      [],
      {
        claimIds: ["SEC-001", "DYN-004"],
        what: "a container carried an unregistered kind past the parser, or refused it without naming the kind, and the closed catalogue is what stands between an untrusted document and a renderer",
      },
    );

    // The other door: a draft carries values rather than kinds, so what it could introduce is a
    // field the document never declared.
    const parsed = parseDynamicForm({ version: 1, fields: [{ name: "known", kind: "text", label: "K" }] }, { mode: "strict" });
    const reported = [];
    const form = createForm(buildFlatFormSchema(parsed.fields), {
      draft: { key: "k", storage: storageHolding({ known: "restored", smuggled: "a field nobody declared" }) },
      devWarnings: false,
      security: { onViolation: (violation) => reported.push(violation.kind) },
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 250));
      ctx.log.note("a draft naming a field the document never declared", {
        value: form.getValue(),
        fieldNames: form.fieldNames(),
        reported,
      });

      expectEqual(form.fieldNames().filter((name) => name === "smuggled"), [], {
        claimIds: ["SEC-001"],
        what: "a draft introduced a field the document never declared",
      });
    } finally {
      form.destroy();
    }
  },
);
