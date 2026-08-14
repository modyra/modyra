/**
 * Nesting that starts from a list rather than from a keyed collection.
 *
 * Every nested fixture in this suite was keyed at the outermost level, and so was every nested test
 * in the workspace. That is not a matter of taste. A keyed row addresses its children under a name
 * the domain chose; a positional row addresses them under an index the collection chose. So a
 * collection *inside* a positional row arrives at a path whose parent segment is `0`, `1`, `2` —
 * which is exactly what a record's keys look like and exactly what an array's indices are, and
 * reading one as the other is a mistake no keyed fixture can provoke.
 *
 * Both crossings are here: an array under an array, and a record under an array. What is attacked is
 * the root moving underneath them — an insert, a move and a removal at the outer level, each of
 * which renumbers every path below it while the subtrees have to arrive intact somewhere else.
 */

import { buildDynamicFormSchema, createForm, flattenDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual, expectSameObservation } from "../../harness/assertions.mjs";
import { canonicalObservation } from "../../harness/canonical-snapshot.mjs";
import { buildSchema, POSITIONAL_ROOT_SPEC } from "../../models/schemas.mjs";

const BATCHES = Object.freeze([
  Object.freeze({ label: "first", readings: [{ value: "1" }, { value: "2" }], tags: { alpha: { note: "A" } } }),
  Object.freeze({ label: "second", readings: [{ value: "9" }], tags: {} }),
  Object.freeze({ label: "third", readings: [], tags: { beta: { note: "B" }, gamma: { note: "G" } } }),
]);

/** The document a compiler emits for the same shape, rows and all. */
const DOCUMENT = Object.freeze({
  node: "group",
  children: {
    batches: {
      node: "array",
      initialValue: BATCHES.map((batch) => ({ ...batch })),
      item: {
        node: "group",
        children: {
          label: { node: "field", field: { kind: "text", label: "Label", initialValue: "batch" } },
          readings: {
            node: "array",
            item: {
              node: "group",
              children: { value: { node: "field", field: { kind: "text", label: "Value", initialValue: "0" } } },
            },
          },
          tags: {
            node: "record",
            item: {
              node: "group",
              children: { note: { node: "field", field: { kind: "text", label: "Note", initialValue: "unset" } } },
            },
          },
        },
      },
    },
  },
});

function seeded(schema) {
  const form = createForm(schema, { devWarnings: false });
  for (const batch of BATCHES) form.f.batches.push({ ...batch });
  return form;
}

battle(
  {
    claims: ["COL-001", "COL-002", "SUB-002"],
    title: "a list of lists survives its root being renumbered",
    environments: ["node"],
  },
  async (ctx) => {
    const form = seeded(buildSchema(POSITIONAL_ROOT_SPEC).schema);

    try {
      ctx.log.note("three batches, each holding a list and a keyed collection", {});

      // The root is renumbered three ways in turn. Each one changes the index every nested path is
      // addressed under, and none of them may change what the rows hold.
      form.f.batches.move(0, 2);
      form.f.batches.insert(1, { label: "inserted", readings: [{ value: "7" }], tags: {} });
      form.f.batches.remove(0);

      const after = form.getValue().batches;

      // What each label is owed, stated once. Asserting the resulting order by hand would be
      // asserting my own arithmetic about three renumberings; what the claim is about is that a
      // subtree travels with its row, whichever index the row ends at.
      const owed = {
        first: { readings: ["1", "2"], tags: ["alpha"] },
        third: { readings: [], tags: ["beta", "gamma"] },
        inserted: { readings: ["7"], tags: [] },
      };

      expectEqual([...after.map((batch) => batch.label)].sort(), ["first", "inserted", "third"], {
        claimIds: ["COL-001"],
        what: "the renumbering left a different set of batches than the operations describe",
      });

      // A subtree that stayed at an index rather than travelling with its row shows up here as the
      // wrong readings under the right label — which the labels alone cannot show.
      for (const batch of after) {
        expectEqual(batch.readings.map((reading) => reading.value), owed[batch.label].readings, {
          claimIds: ["COL-001", "SUB-002"],
          what: `the batch labelled ${JSON.stringify(batch.label)} is holding another batch's readings`,
        });

        expectEqual(Object.keys(batch.tags).sort(), owed[batch.label].tags, {
          claimIds: ["COL-001", "SUB-002"],
          what: `the batch labelled ${JSON.stringify(batch.label)} is holding another batch's tags`,
        });
      }

      // Every reading in the form appears once. A subtree duplicated into two rows satisfies both
      // assertions above while saying "1" twice.
      const readings = after.flatMap((batch) => batch.readings.map((reading) => reading.value));
      expectEqual([...readings].sort(), ["1", "2", "7"], {
        claimIds: ["COL-001"],
        what: "a reading was carried into a row it does not belong to",
      });
    } finally {
      form.destroy();
    }
  },
);

battle(
  {
    claims: ["DYN-001", "DYN-002", "COL-001"],
    title: "a document whose outermost collection is a list builds the rows it declares",
    environments: ["node"],
  },
  async (ctx) => {
    // A row's value arrives flat, so a collection inside a positional row is addressed under `0`,
    // `1` — a shape a record reads as keys and an array reads as indices. A document that declared
    // its rows and built none of them is what this is here to refuse.
    const flat = flattenDynamicForm(DOCUMENT);
    ctx.log.note("the collections a positional-root document declares", {
      paths: flat.collections.map((each) => each.path),
    });

    expectEqual(flat.collections.map((each) => `${each.path}:${each.kind}`), [
      "batches:array",
      "batches.0.readings:array",
      "batches.0.tags:record",
      "batches.1.readings:array",
      "batches.1.tags:record",
      "batches.2.readings:array",
      "batches.2.tags:record",
    ], {
      claimIds: ["DYN-002"],
      what: "a positional root did not report every collection under its declared rows",
    });

    const fromDocument = createForm(buildDynamicFormSchema(DOCUMENT), { devWarnings: false });
    const typed = seeded(buildSchema(POSITIONAL_ROOT_SPEC).schema);

    try {
      // The control: the document has to have built rows at all. A collection with no rows is the
      // shape that read as structurally correct while a renderer mounted one control out of three.
      expectClaim(fromDocument.f.batches.length() === BATCHES.length, {
        claimIds: ["COL-001"],
        what: "the document declared rows and built a different number of them",
        detail: `${fromDocument.f.batches.length()} of ${BATCHES.length}`,
      });

      expectClaim(fromDocument.fieldNames().length === typed.fieldNames().length, {
        claimIds: ["DYN-001"],
        what: "the document built a different number of fields from the typed schema",
        detail: `${fromDocument.fieldNames().length} against ${typed.fieldNames().length}`,
      });

      expectSameObservation(
        canonicalObservation({ form: fromDocument, collections: { batches: fromDocument.f.batches } }),
        canonicalObservation({ form: typed, collections: { batches: typed.f.batches } }),
        {
          claimIds: ["DYN-001", "DYN-002", "COL-001"],
          ignore: [],
          what: "a positional-root document built a different form from the typed schema",
        },
      );
    } finally {
      fromDocument.destroy();
      typed.destroy();
    }
  },
);
