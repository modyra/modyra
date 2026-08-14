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
  reactivityBatches,
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

/** The place in a reordering that no row came from: the row the change created. */
const NEW_ROW = -1;

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
  /** A row's shape: a field, a group, or a collection of either kind. */
  readonly item: MdyRowNode | MdyAnyArrayDescriptor | MdyAnyRecordDescriptor;
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
 * A row may hold fields, groups and collections of either kind, at any depth: a collection inside a
 * row is addressed by the pattern its declaration has — `items.*`, `orders.*.lines` — so a second
 * positional level names its rows as unambiguously as the first. What is still walked is the *kind*
 * of every node, so a shape that is not a form at all fails where the schema was written rather than
 * at the first `push` in front of a user.
 */
function assertRowShape(node: MdyRowNode | { readonly kind: "array" | "record"; readonly item?: unknown }): void {
  if (node.kind === "array" || node.kind === "record") {
    assertRowShape((node as { readonly item: MdyRowNode }).item);
    return;
  }
  if (node.kind === "group") {
    for (const child of Object.values(node.children)) {
      assertRowShape(child as MdyRowNode);
    }
    return;
  }
  if (node.kind !== "field") {
    throw new Error(
      `[modyra] A row may hold a field, a group or a collection — not ${String((node as { kind: string }).kind)}`,
    );
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
      /**
       * Which rows are in play: the ones this collection has.
       *
       * Its rows still follow its *value* — a write below this path is a row of it, which is how a
       * restored draft brings one back, and `onRefusedWrite` below grows the list to receive it. A
       * *claim* is not a write: a control binding to a row the list does not have waits for it, as
       * it does in a keyed collection, instead of bringing a row into being. Without that
       * distinction, rendering decided what existed — a control bound to row 1 of an empty list made
       * two rows, one of them a hole `getValue()` could not describe.
       */
      isOpen: (name) => {
        // The collection's own path is not a row of it: the phantom field there carries the
        // collection-level errors, and a gate that refused it would take the collection out of its
        // own form's value.
        if (name === this._deps.path) return true;
        const index = this._indexUnder(name);
        return index !== null && index < this._deps.rx.untracked(() => this._rowCountSig());
      },
      /**
       * A value arriving for a row the list does not have yet is the owner's own data — a restored
       * draft, an undo across the moment a row was pushed — so the list grows to receive it rather
       * than dropping it.
       */
      onRefusedWrite: (name) => {
        const index = this._indexUnder(name);
        if (index === null) return;
        const count = this._deps.rx.untracked(() => this._rowCountSig());
        if (index < count) return;
        // The count first: the rows are in play before their fields are written, or the gate this
        // very callback exists to open would refuse the registration it is making.
        this._rowCountSig.set(index + 1);
        for (let i = count; i <= index; i += 1) {
          this._registerNode(`${this._deps.path}.${i}`, this._deps.item, undefined, `${this._deps.path}.${i}`, this._deps.sections ?? []);
        }
      },
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
    const kept = Math.min(count, highest + 1);
    this._rowCountSig.set(kept);
    if (kept < count) this._deps.engine.refreshPathGate(this._deps.path);
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
    const order = this._identityOrder(values.length);
    order.splice(at, 0, NEW_ROW);
    values.splice(at, 0, value);
    this._carryBindings(order);
    this._rebuild(values, at);
  }

  remove(index: number): void {
    const values = this._currentValues();
    // An index the list does not have is not a removal, and a change that changes nothing must not
    // reset what the user did.
    if (index < 0 || index >= values.length) return;
    const order = this._identityOrder(values.length);
    order.splice(index, 1);
    values.splice(index, 1);
    this._carryBindings(order, [index]);
    this._rebuild(values, index);
  }

  move(from: number, to: number): void {
    const values = this._currentValues();
    const removed = values.splice(from, 1);
    if (removed.length === 0) return;
    const at = Math.max(0, Math.min(values.length, to));
    values.splice(at, 0, removed[0]);
    const order = this._identityOrder(values.length + 1);
    const [moved] = order.splice(from, 1);
    order.splice(at, 0, moved!);
    this._carryBindings(order);
    this._rebuild(values, Math.min(from, at));
  }

  /** `[0, 1, … length - 1]`, the order before a structural change rearranges it. */
  private _identityOrder(length: number): number[] {
    return Array.from({ length }, (_, index) => index);
  }

  /**
   * Carries what a binder said about each row to the index that row now has.
   *
   * `order[newIndex]` is the index the row had before the change, or {@link NEW_ROW} for one the
   * change created. A binding is the consumer's word about a *row* — this cell is not for editing —
   * so leaving it at the index while the rows move under it would suppress a cell of whichever row
   * arrived there. `ended` names the rows the change removed, whose bindings go with them.
   */
  private _carryBindings(order: readonly number[], ended: readonly number[] = []): void {
    const suffixes = this._leafPaths(`${this._deps.path}.0`, this._deps.item)
      .map((path) => path.slice(`${this._deps.path}.0`.length));
    if (suffixes.length === 0) return;

    const pathAt = (index: number, suffix: string): string => `${this._deps.path}.${index}${suffix}`;

    for (const index of ended) {
      for (const suffix of suffixes) this._deps.engine.clearBindings(pathAt(index, suffix));
    }

    const pairs: Array<readonly [string, string]> = [];
    for (const [newIndex, oldIndex] of order.entries()) {
      if (oldIndex === NEW_ROW || oldIndex === newIndex) continue;
      for (const suffix of suffixes) pairs.push([pathAt(oldIndex, suffix), pathAt(newIndex, suffix)]);
    }
    if (pairs.length > 0) this._deps.engine.carryBindings(pairs);
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
    // What the list holds now, as plain data: the state to go back to if writing the new rows raises.
    const before = this._currentValues();
    for (let i = values.length; i < prevCount; i++) this._removeRow(i);
    // Only from the first row the change actually moved. Appending a line moves nothing above it,
    // and a user's marks are theirs: clearing them all would make the errors a form only shows on a
    // visited field vanish when a row is added at the other end.
    for (let i = movedFrom; i < Math.min(prevCount, values.length); i++) this._clearRowInteraction(i);
    // The rows are in play before their fields are written: the gate answers from this count, and a
    // registration is the collection declaring a row rather than something asking for one. The
    // refresh in between is what takes the fields of the rows that just ended.
    this._rowCountSig.set(values.length);
    if (values.length < prevCount) this._deps.engine.refreshPathGate(this._deps.path);
    try {
      // One structural change, one change to observe: a runtime whose computations run eagerly would
      // otherwise re-read the form between two of a row's cells and find a shape the schema does not
      // describe. A runtime without batching runs exactly as before.
      this._batched(() => {
        values.forEach((v, i) => this._registerNode(`${this._deps.path}.${i}`, this._deps.item, v, `${this._deps.path}.${i}`, this._deps.sections ?? []));
      });
    } catch (error) {
      // Reading a row's value can raise — a getter over a store that is not loaded, a proxy that
      // refuses. The list goes back to the rows it had, because a count that says one thing while
      // the value says another is a list a consumer cannot iterate. `before` was read out of the
      // engine, so restoring it cannot raise in turn.
      this._rowCountSig.set(before.length);
      this._deps.engine.refreshPathGate(this._deps.path);
      this._batched(() => {
        before.forEach((v, i) => this._registerNode(`${this._deps.path}.${i}`, this._deps.item, v, `${this._deps.path}.${i}`, this._deps.sections ?? []));
      });
      throw error;
    }
    // Update tracking after rebuild (structural ops are always atomic)
    this._lastPresentIndices = new Set(Array.from({length: values.length}, (_, i) => i));
  }

  /** Runs `write` as one change where the runtime can, and plainly where it cannot. */
  private _batched(write: () => void): void {
    const rx = this._deps.rx;
    if (reactivityBatches(rx)) rx.batch(write);
    else write();
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
        this._declareNested(path, node as MdyAnyRecordDescriptor | MdyAnyArrayDescriptor, value);
      },
    };
  }

  /** The record managers rows declared, keyed by their full path. */
  private readonly _nested = new Map<string, MdyNestedCollection>();

  private _declareNested(
    path: string,
    node: MdyAnyRecordDescriptor | MdyAnyArrayDescriptor,
    value: unknown,
  ): void {
    // The subtree being replaced ends with the declaration that held it: its manager goes, and so do
    // the fields it registered. Left behind, they are read back as rows by the reconciliation and the
    // old list reappears under the new one.
    const replaced = this._nested.get(path);
    if (replaced) {
      const leaves = replaced.leafPathsNow();
      replaced.destroy();
      for (const leaf of leaves) this._deps.engine.endField(leaf);
    }
    this._nested.set(path, this._deps.createCollection(
      node.kind,
      {
        rx: this._deps.rx,
        engine: this._deps.engine,
        path,
        item: node.item,
        // Everything below an array is under a positional level; the flag says so for the readers
        // that order a rebuild by it, and refuses nothing.
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

  /**
   * Ends a row: its subtree, its ownership, and then its fields.
   *
   * The fields go when the gate stops admitting them — the count falls and
   * {@link MdyFormEngine.refreshPathGate} destroys what the collection no longer has, putting the
   * claims of controls still bound there back into waiting. Calling `removeField` here instead
   * would ask the engine to release a *control's* claim, which is not what a row ending means.
   */
  private _removeRow(index: number): void {
    // The leaves are read before the subtree is destroyed: a nested collection answers what its
    // rows are, and a destroyed manager answers nothing — which used to leave its fields behind.
    const leaves = this._leafPaths(`${this._deps.path}.${index}`, this._deps.item);
    this._destroyNestedUnder(`${this._deps.path}.${index}`);
    for (const path of leaves) {
      // Ownership goes first: this is the row ending, which is the one thing that may take the
      // field with it.
      this._deps.engine.disownField(path);
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
    // Either kind of collection inside the row answers for its own subtree; a manager that is not
    // there yet has no leaves, which is what an undeclared row means.
    if (rowNode.kind === "record" || rowNode.kind === "array") {
      return this._nested.get(fullPath)?.leafPathsNow() ?? [];
    }
    if (rowNode.kind === "field") return [fullPath];
    return Object.entries((rowNode as MdyAnyGroupDescriptor).children).flatMap(([key, child]) =>
      this._leafPaths(`${fullPath}.${key}`, child as MdyAnyFieldDescriptor | MdyAnyGroupDescriptor),
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
    if (rowNode.kind === "record" || rowNode.kind === "array") {
      const nested = this._nested.get(fullPath);
      if (nested) return nested.getValues();
      // The empty shape its kind has, so a collection nobody has declared into still reads as one.
      return rowNode.kind === "array" ? [] : {};
    }
    if (rowNode.kind === "field") {
      const ref = this._deps.engine.getField(fullPath);
      return ref ? ref().value() : null;
    }
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries((rowNode as MdyAnyGroupDescriptor).children)) {
      out[key] = this._readNode(`${fullPath}.${key}`, child as MdyAnyFieldDescriptor | MdyAnyGroupDescriptor);
    }
    return out;
  }

  /** The row index a path names under this collection, or `null` when it names no row of it. */
  private _indexUnder(name: string): number | null {
    const prefix = `${this._deps.path}.`;
    if (!name.startsWith(prefix)) return null;
    const segment = name.slice(prefix.length).split(".")[0] ?? "";
    const index = Number(segment);
    return Number.isInteger(index) && index >= 0 && String(index) === segment ? index : null;
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

    // Register new rows that appeared (e.g., from draft restore or undo of a delete). The count is
    // raised first for the same reason as in `_rebuild`: the gate reads it.
    for (const idx of present) if (idx > maxIndex) maxIndex = idx;
    if (maxIndex + 1 > count) this._rowCountSig.set(maxIndex + 1);
    for (const idx of present) {
      if (idx >= count) {
        const value = this._readNode(`${this._deps.path}.${idx}`, this._deps.item);
        this._registerNode(`${this._deps.path}.${idx}`, this._deps.item, value, `${this._deps.path}.${idx}`, this._deps.sections ?? []);
      }
    }

    // Clean up rows that disappeared (e.g., undo of a push leaves a stale field)
    let removedAny = false;
    for (const idx of this._lastPresentIndices) {
      if (!present.has(idx)) {
        this._removeRow(idx);
        removedAny = true;
      }
    }

    const grown = maxIndex + 1;
    if (grown > count) this._rowCountSig.set(grown);
    if (removedAny) {
      this._rowCountSig.set(Math.max(grown, 0));
      this._deps.engine.refreshPathGate(this._deps.path);
    }

    // Update tracking for next reconciliation
    this._lastPresentIndices = new Set(present);
  }
}
