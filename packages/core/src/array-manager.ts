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
 * registers validators for newly-present row indices and cleans up rows
 * that have disappeared. This prevents field record accumulation when
 * undo/redo happens across structural boundaries.
 */
import type { MdyCollectionHost } from "./contracts/collection-host.js";
import {
  MdyEffectRef,
  MdyReactivity,
  MdySignal,
  MdyWritableSignal,
  reactivityRunsEffects,
} from "./reactivity-contract.js";
import type {
  MdyAnyArrayDescriptor,
  MdyAnyFieldDescriptor,
  MdyAnyGroupDescriptor,
  MdyAnyRecordDescriptor,
} from "./contracts/descriptors.js";
import { isRecord } from "./record-utils.js";
import type {
  MdyCollectionDeps,
  MdyCollectionKind,
  MdyNestedCollection,
} from "./contracts/collection-manager.js";
import { registerRowNode, type MdyRowRegistration } from "./collections/register.js";

/** A row's own schema node. A record may sit inside an array's item; another array may not. */
type MdyRowNode = MdyAnyFieldDescriptor | MdyAnyGroupDescriptor;

/**
 * What an array's row may hold.
 *
 * A record, yes: it is keyed, so a row's descendants are addressed by name below a positional
 * prefix and a reorder rebuilds them under the new index. Another array, no: two positional levels
 * make a descendant's whole path move for two independent reasons, and nothing in the contract can
 * tell which one moved it (ADR 0040).
 */
function assertNotNestedCollection(
  node: MdyRowNode | { readonly kind: "array" | "record" },
): asserts node is MdyRowNode {
  if (node.kind === "array") {
    throw new Error(
      "[modyra] Nested collections (an array item containing another array) are not supported",
    );
  }
}


export interface MdyArrayManagerDeps {
  /**
   * The conditions of the sections this collection sits under.
   *
   * A collection inside a closed section is out of play like anything else under it, rows already
   * declared included — and it cannot work that out for itself, because a manager knows its own
   * path and nothing above it.
   */
  readonly sections?: ReadonlyArray<() => boolean>;
  readonly rx: MdyReactivity;
  readonly engine: MdyCollectionHost;
  /** Dotted array path, e.g. "items" or "order.items". */
  readonly path: string;
  readonly item: MdyAnyGroupDescriptor | MdyAnyFieldDescriptor;
  /** The host's development channel, so `devWarnings: false` silences these too. */
  readonly warn?: (message: string) => void;
  /** How to build a collection declared inside one of this collection's rows. */
  readonly createCollection: MdyCollectionDeps["createCollection"];
}

/**
 * Owns one array node: registers/removes row fields on the engine so the
 * structure follows the value, and implements push/insert/remove/move/setAll.
 */
/**
 * Refuses, when the form is built, a shape this manager cannot run.
 *
 * Everything below an array sits under a positional level, and a path may cross **one**: the walk
 * therefore goes *through* a record a row declares, and refuses any array it finds there — the
 * failure belongs where the schema was written, not to the first `push` in front of a user.
 */
function assertRowShape(node: MdyRowNode | { readonly kind: "array" | "record"; readonly item?: unknown }): void {
  assertNotNestedCollection(node as MdyRowNode);
  if (node.kind === "record") {
    assertRowShape((node as { readonly item: MdyRowNode }).item);
    return;
  }
  if (node.kind === "group") {
    for (const child of Object.values(node.children)) {
      assertRowShape(child as MdyRowNode);
    }
  }
}

export class MdyArrayManager implements MdyNestedCollection {
  readonly collectionKind: MdyCollectionKind = "array";
  private readonly _deps: MdyArrayManagerDeps;
  private readonly _initial: ReadonlyArray<unknown>;
  private readonly _rowCountSig: MdyWritableSignal<number>;
  private readonly _reconcile: MdyEffectRef | null;
  private readonly _releaseGate: () => void;
  /** Track the last known indices for cleanup detection. */
  private _lastPresentIndices = new Set<number>();

