import { isSafeFieldPath } from "./path-utils.js";
import { factsOf } from "./validator-facts.js";
import type {
  MdyAnyArrayDescriptor,
  MdyAnyFieldDescriptor,
  MdyAnyGroupDescriptor,
  MdyAnyRecordDescriptor,
  MdyFormPatch,
  MdyFormSchema,
  MdyFormValue,
} from "./contracts/descriptors.js";
import type { ValidatorFn } from "./types.js";

/** Schema traversal result used by typed forms. */
export interface MdySchemaPaths {
  readonly leafPaths: readonly string[];
  readonly groupPaths: ReadonlySet<string>;
  readonly arrayPaths: ReadonlySet<string>;
  readonly recordPaths: ReadonlySet<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * True when a validator declares that it makes the field required — including one that merely
 * combines rules, since a combination carries the sum of what it combines.
 */
export function hasRequiredMarker(fn: ValidatorFn<never>): boolean {
  return factsOf(fn).required === true;
}

/**
 * Walks a schema, calling `onField` for every leaf and `onGroup` for every
 * nested group prefix. Array nodes are not descended into (their rows are
 * dynamic, not part of the static schema shape) — `onArray` is called
 * instead. The order is deterministic (object insertion order).
 */
export function walkSchema(
  nodes: MdyFormSchema,
  prefix: string,
  onField: (path: string, node: MdyAnyFieldDescriptor) => void,
  onGroup?: (path: string, node: MdyAnyGroupDescriptor) => void,
  onArray?: (path: string, node: MdyAnyArrayDescriptor) => void,
  onRecord?: (path: string, node: MdyAnyRecordDescriptor) => void,
): void {
  for (const [key, node] of Object.entries(nodes)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (node.kind === "field") {
      onField(path, node);
    } else if (node.kind === "array") {
      onArray?.(path, node);
    } else if (node.kind === "record") {
      onRecord?.(path, node);
    } else {
      onGroup?.(path, node);
      walkSchema(node.children, path, onField, onGroup, onArray, onRecord);
    }
  }
}

/** Collects leaf paths, group prefixes, array paths and record paths from a schema. */
/**
 * The collections declared inside a row, as patterns.
 *
 * A row's key is chosen at runtime, so the path of a collection inside one cannot be enumerated —
 * `orders.o1.lines` and `orders.o2.lines` are the same declaration. `*` stands for the row segment,
 * and every reader of these sets matches against the pattern rather than the literal path.
 */
function collectItemPaths(
  prefix: string,
  item: unknown,
  arrayPaths: Set<string>,
  recordPaths: Set<string>,
): void {
  const node = item as { readonly kind?: string; readonly children?: MdyFormSchema; readonly item?: unknown };
  if (node.kind === "group" && node.children) {
    for (const [key, child] of Object.entries(node.children)) {
      collectItemPaths(`${prefix}.${key}`, child, arrayPaths, recordPaths);
    }
    return;
  }
  if (node.kind === "array") {
    arrayPaths.add(prefix);
    collectItemPaths(`${prefix}.*`, node.item, arrayPaths, recordPaths);
    return;
  }
  if (node.kind === "record") {
    recordPaths.add(prefix);
    collectItemPaths(`${prefix}.*`, node.item, arrayPaths, recordPaths);
  }
}

export function collectSchemaPaths(nodes: MdyFormSchema): MdySchemaPaths {
  const leafPaths: string[] = [];
  const groupPaths = new Set<string>();
  const arrayPaths = new Set<string>();
  const recordPaths = new Set<string>();
  walkSchema(
    nodes,
    "",
    (path) => leafPaths.push(path),
    (path) => groupPaths.add(path),
    (path, node) => {
      arrayPaths.add(path);
      collectItemPaths(`${path}.*`, node.item, arrayPaths, recordPaths);
    },
    (path, node) => {
      recordPaths.add(path);
      collectItemPaths(`${path}.*`, node.item, arrayPaths, recordPaths);
    },
  );
  return { leafPaths, groupPaths, arrayPaths, recordPaths };
}

/** Rebuilds the nested value shape from a flat dotted-path record. */
export function unflatten(
  flat: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [path, v] of Object.entries(flat)) {
    // Engine paths are validated at field creation; this guard covers
    // records from outside the engine (defense against prototype pollution).
    if (!isSafeFieldPath(path)) continue;
    const parts = path.split(".");
    let target = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part === undefined) continue;
      const existing = target[part];
      if (isRecord(existing)) {
        target = existing;
      } else {
        const next: Record<string, unknown> = {};
        target[part] = next;
        target = next;
      }
    }
    const leaf = parts[parts.length - 1];
    if (leaf !== undefined) target[leaf] = v;
  }
  return out;
}

