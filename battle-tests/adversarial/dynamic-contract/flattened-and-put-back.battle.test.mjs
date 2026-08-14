/**
 * A form taken apart and rebuilt, which then cannot hold a row.
 *
 * `flattenDynamicForm` turns a document into the flat pair a renderer consumes — a field list and a
 * list of collections — and `buildFlatFormSchema` turns that pair back into a schema. The round trip
 * is a published route: it is how a host stores a document in one shape and builds from the other,
 * and DYN-002 is the promise that a collection's kind survives it.
 *
 * The kind does survive. `{ path: "rows", kind: "record" }` comes out of the flattening and a record
 * comes out of the rebuild. What does not survive is the row: the flattened field list is empty,
 * because the cells live inside the collection's item and the flattening stops at that boundary, so
 * the rebuilt collection has no template to make a row from.
 *
 * What makes it a defect rather than a documented limit is what the rebuilt form then says. A keyed
 * collection accepts `upsert("k", …)`, reports `keys() === ["k"]`, and returns `{}` from
 * `getValue()` — the collection says the row is there and the value says it is not, in one form, at
 * the same moment. A positional one accepts `push` and stays empty. Neither refuses, so a consumer
 * writing into a rebuilt form is told nothing until they read the value back.
 */

import { buildDynamicFormSchema, buildFlatFormSchema, createForm, flattenDynamicForm, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const item = Object.freeze({
  node: "group",
  children: Object.freeze({ code: Object.freeze({ node: "field", field: Object.freeze({ kind: "text", label: "C" }) }) }),
});

const documentFor = (kind) => ({ node: "group", children: { rows: { node: kind, item } } });

const open = (schema) => createForm(schema, { reactivity: vanillaReactivity(), devWarnings: false });

battle(
  {
    claims: ["DYN-002", "DYN-001", "COL-001"],
    title: "a collection that survived a round trip can still hold a row",
    environments: ["node"],
  },
  async (ctx) => {
    for (const kind of ["record", "array"]) {
      const document = documentFor(kind);
      const direct = open(buildDynamicFormSchema(document));
      const flattened = flattenDynamicForm(document);
      const rebuilt = open(buildFlatFormSchema(flattened.fields ?? [], flattened.collections ?? []));

      const declare = (form) =>
        kind === "record" ? form.f.rows.upsert("k", { code: "K" }) : form.f.rows.push({ code: "K" });
      const rows = (form) => form.getValue().rows;

      // The control: built straight from the document, the collection holds what it is given. The
      // round trip is what the assertions below are about.
      declare(direct);
      expectClaim(JSON.stringify(rows(direct)).includes("\"code\":\"K\""), {
        claimIds: ["DYN-001"],
        what: `a ${kind} built straight from the document did not hold the row it was given`,
        detail: JSON.stringify(rows(direct)),
      });

      // The kind survives, which is the promise this battle is not disputing.
      expectEqual(Array.isArray(rows(rebuilt)), kind === "array", {
        claimIds: ["DYN-002"],
        what: `a ${kind} came back from the round trip as the other kind`,
      });

      let refused = false;
      try {
        declare(rebuilt);
      } catch {
        refused = true;
      }

      const value = rows(rebuilt);
      const keys = kind === "record" ? [...rebuilt.f.rows.keys()] : [];
      ctx.log.note("a row declared in a rebuilt collection", { kind, refused, value, keys });

      // Refusing is an answer a consumer can act on. Accepting and holding nothing is not.
      expectClaim(refused || JSON.stringify(value).includes("\"code\":\"K\""), {
        claimIds: ["DYN-002", "COL-001"],
        what: `a rebuilt ${kind} accepted a row and holds ${JSON.stringify(value)}`,
        detail: JSON.stringify({ flattenedFields: flattened.fields, collections: flattened.collections }),
      });

      // And whatever it holds, it must not answer two ways about the same row.
      if (kind === "record") {
        expectEqual(keys.length, Object.keys(value ?? {}).length, {
          claimIds: ["COL-001"],
          what: `a rebuilt record reports ${keys.length} key(s) and a value holding ${Object.keys(value ?? {}).length}`,
          detail: JSON.stringify({ keys, value }),
        });
      }

      direct.destroy();
      rebuilt.destroy();
    }
  },
);