  /** Current number of registered rows. */
  readonly rowCount: MdySignal<number>;

  constructor(deps: MdyArrayManagerDeps, initial: ReadonlyArray<unknown>) {
    // Checked here rather than when a row first arrives: a schema that cannot work should fail where
    // it was written, not on the first `push` in front of a user.
    assertRowShape(deps.item);
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

    this._releaseGate = deps.engine.registerPathGate(deps.path, {
      // No `isOpen`: an array does not govern existence. Its rows follow its value — a write below
      // this path is a row of it, which is how a restored draft brings one back — so nothing is
      // refused and the field stays the owner's to remove.
      //
      // A whole-value write is a statement of which rows there are. Read as such it is the only
      // thing that can say a row *ceased* to exist: the engine writes flat paths and sets an absent
      // field to null rather than removing it, so a name that stays is a row that stays — which is
      // how undoing a push left an empty row behind, and how a draft written after a deletion
      // brought the deleted row back.
      onReplace: (paths) => this._keepOnly(this._presentIndices([...paths])),
    });

    this._reconcile = reactivityRunsEffects(deps.rx)
      ? deps.rx.effect(() => {
        const names = deps.engine.fieldNames();
        const present = this._presentIndices(names);
        deps.rx.untracked(() => this._absorb(present));
      })
      : null;
  }

  /**
   * Drops every row a whole-value write did not carry.
   *
   * Only drops. A write that carries *more* rows than are declared is growth, and growth is where
   * rows get their validators — registering them here instead would leave the reconciliation with
   * nothing left to do and the new rows unvalidated. So the count falls to what survives and is
   * never raised.
   *
   * The surviving rows keep their positions: an array is contiguous, and a write that skips an index
   * leaves that gap empty rather than closing it and moving someone else's data.
   */
  private _keepOnly(present: ReadonlySet<number>): void {
    const count = this._rowCountSig();
    let highest = -1;
    for (const index of present) if (index > highest) highest = index;

    for (let index = 0; index < count; index += 1) {
      if (!present.has(index)) this._removeRow(index);
    }
    this._rowCountSig.set(Math.min(count, highest + 1));
  }

  push(value: unknown): void {
    const values = this._currentValues();
    values.push(value);
    // The new row is the only one that is new; nothing above it moved.
    this._rebuild(values, values.length - 1);
  }

  insert(index: number, value: unknown): void {
    const values = this._currentValues();
    const at = Math.max(0, Math.min(values.length, index));
    values.splice(at, 0, value);
    this._rebuild(values, at);
  }

  remove(index: number): void {
    const values = this._currentValues();
    // An index the list does not have is not a removal, and a change that changes nothing must not
    // reset what the user did.
    if (index < 0 || index >= values.length) return;
    values.splice(index, 1);
    this._rebuild(values, index);
  }

  move(from: number, to: number): void {
    const values = this._currentValues();
    const removed = values.splice(from, 1);
    if (removed.length === 0) return;
    const at = Math.max(0, Math.min(values.length, to));
    values.splice(at, 0, removed[0]);
    this._rebuild(values, Math.min(from, at));
  }

  setAll(values: ReadonlyArray<unknown>): void {
    this._rebuild(values.slice());
  }

  /** Current row values, read back from the engine. */
  getValues(): unknown[] {
    return this._currentValues();
  }

  /** Every leaf path of every current row — what a parent collection treats as this array's fields. */
  leafPathsNow(): string[] {
    return Array.from({ length: this.rowCount() }, (_, index) =>
      this._leafPaths(`${this._deps.path}.${index}`, this._deps.item),
    ).flat();
  }

  /** Rebuilds the rows back to the schema's declared initial array. */
  resetToInitial(): void {
    this.setAll(this._initial);
  }

