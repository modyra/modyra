/**
 * A form schema written as data, so a failure can be replayed.
 *
 * `createForm` takes descriptors built from functions; a report can only carry data. This module is
 * the one translation between the two: a battle declares a schema spec, the harness materialises it,
 * and the same spec written into a failure report rebuilds the identical form on replay.
 *
 * The spec deliberately covers less than the schema API. It grows when an attack needs a shape it
 * cannot express — never to mirror the API for its own sake, which would make the report format
 * follow every change in a package this suite is supposed to be independent of.
 */

import { array, field, group, record, required } from "@modyra/core";

export const MDY_SCHEMA_SPEC_VERSION = 1;

/** What a leaf carries before anyone edits it. */
const INITIAL = Object.freeze({
  text: "",
  number: null,
  boolean: false,
});

/**
 * Build the descriptors, and report where the collections are.
 *
 * `asyncFor(path)` supplies async validators for a leaf that asked for them; the harness owns their
 * completion, so the spec names only that a leaf is asynchronously validated, never how.
 */
export function buildSchema(spec, { asyncFor = () => [] } = {}) {
  const collectionPaths = [];
  const schema = {};
  for (const [name, node] of Object.entries(spec.fields ?? {})) {
    schema[name] = buildNode(node, name, collectionPaths, asyncFor);
  }
  return { schema, collectionPaths: Object.freeze(collectionPaths) };
}

function buildNode(node, path, collectionPaths, asyncFor) {
  switch (node.kind) {
    case "text":
    case "number":
    case "boolean":
      return buildLeaf(node, path, asyncFor);
    case "group":
      return group(
        buildChildren(node.of, path, collectionPaths, asyncFor),
        node.when ? { when: compileCondition(node.when, path) } : undefined,
      );
    case "record":
      collectionPaths.push(path);
      return record(buildItem(node.of, `${path}.*`, collectionPaths, asyncFor), {
        initial: node.initial ?? {},
      });
    case "array":
      collectionPaths.push(path);
      return array(buildItem(node.of, `${path}.*`, collectionPaths, asyncFor), {
        initial: node.initial ?? [],
      });
    default:
      throw new Error(`unknown schema node kind ${JSON.stringify(node.kind)} at ${path}`);
  }
}

/**
 * A section's condition, written as data.
 *
 * `when` cannot be a function here. The spec's whole purpose is that a failure report rebuilds the
 * identical form, and a function does not survive the JSON the report is written as: it arrives back
 * as `null`, the section becomes unconditional, and the replay reconstructs a form that submits a
 * branch the original excluded — a report that lies rather than one that fails to reproduce.
 *
 * So the shape is `{ field, equals }`, read against the value enclosing the section: a sibling cell
 * for a section inside a row, a sibling field for one at the top of the form. It covers what the
 * attacks need and no more; it grows when one of them needs a comparison it cannot state.
 */
function compileCondition(when, path) {
  if (typeof when === "function") {
    throw new Error(
      `schema spec at ${path} declares \`when\` as a function; a report cannot carry one. ` +
        `Use { field, equals } so the condition survives being written down.`,
    );
  }
  if (!when || typeof when.field !== "string" || !("equals" in when)) {
    throw new Error(
      `schema spec at ${path} declares an unreadable \`when\`: ${JSON.stringify(when)}. ` +
        `Expected { field, equals }.`,
    );
  }
  const { field: name, equals } = when;
  return (value, enclosing) => (enclosing ?? value)?.[name] === equals;
}

function buildItem(of, path, collectionPaths, asyncFor) {
  // A collection item is either a leaf or a group of leaves; the row shape is the item, once.
  //
  // The discriminator is a string, tested as one: a row whose cells include one named `kind` has a
  // `kind` that is an object, and reading it as truthy silently declares the whole row to be that
  // one cell. A fixture may name a cell whatever the domain calls it.
  return typeof of.kind === "string"
    ? buildNode(of, path, collectionPaths, asyncFor)
    : group(buildChildren(of, path, collectionPaths, asyncFor));
}

function buildChildren(children, path, collectionPaths, asyncFor) {
  const built = {};
  for (const [name, node] of Object.entries(children)) {
    built[name] = buildNode(node, `${path}.${name}`, collectionPaths, asyncFor);
  }
  return built;
}

function buildLeaf(node, path, asyncFor) {
  const validators = node.required ? [required()] : [];
  const asyncValidators = node.async ? asyncFor(path) : [];
  const initial = "initial" in node ? node.initial : INITIAL[node.kind];
  return field(initial, validators, {
    asyncValidators,
    asyncDebounceMs: node.asyncDebounceMs ?? 0,
    asyncDependsOn: node.asyncDependsOn ?? [],
    asyncTimeoutMs: node.asyncTimeoutMs ?? 0,
  });
}

