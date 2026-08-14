/**
 * The same form, declared twice.
 *
 * A consumer writes a schema in TypeScript; a CMS or a model emits a document and the contract
 * builds the schema from it. Both are public paths to the same form, and the promise is that they
 * agree for the subset both support. The attack feeds one serializable operation log to both and
 * compares what a consumer can see.
 *
 * Any difference the contract does permit is named per assertion. There is no blanket exclusion:
 * excluding a field wholesale is how a differential test stops testing.
 */

import { buildDynamicFormSchema, createForm, flattenDynamicForm, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectSameObservation, expectSamePaths } from "../../harness/assertions.mjs";
import { canonicalObservation, RENDERER_ONLY_FIELDS } from "../../harness/canonical-snapshot.mjs";
import { executeOperation } from "../../harness/context.mjs";
import { KEYED_ROWS_SPEC } from "../../models/schemas.mjs";

/** The document half: the same three-cell row, declared as data. */
const DOCUMENT = Object.freeze({
  version: 3,
  id: "invoice",
  schema: {
    node: "group",
    children: {
      title: { node: "field", field: { kind: "text", label: "Title", required: true, initialValue: "invoice" } },
      rows: {
        node: "record",
        item: {
          node: "group",
          children: {
            code: { node: "field", field: { kind: "text", label: "Code", required: true } },
            note: { node: "field", field: { kind: "text", label: "Note" } },
            tax: { node: "field", field: { kind: "text", label: "Tax" } },
          },
        },
      },
    },
  },
});

/** Operations both paths must answer identically. */
const OPERATIONS = Object.freeze([
  { type: "record.upsert", path: "rows", key: "947", value: { code: "A1", note: "first", tax: "T1" } },
  { type: "record.upsert", path: "rows", key: "tmp:1" },
  { type: "field.set", path: "rows.tmp:1.code", value: "B2" },
  { type: "field.touch", path: "rows.947.code" },
  { type: "record.patch", path: "rows", value: { 947: { note: "patched" } } },
  { type: "record.rename", path: "rows", from: "tmp:1", to: "948" },
  { type: "record.remove", path: "rows", key: "947" },
  { type: "field.set", path: "rows.948.note", value: "kept" },
]);

battle(
  {
    claims: ["DYN-001", "DYN-002", "COL-008"],
    title: "a typed schema and a document describe the same form",
    environments: ["node"],
    requires: ["structural", "observations"],
  },
  async (ctx) => {
    const parsed = parseDynamicForm(DOCUMENT);
    expectClaim(parsed.ok && parsed.diagnostics.length === 0, {
      claimIds: ["DYN-001"],
      what: "the document parses cleanly",
      detail: JSON.stringify(parsed.diagnostics),
    });

    // The typed path, driven through the shared interpreter.
    const typed = ctx.open(KEYED_ROWS_SPEC, { devWarnings: false });
    for (const operation of OPERATIONS) await typed.execute(operation);
    const typedState = typed.observe("typed schema");

    // The document path: a form built from the contract, driven by the same operations through the
    // same interpreter — the collection handles come from the built form, not from the spec.
    const dynamicForm = createForm(buildDynamicFormSchema(DOCUMENT.schema), { devWarnings: false });
    const dynamicContext = {
      form: dynamicForm,
      collections: { rows: dynamicForm.f.rows },
      collectionPaths: ["rows"],
      collectionOf: (path) => (path.startsWith("rows.") ? "rows" : null),
      log: ctx.log,
      scheduler: ctx.scheduler,
      setDisabled: () => {},
      mount: () => {},
      unmount: () => {},
      snapshot: () => {},
    };

    try {
      for (const operation of OPERATIONS) {
        ctx.log.record({ ...operation, on: "document" });
        await executeOperation(dynamicContext, operation);
      }
      const dynamicState = canonicalObservation({
        form: dynamicForm,
        collections: { rows: dynamicForm.f.rows },
      });

      expectSameObservation(dynamicState, typedState, {
        claimIds: ["DYN-001"],
        // The two forms differ in how they were declared, never in what they hold. `mountedPaths`
        // is excluded because only the typed context has a mount strategy attached to it;
        // `activeAsyncRuns` because the typed spec's async cell is driven by the harness and the
        // document has no way to declare one.
        ignore: [...RENDERER_ONLY_FIELDS, "activeAsyncRuns", "pending", "diagnostics"],
        what: "the document-built form diverged from the typed one",
      });

      // Everything excluded, asserted rather than dropped — which the snapshot's own contract
      // requires and which this comparison had only half done.
      expectClaim(!dynamicState.pending, {
        claimIds: ["DYN-001"],
        what: "a document-built form has no pending work of its own",
      });

      expectClaim(dynamicState.activeAsyncRuns === 0, {
        claimIds: ["DYN-001"],
        what: "a document-built form started async work the document never declared",
        detail: `${dynamicState.activeAsyncRuns} run(s)`,
      });

      // The typed side is stated too. Excluding a field because one side is driven by the harness
      // says nothing about what the other side did, and "both were ignored" is how a differential
      // stops testing anything.
      expectClaim(typedState.pending === (typedState.activeAsyncRuns > 0), {
        claimIds: ["DYN-001"],
        what: "the typed form is pending exactly while the harness holds a run for it",
        detail: `pending=${typedState.pending}, ${typedState.activeAsyncRuns} run(s)`,
      });

      // And the diagnostics, which were dropped with nothing said about them at all. Neither form
      // may complain while doing what the other does without complaint: a warning on one side and
      // silence on the other is a difference between two public paths, which is the claim.
      expectSamePaths(dynamicState.diagnostics, typedState.diagnostics, {
        claimIds: ["DYN-001"],
        what: "the two ways of declaring the same form did not report the same things",
      });

      // The kind survives the round trip through the flat wire form. `flattenDynamicForm` walks a
      // schema node, which is the document's `schema` — handed the whole envelope it answers for a
      // node with no children rather than refusing, so the call site states which half it means.
      const flat = flattenDynamicForm(DOCUMENT.schema);
      expectClaim(
        flat.collections?.some((each) => each.path === "rows" && each.kind === "record"),
        {
          claimIds: ["DYN-002"],
          what: "flattening keeps the collection's kind, which its paths cannot carry",
          detail: JSON.stringify(flat.collections),
        },
      );
      expectClaim(
        flat.fields.every((each) => !each.name.startsWith("rows.") || each.name.split(".").length === 3),
        {
          claimIds: ["DYN-002"],
          what: "a row's flat paths address a key and a cell",
          detail: flat.fields.map((each) => each.name).join(", "),
        },
      );
    } finally {
      dynamicForm.destroy();
    }
  },
);
