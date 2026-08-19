/**
 * Declaring a row's cells, once for both kinds of collection.
 *
 * An array row and a record row are declared the same way — sanitizer, initial value, ownership,
 * validators, the composed conditions, the async runners — and the two managers each wrote it. They
 * had already drifted: only one of them told the form the row *owns* its cells, so the sentence
 * `MdyCollectionHost` states about ownership was true of arrays and not of records.
 *
 * The visit is recursive over the row's own shape. What it does about a collection *inside* a row
 * is the caller's answer, handed in as `onCollection`, because that is the part the two kinds do
 * not share and the part that is still being built.
 */
import { composeConditions, type MdyCondition } from "../conditions.js";
import type { MdyCollectionHost } from "../contracts/collection-host.js";
import type {
  MdyAnyArrayDescriptor,
  MdyAnyFieldDescriptor,
  MdyAnyGroupDescriptor,
  MdyAnyRecordDescriptor,
} from "../contracts/descriptors.js";
import type { MdyReactivity } from "../reactivity-contract.js";
import { isRecord } from "../record-utils.js";
import { hasRequiredMarker } from "../schema-utils.js";

/** Owner key for validators a collection registers on behalf of its rows. */
export const ROW_SCHEMA_KEY = "mdy-schema";

export type MdyRowDescriptor =
  | MdyAnyFieldDescriptor
  | MdyAnyGroupDescriptor
  | MdyAnyArrayDescriptor
  | MdyAnyRecordDescriptor;

/**
 * Whether the row template declares the cell this path names.
 *
 * A draft is written flat and read back flat, so the *path* is the instruction: `lines.a.sku` is a
 * cell of row `a`, and a row named by a path that does not exist is created to receive it — which is
 * how a saved order gets its lines back. That makes an extra segment an instruction too. `lines.a.b.sku`
 * asks for a row `a` holding a `b` holding a `sku`, and nothing in the document ever described a `b`:
 * built anyway, the collection holds a row of a shape its own template does not have, and the form
 * calls itself valid because there is no field there to be invalid.
 *
 * So the remainder is walked against the template. A nested collection answers for its own subtree —
 * its rows do not exist yet either, and its own manager applies this same rule when they arrive.
 */
export function rowDeclaresCell(
  item: MdyRowDescriptor,
  rest: string,
): boolean {
  if (rest.length === 0) return true;
  let node: MdyRowDescriptor | undefined = item;
  for (const segment of rest.split(".")) {
    if (node === undefined) return false;
    if (node.kind === "record" || node.kind === "array") return true;
    if (node.kind !== "group") return false;
    node = (node as MdyAnyGroupDescriptor).children[segment] as MdyRowDescriptor | undefined;
  }
  return node !== undefined;
}

export interface MdyRowRegistration {
  readonly engine: MdyCollectionHost;
  readonly rx: MdyReactivity;
  /** The whole row as its declared shape says it looks — what a leaf's own condition reads. */
  readonly readRow: (rowPath: string) => unknown;
  /** A named node's value, for the condition of a section inside the row. */
  readonly readNode: (path: string, node: MdyRowDescriptor) => unknown;
  /** The whole row's value, for a condition that reads across its siblings. */
  readonly rowValue: (rowPath: string) => Record<string, unknown>;
  /**
   * What to do about a collection declared inside a row.
   *
   * Refusing is what both managers do today, and the refusal belongs to the caller because the two
   * word it differently and each names its own kind.
   */
  readonly onCollection: (
    path: string,
    node: MdyAnyArrayDescriptor | MdyAnyRecordDescriptor,
    value: unknown,
  ) => void;
}

export function registerRowNode(
  deps: MdyRowRegistration,
  fullPath: string,
  node: MdyRowDescriptor,
  value: unknown,
  rowPath: string,
  sections: ReadonlyArray<() => boolean> = [],
): void {
  const { engine } = deps;

  if (node.kind === "array" || node.kind === "record") {
    deps.onCollection(fullPath, node, value);
    return;
  }

  if (node.kind === "field") {
    if (node.sanitize !== null) engine.setSanitizer(fullPath, node.sanitize);
    // A row's cells are declared by the same descriptor the schema walk reads at the top, and a
    // secret in a row is the one most worth keeping out of storage: a row is data, so its path is
    // one nobody could have written into an `exclude` list before the user created it.
    if (node.sensitive) engine.markSensitive?.(fullPath);
    engine.setInitialValue(fullPath, value === undefined ? node.initial : value);
    engine.getField(fullPath);
    // The row declared it. A control showing it may come and go; the row is what ends it.
    engine.ownField(fullPath);

    engine.upsertValidators(
      fullPath,
      ROW_SCHEMA_KEY,
      node.validators,
      node.validators.some((fn) => hasRequiredMarker(fn)),
    );

    // Its own condition and every section above it, composed once by `conditions.ts` — the same
    // sentence the schema registration uses. The sections are already bound to what they read, a
    // section above a collection knowing the form rather than the row, so they take no arguments.
    const conditions: MdyCondition[] = sections.map((holds) => ({
      holds: () => holds(),
      read: () => ({ value: null, enclosing: {} }),
    }));
    if (node.when !== null) {
      const when = node.when;
      conditions.push({
        holds: when,
        read: () => {
          const row = deps.readRow(rowPath);
          return {
            value: engine.getField(fullPath)?.().value(),
            enclosing: isRecord(row) ? row : {},
          };
        },
      });
    }
    if (conditions.length > 0) {
      engine.setInactive(fullPath, composeConditions(deps.rx, conditions));
    }

    if (node.asyncValidators.length > 0) {
      engine.upsertAsyncValidators(fullPath, ROW_SCHEMA_KEY, node.asyncValidators, {
        debounceMs: node.asyncDebounceMs,
        dependsOn: node.asyncDependsOn,
        timeoutMs: node.asyncTimeoutMs,
        when: node.asyncWhen ?? undefined,
      });
    }
    return;
  }

  const rec = isRecord(value) ? value : {};
  // A section inside a row: its children answer to it as well as to everything above it.
  const nested = node.when !== null
    ? [
        ...sections,
        () =>
          node.when!(
            deps.readNode(fullPath, node) as Record<string, unknown>,
            deps.rowValue(rowPath),
          ),
      ]
    : sections;
  for (const [key, child] of Object.entries(node.children)) {
    registerRowNode(deps, `${fullPath}.${key}`, child as MdyRowDescriptor, rec[key], rowPath, nested);
  }
}
