/**
 * Flattening a nested document, and the one thing a flat path cannot say about itself.
 *
 * `flattenDynamicForm` states the problem it exists to solve: "a path cannot say which it came from —
 * `lines.0` reads as the key `0` whether the document declared an array or a record keyed by digits.
 * Reporting the collections alongside the fields is what lets a consumer rebuild the shape the
 * document declared instead of guessing it, and guessing is the one thing that cannot be made safe,
 * because both readings are legitimate."
 *
 * That is a property, not a description, and it is what is checked here: every collection a reported
 * path passes through is a collection reported beside it, at the concrete path and with the kind the
 * document declared. The path is resolved against the document rather than parsed on its own, because
 * a path read on its own is exactly what cannot be trusted — which is the sentence above.
 *
 * The check is mutation-tested rather than assumed: dropping either collection from what is reported,
 * or flipping every kind, is caught. A check that walked the path alone passes all three, which is
 * how the first version of this battle was green for the wrong reason.
 *
 * The decisive case is the one the comment names, and it is checked as a pair: a record keyed `"0"`
 * and a list, which produce the identical field path `lines.0.sku`. Nothing in the paths separates
 * them. Only the reported kind does, which is the whole point of reporting it.
 *
 * The walk is over instances rather than declarations — an empty collection reports no fields from
 * inside it, and so declares nothing that needs classifying. Seeded at both levels, a nested
 * collection is reported at its concrete path, and that is checked too, because "the nested one is
 * missing" and "the nested one was never reached" look the same from the outside.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { flattenDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const CORPUS = resolve(HERE, "..", "..", "..", "spec", "fixtures", "dynamic-form");

const leaf = () => ({ node: "field", field: { kind: "text", label: "L", name: "leaf" } });

/**
 * The concrete path and kind of every collection a reported path passes through, read off the
 * document, or `null` when the path does not resolve against it at all.
 */
function collectionsAlong(schema, path) {
  const parts = path.split(".");
  const found = [];
  let node = schema;
  let prefix = "";
  let at = 0;

  while (at < parts.length) {
    if (node?.node === "group") {
      const name = parts[at];
      node = node.children?.[name];
      prefix = prefix ? `${prefix}.${name}` : name;
      at += 1;
      continue;
    }

    if (node?.node === "record" || node?.node === "array") {
      found.push(`${prefix}:${node.node}`);
      prefix = `${prefix}.${parts[at]}`;
      at += 1;
      node = node.item;
      continue;
    }

    return null;
  }

  return node?.node === "field" ? found : null;
}

/** Collections a reported path goes through that were not reported with it. */
function unreported(schema, { fields, collections }) {
  const reported = new Set(collections.map((each) => `${each.path}:${each.kind}`));
  const gaps = [];

  for (const field of fields) {
    const along = collectionsAlong(schema, field.name);
    if (along === null) {
      gaps.push({ path: field.name, why: "does not resolve against the document that declared it" });
      continue;
    }
    for (const collection of along) {
      if (!reported.has(collection)) gaps.push({ path: field.name, missing: collection });
    }
  }

  return gaps;
}