/** True for a record whose keys are all canonical array indices ("0", "1", …). */
function isIndexRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((k) => /^\d+$/.test(k) && String(Number(k)) === k);
}

/**
 * Converts the index-keyed records `unflatten` produces at array paths
 * (`{ items: { "0": {...}, "1": {...} } }`) into real JS arrays, in index
 * order. Non-array paths, and array paths with no rows, are left as-is.
 *
 * A record's keys are data, and an entity id serialised — `"12"`, `"34"` — is the ordinary case
 * rather than the exotic one. Converting those would hand the caller an array with holes where the
 * ids are not consecutive, so a record path is a place this conversion stops: its keys are kept, and
 * nothing below it is a candidate either.
 */
export function numericKeysToArrays(
  nested: Record<string, unknown>,
  arrayPaths: ReadonlySet<string>,
  recordPaths: ReadonlySet<string> = new Set(),
): Record<string, unknown> {
  if (arrayPaths.size === 0 && recordPaths.size === 0) return nested;
  /**
   * The value, with each collection shaped as its declaration says.
   *
   * `prefix` is a *pattern*, not the literal path: a row's key is chosen at runtime, so descending
   * through one substitutes `*` for it. Without that a collection inside a row is not recognised as
   * a collection, and an empty one disappears from the value entirely.
   */
  const walk = (node: unknown, prefix: string): unknown => {
    if (!isRecord(node)) return node;
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (recordPaths.has(path)) {
        // Keys are kept as they are; the collection's own phantom field reads null, and a record is
        // an object even when it holds no rows.
        const rows = isRecord(v) && !Array.isArray(v) ? v : {};
        out[key] = Object.fromEntries(
          Object.entries(rows).map(([rowKey, row]) => [rowKey, walk(row, `${path}.*`)]),
        );
      } else if (arrayPaths.has(path)) {
        out[key] = isIndexRecord(v)
          ? Object.keys(v)
            .map(Number)
            .sort((a, b) => a - b)
            .map((i) => walk(v[String(i)], `${path}.*`))
          : [];
      } else {
        out[key] = walk(v, path);
      }
    }
    return out;
  };
  return walk(nested, "") as Record<string, unknown>;
}

/**
 * Flattens a (possibly nested) patch object into dotted adapter paths,
 * recursing only through keys that match registered group prefixes. Values
 * under `arrayPaths` are treated as leaves (replaced wholesale) — descending
 * into them would produce partial row patches outside the array manager's
 * control.
 */
export function flattenPatch(
  partial: Record<string, unknown>,
  groupPaths: ReadonlySet<string>,
  arrayPaths: ReadonlySet<string> = new Set(),
  recordPaths: ReadonlySet<string> = new Set(),
): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  const walk = (node: unknown, prefix: string): void => {
    if (!isRecord(node)) return;
    for (const [key, v] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (recordPaths.has(path) || arrayPaths.has(path)) {
        flat[path] = v;
      } else if (groupPaths.has(path) && v !== null && isRecord(v)) {
        walk(v, path);
      } else {
        flat[path] = v;
      }
    }
  };
  walk(partial, "");
  return flat;
}

/** Reads a dotted path from a nested value, returning `null` when absent. */
export function pathGet(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const part of path.split(".")) {
    if (!isRecord(current)) return null;
    current = current[part];
  }
  return current === undefined ? null : current;
}