/**
 * The keyed-collection shape every record battle starts from: one required cell, one free cell, one
 * asynchronously validated cell — the smallest row on which declaration, mounting and async
 * completion can disagree.
 */
export const KEYED_ROWS_SPEC = Object.freeze({
  version: MDY_SCHEMA_SPEC_VERSION,
  fields: Object.freeze({
    title: Object.freeze({ kind: "text", required: true, initial: "invoice" }),
    rows: Object.freeze({
      kind: "record",
      of: Object.freeze({
        code: Object.freeze({ kind: "text", required: true }),
        note: Object.freeze({ kind: "text" }),
        tax: Object.freeze({ kind: "text", async: true }),
      }),
      initial: Object.freeze({}),
    }),
  }),
});

/**
 * The same row shape, addressed by position instead of by key.
 *
 * A record and an array answer the same questions about a row and answer them differently: one has
 * an identity a rename can change, the other an index a move can change. Attacks on collection
 * semantics that exist only for the keyed shape prove half a claim, so the positional counterpart is
 * declared here rather than inline in whichever battle needed it first.
 */
export const POSITIONAL_ROWS_SPEC = Object.freeze({
  version: MDY_SCHEMA_SPEC_VERSION,
  fields: Object.freeze({
    title: Object.freeze({ kind: "text", required: true, initial: "invoice" }),
    items: Object.freeze({
      kind: "array",
      of: Object.freeze({
        code: Object.freeze({ kind: "text", required: true }),
        note: Object.freeze({ kind: "text" }),
        tax: Object.freeze({ kind: "text", async: true }),
      }),
      initial: Object.freeze([]),
    }),
  }),
});

/**
 * A row whose shape depends on what the row says about itself.
 *
 * The section inside the row is the case a flat fixture cannot reach: its cells exist for some rows
 * and not others, in a collection where the rows are data. It is where `VAL-003` — hidden controls
 * do not alter validation semantics — and `COL-003` — validity is independent from what is mounted —
 * meet, because a cell can now be absent for two unrelated reasons at once: nobody mounted it, and
 * the row it belongs to does not have it.
 *
 * `tier` decides. The `full` branch carries a required cell, so an inactive section holding an
 * unsatisfied requirement is expressible — the shape most likely to make a form unsubmittable for a
 * reason no control can show.
 */
export const CONDITIONAL_ROWS_SPEC = Object.freeze({
  version: MDY_SCHEMA_SPEC_VERSION,
  fields: Object.freeze({
    rows: Object.freeze({
      kind: "record",
      of: Object.freeze({
        tier: Object.freeze({ kind: "text", initial: "basic" }),
        code: Object.freeze({ kind: "text", required: true, initial: "C" }),
        extras: Object.freeze({
          kind: "group",
          when: Object.freeze({ field: "tier", equals: "full" }),
          of: Object.freeze({
            reference: Object.freeze({ kind: "text", required: true }),
            memo: Object.freeze({ kind: "text", initial: "unset" }),
          }),
        }),
      }),
      initial: Object.freeze({}),
    }),
  }),
});

/**
 * Two positional levels under a keyed one.
 *
 * `orders` is keyed, so its rows have identities a rename can change; `lines` and `allocations` are
 * positional, so their rows have indices a move can change. The three together are the shape where a
 * reorder at the middle level happens while the identity above it is changing — the two kinds of
 * structural change interfering, each rebuilding rows the other is also rebuilding.
 *
 * A subtree that is replaced rather than ended leaves its fields behind, and the level above then
 * carries them into whichever row it rebuilds next. Nothing shallower can express that: it needs a
 * collection whose rows themselves contain a collection.
 */
export const NESTED_ORDERS_SPEC = Object.freeze({
  version: MDY_SCHEMA_SPEC_VERSION,
  fields: Object.freeze({
    orders: Object.freeze({
      kind: "record",
      of: Object.freeze({
        ref: Object.freeze({ kind: "text", initial: "R" }),
        lines: Object.freeze({
          kind: "array",
          of: Object.freeze({
            sku: Object.freeze({ kind: "text", required: true }),
            allocations: Object.freeze({
              kind: "array",
              of: Object.freeze({
                bin: Object.freeze({ kind: "text", initial: "" }),
                qty: Object.freeze({ kind: "text", initial: "0" }),
              }),
              initial: Object.freeze([]),
            }),
          }),
          initial: Object.freeze([]),
        }),
      }),
      initial: Object.freeze({}),
    }),
  }),
});
