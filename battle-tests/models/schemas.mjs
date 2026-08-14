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
      return group(buildChildren(node.of, path, collectionPaths, asyncFor), node.when ? { when: node.when } : undefined);
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

function buildItem(of, path, collectionPaths, asyncFor) {
  // A collection item is either a leaf or a group of leaves; the row shape is the item, once.
  return of.kind ? buildNode(of, path, collectionPaths, asyncFor) : group(buildChildren(of, path, collectionPaths, asyncFor));
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