/** Type guard: an array item matches the item descriptor's shape. */
/**
 * A row's value against the shape its item declares.
 *
 * A row may hold a collection of its own, so this recurses rather than stopping at a group: a
 * nested collection whose shape went unchecked is a value the engine accepts and then cannot
 * flatten back.
 */
function isSchemaItemValue(value: unknown, item: unknown): boolean {
  const node = item as {
    readonly kind: string;
    readonly children?: MdyFormSchema;
    readonly item?: unknown;
  };
  if (node.kind === "field") return true;
  if (node.kind === "array") {
    return Array.isArray(value) && value.every((row) => isSchemaItemValue(row, node.item));
  }
  if (node.kind === "record") {
    return isRecord(value) && !Array.isArray(value)
      && Object.values(value).every((row) => isSchemaItemValue(row, node.item));
  }
  return isSchemaValue(value, node.children ?? {});
}

/** Type guard: the value contains every key declared by the schema. */
export function isSchemaValue<S extends MdyFormSchema>(
  value: unknown,
  nodes: S,
): value is MdyFormValue<S> {
  if (!isRecord(value)) return false;
  for (const [key, node] of Object.entries(nodes)) {
    if (!(key in value)) return false;
    const child = value[key];
    if (node.kind === "field") continue;
    if (node.kind === "array") {
      if (!Array.isArray(child)) return false;
      if (!child.every((row) => isSchemaItemValue(row, node.item))) return false;
      continue;
    }
    if (node.kind === "record") {
      if (!isRecord(child) || Array.isArray(child)) return false;
      if (!Object.values(child).every((row) => isSchemaItemValue(row, node.item))) return false;
      continue;
    }
    if (!isSchemaValue(child, node.children)) return false;
  }
  return true;
}

/** Type guard: the value only contains keys declared by the schema. */
export function isSchemaPatch<S extends MdyFormSchema>(
  value: unknown,
  nodes: S,
): value is MdyFormPatch<S> {
  if (!isRecord(value)) return false;
  for (const [key, child] of Object.entries(value)) {
    const node = nodes[key];
    if (node === undefined) return false;
    if (node.kind === "field") continue;
    if (node.kind === "array") {
      if (!Array.isArray(child)) return false;
      if (!child.every((row) => isSchemaItemValue(row, node.item))) return false;
      continue;
    }
    if (node.kind === "record") {
      if (!isRecord(child) || Array.isArray(child)) return false;
      continue;
    }
    if (!isSchemaPatch(child, node.children)) return false;
  }
  return true;
}

/** Runtime shape check for a freshly-built field handle tree. */
export function isFieldHandleTree(
  value: unknown,
  nodes: MdyFormSchema,
): boolean {
  if (!isRecord(value)) return false;
  for (const [key, node] of Object.entries(nodes)) {
    const entry = value[key];
    if (node.kind === "array") {
      if (!isRecord(entry)) return false;
      if (typeof entry.path !== "string") return false;
      if (typeof entry.push !== "function") return false;
      if (typeof entry.remove !== "function") return false;
      if (typeof (entry.rows as (() => unknown) | undefined) !== "function") return false;
      continue;
    }
    if (node.kind === "record") {
      if (!isRecord(entry)) return false;
      if (typeof entry.path !== "string") return false;
      if (typeof entry.upsert !== "function") return false;
      if (typeof entry.remove !== "function") return false;
      if (typeof entry.cell !== "function") return false;
      if (typeof (entry.keys as (() => unknown) | undefined) !== "function") return false;
      continue;
    }
    if (node.kind === "group") {
      if (!isFieldHandleTree(entry, node.children)) return false;
      continue;
    }
    if (!isRecord(entry)) return false;
    if (typeof entry.path !== "string") return false;
    if (typeof entry.set !== "function") return false;
    if (typeof entry.markAsTouched !== "function") return false;
    if (typeof entry.markAsDirty !== "function") return false;
  }
  return true;
}
