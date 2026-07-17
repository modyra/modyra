import { isSafeFieldPath } from "./path-utils.js";
import { MDY_MARKS_REQUIRED } from "./validators.js";
import type {
  MdyAnyFieldDescriptor,
  MdyFormPatch,
  MdyFormSchema,
  MdyFormValue,
} from "./typed-form.js";
import type { ValidatorFn } from "./types.js";

/** Schema traversal result used by typed forms. */
export interface MdySchemaPaths {
  readonly leafPaths: readonly string[];
  readonly groupPaths: ReadonlySet<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** True when a validator carries the internal "marks required" marker. */
export function hasRequiredMarker(fn: ValidatorFn<never>): boolean {
  return Reflect.get(fn, MDY_MARKS_REQUIRED) === true;
}

/**
 * Walks a schema, calling `onField` for every leaf and `onGroup` for every
 * nested group prefix. The order is deterministic (object insertion order).
 */
export function walkSchema(
  nodes: MdyFormSchema,
  prefix: string,
  onField: (path: string, node: MdyAnyFieldDescriptor) => void,
  onGroup?: (path: string) => void,
): void {
  for (const [key, node] of Object.entries(nodes)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (node.kind === "field") {
      onField(path, node);
    } else {
      onGroup?.(path);
      walkSchema(node.children, path, onField, onGroup);
    }
  }
}

/** Collects leaf paths and group prefixes from a schema. */
export function collectSchemaPaths(nodes: MdyFormSchema): MdySchemaPaths {
  const leafPaths: string[] = [];
  const groupPaths = new Set<string>();
  walkSchema(
    nodes,
    "",
    (path) => leafPaths.push(path),
    (path) => groupPaths.add(path),
  );
  return { leafPaths, groupPaths };
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

/**
 * Flattens a (possibly nested) patch object into dotted adapter paths,
 * recursing only through keys that match registered group prefixes.
 */
export function flattenPatch(
  partial: Record<string, unknown>,
  groupPaths: ReadonlySet<string>,
): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  const walk = (node: unknown, prefix: string): void => {
    if (!isRecord(node)) return;
    for (const [key, v] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (groupPaths.has(path) && v !== null && isRecord(v)) {
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
