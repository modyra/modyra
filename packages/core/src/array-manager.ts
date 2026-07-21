/**
 * Reconciles a typed array field's row structure with its value on the flat
 * {@link MdyFormEngine}. Structure follows value: `push`/`insert`/`remove`/
 * `move`/`setAll` fully rebuild the array's rows (remove all, re-register
 * the new set) rather than reindexing fields in place — touched/dirty/errors
 * of affected rows reset on structural changes (documented v1 semantics,
 * see docs/guides/typed-forms.md "Field arrays").
 *
 * A reactive reconciliation effect additionally absorbs rows that appear via
 * a raw flat write bypassing this manager (draft restore, undo/redo): it
 * registers validators for newly-present row indices. It cannot detect rows
 * disappearing this way (the engine only nulls values on `setValue`, it
 * never removes fields on its own) — undo across a structural boundary
 * (e.g. undoing a `push`) leaves the extra row registered with null values
 * until the next structural operation prunes it.
 */
import { MdyFormEngine } from "./form-engine.js";
import {
  MdyEffectRef,
  MdyReactivity,
  MdySignal,
  MdyWritableSignal,
} from "./reactivity.js";
import { hasRequiredMarker } from "./schema-utils.js";
import type {
  MdyAnyArrayDescriptor,
  MdyAnyFieldDescriptor,
  MdyAnyGroupDescriptor,
} from "./typed-form.js";
import { isRecord } from "./record-utils.js";

/** A row's own schema node — arrays cannot nest inside an array's item in v1. */
type MdyRowNode = MdyAnyFieldDescriptor | MdyAnyGroupDescriptor;

function assertNotNestedArray(
  node: MdyRowNode | { readonly kind: "array" },
): asserts node is MdyRowNode {
  if (node.kind === "array") {
    throw new Error(
      "[modyra] Nested arrays (an array item containing another array) are not supported",
    );
  }
}

/** Owner key for validators the array manager registers (schema namespace). */
const ROW_SCHEMA_KEY = "mdy-schema";

export interface MdyArrayManagerDeps {
  readonly rx: MdyReactivity;
  readonly engine: MdyFormEngine;
  /** Dotted array path, e.g. "items" or "order.items". */
  readonly path: string;
  readonly item: MdyAnyGroupDescriptor | MdyAnyFieldDescriptor;
}

/**
 * Owns one array node: registers/removes row fields on the engine so the
 * structure follows the value, and implements push/insert/remove/move/setAll.
 */
export class MdyArrayManager {
  private readonly _deps: MdyArrayManagerDeps;
  private readonly _initial: ReadonlyArray<unknown>;
  private readonly _rowCountSig: MdyWritableSignal<number>;
  private readonly _reconcile: MdyEffectRef | null;

  /** Current number of registered rows. */
  readonly rowCount: MdySignal<number>;

  constructor(deps: MdyArrayManagerDeps, initial: ReadonlyArray<unknown>) {
    this._deps = deps;
    this._initial = initial;
    this._rowCountSig = deps.rx.signal(0);
    this.rowCount = this._rowCountSig.asReadonly();
    // Registers a phantom field at the array's own path so array-level
    // validator errors (routed to this path) surface via engine.errorsFor()
    // and state.valid — errorsFor() only merges cross-errors for paths with
    // a real field record. Its own value is never read or written.
    deps.engine.getField(deps.path);
    this._rebuild(initial.slice());

    this._reconcile = deps.rx.canEffect
      ? deps.rx.effect(() => {
        const names = deps.engine.fieldNames();
        const present = this._presentIndices(names);
        deps.rx.untracked(() => this._absorb(present));
      })
      : null;
  }

  push(value: unknown): void {
    const values = this._currentValues();
    values.push(value);
    this._rebuild(values);
  }

  insert(index: number, value: unknown): void {
    const values = this._currentValues();
    values.splice(index, 0, value);
    this._rebuild(values);
  }

  remove(index: number): void {
    const values = this._currentValues();
    values.splice(index, 1);
    this._rebuild(values);
  }

  move(from: number, to: number): void {
    const values = this._currentValues();
    const removed = values.splice(from, 1);
    if (removed.length === 0) return;
    values.splice(to, 0, removed[0]);
    this._rebuild(values);
  }