battle(
  {
    claims: ["DYN-001", "COL-002"],
    title: "every flattened path can be classified by the collections reported with it",
    environments: ["node"],
  },
  async (ctx) => {
    const documents = [];
    for (const version of readdirSync(CORPUS).sort()) {
      for (const file of readdirSync(join(CORPUS, version)).sort().filter((each) => each.endsWith(".json"))) {
        const document = JSON.parse(readFileSync(join(CORPUS, version, file), "utf8"));
        if (document.schema !== undefined) documents.push({ where: `${version}/${file}`, schema: document.schema });
      }
    }

    // Constructed alongside the corpus, because the published fixtures leave their nested collections
    // empty and an empty one reports nothing from inside itself.
    documents.push(
      {
        where: "a record inside a record, seeded at both levels",
        schema: {
          node: "group",
          children: {
            orders: {
              node: "record",
              initialValue: { A: { c: "x", lines: { L: { sku: "y" } } } },
              item: {
                node: "group",
                children: { c: leaf(), lines: { node: "record", item: { node: "group", children: { sku: leaf() } } } },
              },
            },
          },
        },
      },
      {
        where: "a list inside a list, seeded at both levels",
        schema: {
          node: "group",
          children: {
            orders: {
              node: "array",
              initialValue: [{ c: "x", lines: [{ sku: "y" }] }],
              item: {
                node: "group",
                children: { c: leaf(), lines: { node: "array", item: { node: "group", children: { sku: leaf() } } } },
              },
            },
          },
        },
      },
      {
        where: "a record inside a list, seeded at both levels",
        schema: {
          node: "group",
          children: {
            orders: {
              node: "array",
              initialValue: [{ lines: { L: { sku: "y" } } }],
              item: {
                node: "group",
                children: { lines: { node: "record", item: { node: "group", children: { sku: leaf() } } } },
              },
            },
          },
        },
      },
    );

    expectClaim(documents.length > 4, {
      claimIds: ["DYN-001"],
      what: "the corpus was not found, so only the constructed documents were checked",
    });

    for (const { where, schema } of documents) {
      const flattened = flattenDynamicForm(schema);
      const bad = unreported(schema, flattened);
      ctx.log.note("a document flattened", {
        where,
        fields: flattened.fields.length,
        collections: flattened.collections.map((each) => `${each.path}:${each.kind}`),
      });

      expectEqual(bad, [], {
        claimIds: ["COL-002"],
        what: `${where} reports a path passing through a collection it does not report`,
      });
    }

    // A nested collection reached through a row is reported at its concrete path. Without this, a
    // missing nested collection and one that was never reached read the same.
    const seeded = documents[documents.length - 3];
    const nested = flattenDynamicForm(seeded.schema);
    expectEqual(nested.collections.map((each) => each.path), ["orders", "orders.A.lines"], {
      claimIds: ["COL-002"],
      what: "flattening a seeded row did not report the collection inside it",
    });

    // And the check itself bites: dropping either collection, or flipping every kind, is reported.
    // Without this the loop above would pass over a flattening that reported nothing at all.
    for (const [what, mutated] of [
      ["the outer collection dropped", nested.collections.filter((each) => each.path !== "orders")],
      ["the inner collection dropped", nested.collections.filter((each) => each.path !== "orders.A.lines")],
      ["every kind flipped", nested.collections.map((each) => ({ ...each, kind: each.kind === "record" ? "array" : "record" }))],
    ]) {
      expectClaim(unreported(seeded.schema, { fields: nested.fields, collections: mutated }).length > 0, {
        claimIds: ["COL-002"],
        what: `the check passes a flattening with ${what}, so it proves nothing about the ones above`,
      });
    }
  },
);

battle(
  {
    claims: ["DYN-001", "COL-002"],
    title: "a record keyed by digits and a list are told apart by what is reported, not by the paths",
    environments: ["node"],
  },
  async (ctx) => {
    // The case the contract names. Both documents produce the same path; nothing in it says which
    // shape it came from, and guessing is the thing that cannot be made safe because both readings
    // are legitimate.
    const asRecord = flattenDynamicForm({
      node: "group",
      children: {
        lines: { node: "record", initialValue: { 0: { sku: "y" } }, item: { node: "group", children: { sku: leaf() } } },
      },
    });
    const asList = flattenDynamicForm({
      node: "group",
      children: {
        lines: { node: "array", initialValue: [{ sku: "y" }], item: { node: "group", children: { sku: leaf() } } },
      },
    });
    ctx.log.note("two documents that flatten to the same paths", {
      record: { fields: asRecord.fields.map((each) => each.name), collections: asRecord.collections },
      list: { fields: asList.fields.map((each) => each.name), collections: asList.collections },
    });

    // The premise: the paths really are identical. If they were not, the reported kind would be
    // carrying no weight and this battle would prove nothing.
    expectEqual(asRecord.fields.map((each) => each.name), asList.fields.map((each) => each.name), {
      claimIds: ["DYN-001"],
      what: "a digit-keyed record and a list flatten to different paths, so the ambiguity this guards against is not real",
    });

    expectEqual(
      [asRecord.collections[0]?.kind, asList.collections[0]?.kind],
      ["record", "array"],
      {
        claimIds: ["COL-002"],
        what: "the two shapes that flatten identically are not told apart by what is reported beside the paths",
      },
    );
  },
);
