/**
 * The fixtures the project publishes, driven as forms rather than checked as text.
 *
 * `spec/fixtures/dynamic-form/` is the corpus the contract is demonstrated with: nine documents
 * written by the people who defined the format, covering the geometries prose can only describe — a
 * keyed map inside a keyed map inside a list, three levels of positional list, a list whose rows are
 * bare fields, a list of keyed maps of text.
 *
 * Everything that reads it today reads it as text. `scripts/audit-contract-schema.mjs` validates each
 * document against the schema for its version; nothing builds a form from one and adds a row. So the
 * corpus demonstrates that the documents are well-formed and not that the shapes they describe can be
 * filled in.
 *
 * The expectation here comes out of the fixture: a row created at any depth must carry exactly the
 * cells that fixture declares for that item, and a nested collection inside it must open empty and
 * accept a row of its own. Key sets are compared rather than values, so this asks whether the shape
 * arrived and leaves what a blank cell holds to the value contracts.
 *
 * Where an item is not a group there are no cells to compare — a list of keyed maps of text has a row
 * that is a map, and a list of bare fields has a row that is a value. Those are asserted on the other
 * property every collection has: after a row is added it holds one, at every depth. Without that the
 * walk would descend through those geometries reporting nothing.
 *
 * The corpus is walked rather than listed. A fixture added to it is a fixture this asks about.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { buildDynamicFormSchema, createForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const CORPUS = resolve(HERE, "..", "..", "..", "spec", "fixtures", "dynamic-form");

/** Every document in the corpus, with where it came from. */
function corpus() {
  const found = [];
  for (const version of readdirSync(CORPUS).sort()) {
    for (const file of readdirSync(join(CORPUS, version)).sort().filter((each) => each.endsWith(".json"))) {
      found.push({ where: `${version}/${file}`, document: JSON.parse(readFileSync(join(CORPUS, version, file), "utf8")) });
    }
  }
  return found;
}

/** What a row of this item is, read off the fixture. */
function declares(item) {
  if (item?.node === "group") return { kind: "group", cells: Object.keys(item.children ?? {}).sort() };
  if (item?.node === "record") return { kind: "record" };
  if (item?.node === "array") return { kind: "array" };
  return { kind: "field" };
}

/** Add one row through whichever handle this collection has, and answer with it. */
function addRow(handle, node, key) {
  if (node.node === "record") {
    handle.upsert(key);
    return handle.row(key);
  }
  handle.push();
  return handle.at(handle.length() - 1);
}

/**
 * Walk a document's collections, creating a row at each one and descending into it.
 *
 * Returns what was found rather than asserting, so the caller decides what a mismatch means and the
 * walk stays usable from more than one battle.
 */
function fillAndInspect(node, handle, path, found) {
  if (node?.node === "record" || node?.node === "array") {
    const before = node.node === "record" ? handle.keys().length : handle.length();
    const row = addRow(handle, node, "k");
    const shape = declares(node.item);
    found.push({
      path,
      kind: node.node,
      expected: shape,
      rowKeys: shape.kind === "group" ? Object.keys(row).sort() : null,
      gained: (node.node === "record" ? handle.keys().length : handle.length()) - before,
    });

    if (shape.kind === "group") {
      for (const [name, child] of Object.entries(node.item.children ?? {})) {
        fillAndInspect(child, row[name], `${path}.*.${name}`, found);
      }
    } else if (shape.kind !== "field") {
      fillAndInspect(node.item, row, `${path}.*`, found);
    }
    return;
  }

  if (node?.node === "group") {
    for (const [name, child] of Object.entries(node.children ?? {})) {
      fillAndInspect(child, handle?.[name], `${path ? `${path}.` : ""}${name}`, found);
    }
  }
}

battle(
  {
    claims: ["COL-002", "COL-003", "DYN-001"],
    title: "every published fixture builds a form, and a row carries the cells the fixture declares",
    environments: ["node"],
  },
  async (ctx) => {
    const documents = corpus();

    // The control: the corpus was found. A walk over nothing asserts nothing.
    expectClaim(documents.length > 0, {
      claimIds: ["DYN-001"],
      what: "no fixture was found, so this battle checked nothing",
      detail: CORPUS,
    });

    const trees = documents.filter(({ document }) => document.schema !== undefined);
    expectClaim(trees.length > 0, {
      claimIds: ["DYN-001"],
      what: "no fixture in the corpus declares a tree, so no collection was exercised",
    });

    for (const { where, document } of trees) {
      const form = createForm(buildDynamicFormSchema(document.schema), { devWarnings: false });
      try {
        const found = [];
        fillAndInspect(document.schema, form.f, "", found);
        ctx.log.note("a published fixture, filled in", {
          where,
          collections: found.map((each) => `${each.path} (${each.kind})`),
        });

        // Every fixture with a tree has at least one collection, or the walk found nothing and the
        // comparisons below are vacuous.
        expectClaim(found.length > 0, {
          claimIds: ["COL-002"],
          what: `${where} declares a tree and the walk reached no collection in it`,
        });

        for (const entry of found) {
          // Every collection took the row it was given, whatever its item is. This is what carries
          // the geometries with no cells to compare.
          expectEqual(entry.gained, 1, {
            claimIds: ["COL-002"],
            what: `adding one row to ${where} at ${entry.path} changed what it holds by ${entry.gained}`,
          });

          if (entry.expected.kind !== "group") continue;
          expectEqual(entry.rowKeys, entry.expected.cells, {
            claimIds: ["COL-003"],
            what: `a row of ${where} at ${entry.path} does not carry the cells the fixture declares`,
          });
        }

        // And the filled document is readable as a whole, which is what an application does with it.
        const value = form.getValue();
        expectClaim(value !== null && typeof value === "object", {
          claimIds: ["COL-002"],
          what: `${where} did not read back as a value once its collections held rows`,
        });
      } finally {
        form.destroy();
      }
    }
  },
);

battle(
  {
    claims: ["COL-002", "DYN-001"],
    title: "a fixture's flat fields are the fields its form has",
    environments: ["node"],
  },
  async (ctx) => {
    // The other half of the corpus: documents that declare a flat field list. What the parser accepts
    // and what a form ends up holding must be the same set, or a field an author declared is one no
    // one can fill in.
    const { buildFlatFormSchema, parseDynamicForm } = await import("@modyra/core");
    const flats = corpus().filter(({ document }) => document.schema === undefined);

    expectClaim(flats.length > 0, {
      claimIds: ["DYN-001"],
      what: "no fixture in the corpus declares a flat field list",
    });

    for (const { where, document } of flats) {
      const parsed = parseDynamicForm(document, { mode: "lenient" });
      const form = createForm(buildFlatFormSchema(parsed.fields), { devWarnings: false });
      try {
        const declared = parsed.fields.map((each) => each.name).sort();
        const held = Object.keys(form.getValue()).sort();
        ctx.log.note("a flat fixture, built", { where, declared, held });

        expectEqual(held, declared, {
          claimIds: ["COL-002"],
          what: `${where} built a form whose fields are not the ones the parser accepted`,
        });
      } finally {
        form.destroy();
      }
    }
  },
);