  /** Releases the reconciliation effect — call when the owning form is destroyed. */
  destroy(): void {
    this._releaseGate();
    this._reconcile?.destroy();
    for (const manager of this._nested.values()) manager.destroy();
    this._nested.clear();
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

  /**
   * Writes the rows the collection now has.
   *
   * Only the rows past the new end are removed. The ones that remain are registered again in place,
   * because a push at one end is not the other rows ending: a control bound to one of them never
   * moved, and tearing its field down would release the claim it holds and drop what it said about
   * the cell — a disabled column would come back enabled and be submitted.
   *
   * What a structural change *does* end is the state the user's interaction produced. Touched and
   * dirty do not travel with a row across an insert, a move or a whole-value write, so the rows that
   * survive are marked clean here rather than by being destroyed.
   */
  private _rebuild(values: unknown[], movedFrom = 0): void {
    const prevCount = this._rowCountSig();
    for (let i = values.length; i < prevCount; i++) this._removeRow(i);
    // Only from the first row the change actually moved. Appending a line moves nothing above it,
    // and a user's marks are theirs: clearing them all would make the errors a form only shows on a
    // visited field vanish when a row is added at the other end.
    for (let i = movedFrom; i < Math.min(prevCount, values.length); i++) this._clearRowInteraction(i);
    values.forEach((v, i) => this._registerNode(`${this._deps.path}.${i}`, this._deps.item, v, `${this._deps.path}.${i}`, this._deps.sections ?? []));
    this._rowCountSig.set(values.length);
    // Update tracking after rebuild (structural ops are always atomic)
    this._lastPresentIndices = new Set(Array.from({length: values.length}, (_, i) => i));
  }

  /** Forgets what the user did to a row that a structural change is rewriting. */
  private _clearRowInteraction(index: number): void {
    for (const path of this._leafPaths(`${this._deps.path}.${index}`, this._deps.item)) {
      const ref = this._deps.engine.peekField(path);
      if (!ref) continue;
      const state = ref();
      state.touched.set(false);
      state.dirty.set(false);
    }
  }

  /** The row a path belongs to, as the value an enclosing condition reads. */
  private _rowValue(rowPath: string): Record<string, unknown> {
    const row = this._readNode(rowPath, this._deps.item);
    return isRecord(row) ? row : {};
  }

  private _registerNode(
    fullPath: string,
    rowNode: MdyRowNode | { readonly kind: "array" | "record" },
    value: unknown,
    rowPath: string,
    sections: ReadonlyArray<() => boolean> = [],
  ): void {
    registerRowNode(this._registration, fullPath, rowNode as MdyRowNode, value, rowPath, sections);
  }

  /** What the shared visit needs from this manager, built once. */
  private get _registration(): MdyRowRegistration {
    return {
      engine: this._deps.engine,
      rx: this._deps.rx,
      readRow: (rowPath) => this._readNode(rowPath, this._deps.item),
      readNode: (path, node) => this._readNode(path, node as MdyRowNode),
      rowValue: (rowPath) => this._rowValue(rowPath),
      onCollection: (path, node, value) => {
        if (node.kind === "array") assertNotNestedCollection(node);
        this._declareNested(path, node as MdyAnyRecordDescriptor, value);
      },
    };
  }

  /** The record managers rows declared, keyed by their full path. */
  private readonly _nested = new Map<string, MdyNestedCollection>();

  private _declareNested(path: string, node: MdyAnyRecordDescriptor, value: unknown): void {
    this._nested.get(path)?.destroy();
    this._nested.set(path, this._deps.createCollection(
      "record",
      {
        rx: this._deps.rx,
        engine: this._deps.engine,
        path,
        item: node.item as MdyAnyFieldDescriptor | MdyAnyGroupDescriptor,
        // Everything below an array is under a positional level, and one is the limit.
        positionalAncestor: true,
        // Nothing here has a name to complain about that the engine has not already reported, so a
        // nested record's diagnostics go where the engine's do.
        warn: (message: string) => void message,
        // A row's collection is out of play with the row: an array's rows are positional, so what
        // says the row exists is the count, not a declaration.
        sections: [
          ...(this._deps.sections ?? []),
          () => Number(path.slice(this._deps.path.length + 1).split(".")[0]) < this._rowCountSig(),
        ],
        createCollection: this._deps.createCollection,
      },
      value,
    ));
  }

  /** Everything a row owned, the collections it declared included. */
  private _destroyNestedUnder(prefix: string): void {
    for (const [path, manager] of [...this._nested]) {
      if (path === prefix || path.startsWith(`${prefix}.`)) {
        manager.destroy();
        this._nested.delete(path);
        // The collection's own phantom field goes with it: registered so collection-level errors
        // have somewhere to surface, it would otherwise outlive the row and read as a value.
        this._deps.engine.disownField(path);
        this._deps.engine.removeField(path);
      }
    }
  }

  /** The manager for a collection a row declared below this one, if it is still alive. */
  nested(path: string): MdyNestedCollection | undefined {
    const own = this._nested.get(path);
    if (own) return own;
    for (const [at, manager] of this._nested) {
      if (path.startsWith(`${at}.`)) {
        const found = manager.nested(path);
        if (found) return found;
      }
    }
    return undefined;
  }

  /**
   * Replaces the rows wholesale, from whatever the enclosing write carried.
   *
   * A value that is not an array says nothing about rows, so it changes nothing.
   */
  setAllFrom(value: unknown): void {
    if (Array.isArray(value)) this.setAll(value as unknown[]);
  }

  private _removeRow(index: number): void {
    // The leaves are read before the subtree is destroyed: a nested collection answers what its
    // rows are, and a destroyed manager answers nothing — which used to leave its fields behind.
    const leaves = this._leafPaths(`${this._deps.path}.${index}`, this._deps.item);
    this._destroyNestedUnder(`${this._deps.path}.${index}`);
    for (const path of leaves) {
      // Ownership goes first: this is the row ending, which is the one thing that may take the
      // field with it.
      this._deps.engine.disownField(path);
      this._deps.engine.removeField(path);
    }
  }

  private _leafPaths(
    fullPath: string,
    rowNode:
      | MdyAnyFieldDescriptor
      | MdyAnyGroupDescriptor
      | MdyAnyArrayDescriptor
      | MdyAnyRecordDescriptor,
  ): string[] {
    if (rowNode.kind === "record") {
      const nested = this._nested.get(fullPath);
      if (!nested) return [];
      return nested.leafPathsNow();
    }
    assertNotNestedCollection(rowNode);
    if (rowNode.kind === "field") return [fullPath];
    return Object.entries(rowNode.children).flatMap(([key, child]) =>
      this._leafPaths(`${fullPath}.${key}`, child),
    );
  }

  private _readNode(
    fullPath: string,
    rowNode:
      | MdyAnyFieldDescriptor
      | MdyAnyGroupDescriptor
      | MdyAnyArrayDescriptor
      | MdyAnyRecordDescriptor,
  ): unknown {
    if (rowNode.kind === "record") {
      const nested = this._nested.get(fullPath);
      return nested ? nested.getValues() : {};
    }
    assertNotNestedCollection(rowNode);
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

  /**
   * Registers validators for rows that appeared via a raw flat write (draft/undo/redo)
   * and removes rows that disappeared via undo across a structural boundary.
   */
  private _absorb(present: ReadonlySet<number>): void {
    const count = this._rowCountSig();
    let maxIndex = -1;

    // Register new rows that appeared (e.g., from draft restore or undo of a delete)
    for (const idx of present) {
      if (idx > maxIndex) maxIndex = idx;
      if (idx >= count) {
        const value = this._readNode(`${this._deps.path}.${idx}`, this._deps.item);
        this._registerNode(`${this._deps.path}.${idx}`, this._deps.item, value, `${this._deps.path}.${idx}`, this._deps.sections ?? []);
      }
    }

    // Clean up rows that disappeared (e.g., undo of a push leaves a stale field)
    for (const idx of this._lastPresentIndices) {
      if (!present.has(idx)) {
        this._removeRow(idx);
      }
    }

    const grown = maxIndex + 1;
    if (grown > count) this._rowCountSig.set(grown);

    // Update tracking for next reconciliation
    this._lastPresentIndices = new Set(present);
  }
}