  setAll(values: ReadonlyArray<unknown>): void {
    this._rebuild(values.slice());
  }

  /** Current row values, read back from the engine. */
  getValues(): unknown[] {
    return this._currentValues();
  }

  /** Rebuilds the rows back to the schema's declared initial array. */
  resetToInitial(): void {
    this.setAll(this._initial);
  }

  /** Releases the reconciliation effect — call when the owning form is destroyed. */
  destroy(): void {
    this._reconcile?.destroy();
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private _currentValues(): unknown[] {
    const count = this._rowCountSig();
    const out: unknown[] = [];
    for (let i = 0; i < count; i++) {
      out.push(this._readNode(`${this._deps.path}.${i}`, this._deps.item));
    }
    return out;
  }

  private _rebuild(values: unknown[]): void {
    const prevCount = this._rowCountSig();
    for (let i = 0; i < prevCount; i++) this._removeRow(i);
    values.forEach((v, i) => this._registerNode(`${this._deps.path}.${i}`, this._deps.item, v));
    this._rowCountSig.set(values.length);
  }

  private _registerNode(
    fullPath: string,
    rowNode: MdyAnyFieldDescriptor | MdyAnyGroupDescriptor | MdyAnyArrayDescriptor,
    value: unknown,
  ): void {
    assertNotNestedArray(rowNode);
    const node = rowNode;
    const { engine } = this._deps;
    if (node.kind === "field") {
      const v = value === undefined ? node.initial : value;
      if (node.sanitize !== null) {
        engine.setSanitizer(fullPath, node.sanitize);
      }
      engine.setInitialValue(fullPath, v);
      engine.getField(fullPath);
      const marksRequired = node.validators.some((fn) => hasRequiredMarker(fn));
      engine.upsertValidators(fullPath, ROW_SCHEMA_KEY, node.validators, marksRequired);
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
    for (const [key, child] of Object.entries(node.children)) {
      this._registerNode(`${fullPath}.${key}`, child, rec[key]);
    }
  }

  private _removeRow(index: number): void {
    for (const path of this._leafPaths(`${this._deps.path}.${index}`, this._deps.item)) {
      this._deps.engine.removeField(path);
    }
  }

  private _leafPaths(
    fullPath: string,
    rowNode: MdyAnyFieldDescriptor | MdyAnyGroupDescriptor | MdyAnyArrayDescriptor,
  ): string[] {
    assertNotNestedArray(rowNode);
    if (rowNode.kind === "field") return [fullPath];
    return Object.entries(rowNode.children).flatMap(([key, child]) =>
      this._leafPaths(`${fullPath}.${key}`, child),
    );
  }

  private _readNode(
    fullPath: string,
    rowNode: MdyAnyFieldDescriptor | MdyAnyGroupDescriptor | MdyAnyArrayDescriptor,
  ): unknown {
    assertNotNestedArray(rowNode);
    if (rowNode.kind === "field") {
      const ref = this._deps.engine.getField(fullPath);
      return ref ? ref().value() : null;
    }
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(rowNode.children)) {
      out[key] = this._readNode(`${fullPath}.${key}`, child);
    }
    return out;
  }

  private _presentIndices(names: readonly string[]): Set<number> {
    const prefix = `${this._deps.path}.`;
    const out = new Set<number>();
    for (const name of names) {
      if (!name.startsWith(prefix)) continue;
      const seg = name.slice(prefix.length).split(".")[0] ?? "";
      const n = Number(seg);
      if (Number.isInteger(n) && n >= 0 && String(n) === seg) out.add(n);
    }
    return out;
  }

  /** Registers validators for rows that appeared via a raw flat write (draft/undo/redo). */
  private _absorb(present: ReadonlySet<number>): void {
    const count = this._rowCountSig();
    let maxIndex = -1;
    for (const idx of present) {
      if (idx > maxIndex) maxIndex = idx;
      if (idx >= count) {
        const value = this._readNode(`${this._deps.path}.${idx}`, this._deps.item);
        this._registerNode(`${this._deps.path}.${idx}`, this._deps.item, value);
      }
    }
    const grown = maxIndex + 1;
    if (grown > count) this._rowCountSig.set(grown);
  }
}