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

/**
 * Every document in the corpus, with where it came from and the context it is built with.
 *
 * A fixture's context lives in a twin named for it — `x.json` is built with `x.context.json` — because
 * the document is what three runtimes parse and the context is what a host supplies. A document with
 * no twin is built without context, which is what a document that reads no context needs.
 */
function corpus() {
  const found = [];
  for (const version of readdirSync(CORPUS).sort()) {
    const files = readdirSync(join(CORPUS, version)).sort();
    for (const file of files.filter((each) => each.endsWith(".json") && !each.endsWith(".context.json"))) {
      const twin = file.replace(/\.json$/, ".context.json");
      found.push({
        where: `${version}/${file}`,
        document: JSON.parse(readFileSync(join(CORPUS, version, file), "utf8")),
        context: files.includes(twin) ? JSON.parse(readFileSync(join(CORPUS, version, twin), "utf8")) : undefined,
      });
    }
  }
  return found;
}

/** The schema a fixture builds, with the context its twin supplies when it has one. */
function schemaOf(document, context) {
  return buildDynamicFormSchema(document.schema, context === undefined ? {} : { context });
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
/**
 * Whether a tree declares a collection at all, read from the document rather than from the form.
 *
 * These battles are about what a collection does, and they selected their subjects by asking whether
 * a document declares a tree — which was the same set until the corpus grew a tree that declares a
 * rule and no collection. It then read as four failures about a fixture that is simply about
 * something else: the walk reached nothing, so filling changed nothing, so the draft held nothing,
 * so the round trip was vacuous. One property of one new document, reported four times as a defect.
 *
 * The protection those assertions carried is real and is kept — it just belongs to the population
 * rather than to each member. A corpus that stopped declaring collections anywhere must still fail
 * loudly; a corpus that gains a document about something else must not.
 */
function declaresCollection(node) {
  if (node === null || typeof node !== "object") return false;
  if (node.node === "record" || node.node === "array") return true;
  return Object.values(node).some(declaresCollection);
}

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

/** Storage a battle owns, so nothing depends on the environment having one. */
function memoryStorage() {
  const written = new Map();
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
}

/** Every tree fixture, filled in, with what it held before and after. */
function filled(document, options, context) {
  const form = createForm(schemaOf(document, context), { devWarnings: false, ...options });
  const initial = JSON.stringify(form.getValue());
  fillAndInspect(document.schema, form.f, "", []);
  return { form, initial, filled: JSON.stringify(form.getValue()) };
}

const settled = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

    const declared = documents.filter(({ document }) => document.schema !== undefined);
    const trees = declared.filter(({ document }) => declaresCollection(document.schema));
    // Named, not silently dropped: a tree left out here is a document these battles say nothing
    // about, and a reader counting green tests would otherwise believe they had covered it.
    const skipped = declared.filter(({ document }) => !declaresCollection(document.schema));
    if (skipped.length > 0) {
      ctx.log.note("trees carrying no collection, so outside these claims", {
        where: skipped.map(({ where }) => where),
      });
    }
    expectClaim(trees.length > 0, {
      claimIds: ["DYN-001"],
      what: "no fixture in the corpus declares a collection, so no collection was exercised",
    });

    for (const { where, document, context } of trees) {
      const form = createForm(schemaOf(document, context), { devWarnings: false });
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

battle(
  {
    claims: ["PER-002", "COL-003"],
    title: "undoing back through a published geometry returns exactly where it started",
    environments: ["node"],
  },
  async (ctx) => {
    // History is where a nested geometry is most likely to disagree with itself: undoing a row that
    // holds a collection has to take the collection with it, and redoing has to bring back the same
    // one rather than a fresh empty. These are the deepest shapes anything in the project publishes.
    for (const { where, document, context } of corpus().filter(({ document }) => document.schema !== undefined && declaresCollection(document.schema))) {
      const { form, initial, filled: full } = filled(document, { history: true }, context);
      try {
        expectClaim(full !== initial, {
          claimIds: ["COL-003"],
          what: `filling ${where} changed nothing, so the round trip below is vacuous`,
        });

        let undone = 0;
        while (form.canUndo() && undone < 40) {
          form.undo();
          undone += 1;
        }
        ctx.log.note("a published geometry, undone to the start", { where, steps: undone });

        expectClaim(undone > 0, {
          claimIds: ["PER-002"],
          what: `${where} recorded no undoable step for a fill that changed its value`,
        });

        expectEqual(JSON.stringify(form.getValue()), initial, {
          claimIds: ["PER-002"],
          what: `undoing everything done to ${where} did not return the value it started with`,
        });

        let redone = 0;
        while (form.canRedo() && redone < 40) {
          form.redo();
          redone += 1;
        }

        expectEqual(JSON.stringify(form.getValue()), full, {
          claimIds: ["PER-002"],
          what: `redoing everything undone in ${where} did not return the value it had`,
        });
      } finally {
        form.destroy();
      }
    }
  },
);

battle(
  {
    claims: ["PER-001", "COL-003"],
    title: "a published geometry survives being written down and reopened",
    environments: ["node"],
  },
  async (ctx) => {
    // A draft is JSON, and these shapes are the ones with the most to lose in the trip: a keyed map
    // inside a keyed map inside a list, and a list whose rows are themselves lists. What comes back
    // has to be what was there, at every depth, or a user who closed the tab loses the part of the
    // form they went deepest into.
    for (const { where, document, context } of corpus().filter(({ document }) => document.schema !== undefined && declaresCollection(document.schema))) {
      const storage = memoryStorage();
      const draft = { key: "corpus", storage };

      const first = filled(document, { draft }, context);
      await settled(700);
      const envelope = storage.written.get("corpus");
      first.form.destroy();

      ctx.log.note("a published geometry, written down", { where, bytes: envelope?.length ?? 0 });

      expectClaim(typeof envelope === "string" && envelope.length > 0, {
        claimIds: ["PER-001"],
        what: `${where} was filled in and nothing was written to the draft`,
      });

      const second = createForm(schemaOf(document, context), { devWarnings: false, draft });
      await settled(80);
      try {
        expectEqual(JSON.stringify(second.getValue()), first.filled, {
          claimIds: ["PER-001", "COL-003"],
          what: `${where} did not come back from its draft as the document that was saved`,
        });
      } finally {
        second.destroy();
      }
    }
  },
);
