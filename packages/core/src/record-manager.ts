/**
 * Owns one record node: a collection whose keys are data.
 *
 * Where a positional collection makes structure follow the value, here structure follows a
 * **declaration**. `upsert` brings a row into being and `remove` ends it; mounting a control does
 * neither. That single rule is what lets a table render column by column — the controls of one row
 * are mounted apart and at different times, and they come and go for reasons that have nothing to do
 * with the data: a row leaves edit mode, a sort re-renders, a filter hides it.
 *
 * Three consequences worth stating, because they are what the rule buys:
 *
 * - **Validity belongs to the declared row.** Validators are registered when the row is declared, so
 *   a form holding an invalid row stays invalid however few of its controls are on screen.
 * - **A control that mounts on an undeclared key claims nothing.** Its claim waits, it renders empty,
 *   and it binds when the key arrives — it never brings the row into being on its own.
 * - **Removing a row takes its value.** Claims still held by mounted controls go back to waiting.
 *
 * The engine enforces the first two through the gate this manager registers; see
 * `MdyFormEngine.registerPathGate`.
 */
import { MDY_DEV } from "./dev-flags.js";
import type { MdyCollectionHost } from "./contracts/collection-host.js";
import { isSafeFieldPath } from "./path-utils.js";
import {
  reactivityBatches,
  MdyReactivity,
  MdySignal,
  MdyWritableSignal,
} from "./reactivity-contract.js";
import type {
  MdyAnyGroupDescriptor,
  MdyAnyRecordDescriptor,
  MdyAnyRowDescriptor,
} from "./contracts/descriptors.js";
import { isRecord } from "./record-utils.js";
import type {
  MdyCollectionDeps,
  MdyCollectionKind,
  MdyNestedCollection,
} from "./contracts/collection-manager.js";
import { registerRowNode, type MdyRowRegistration } from "./collections/register.js";

/**
 * A row's own schema node.
 *
 * A row is a field, a group, or a collection of either kind: what a row may hold is what a form may
 * hold, at any depth.
 */
type MdyRowNode = MdyAnyRowDescriptor;

/**
 * Refuses a shape the runtime cannot execute, when the form is built rather than when a row arrives.
 *
 * There is no depth to refuse and no combination of collections to refuse: a row may hold fields,
 * groups and collections of either kind, and a collection inside a row is addressed by the pattern
 * its declaration has — `orders.*.lines`, `items.*` — which is what makes a second positional level
 * as addressable as the first. What is still walked is the *kind* of every node, so a shape that is
 * not a form at all fails at construction rather than at the first row.
 */
function assertRowShape(node: MdyRowNode | { readonly kind: "array" | "record" }): void {
  if (node.kind === "array" || node.kind === "record") {
    assertRowShape((node as MdyAnyRecordDescriptor).item as MdyRowNode);
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

/** Names a rejected argument in a diagnostic without printing a whole payload. */
function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return `a ${typeof value}`;
}


export interface MdyRecordManagerDeps {
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
  /** Dotted record path, e.g. "rows" or "order.rows". */
  readonly path: string;
  readonly item: MdyRowNode;
  /** The host's development channel, so `devWarnings: false` silences these too. */
  readonly warn: (message: string) => void;
  /**
   * True when a positional collection encloses this one.
   *
   * A path may cross **one** positional level. Two of them make a descendant's path move for two
   * independent reasons — an insert above and an insert beside — and nothing in the contract can
   * say which one moved it, so a row under an array may hold a record and that record may not hold
   * an array.
   */
  readonly positionalAncestor?: boolean;
  /** How to build a collection declared inside one of this collection's rows. */
  readonly createCollection: MdyCollectionDeps["createCollection"];
}

export class MdyRecordManager implements MdyNestedCollection {
  readonly collectionKind: MdyCollectionKind = "record";
  private readonly _deps: MdyRecordManagerDeps;
  private readonly _initial: Readonly<Record<string, unknown>>;
  private readonly _keysSig: MdyWritableSignal<readonly string[]>;
  /**
   * The same key set the signal carries, kept as a plain set because the gate is consulted from
   * inside the engine's write paths, where reading a signal would tie an unrelated computation to
   * the shape of this collection.
   */
  private readonly _declared = new Set<string>();
  private readonly _releaseGate: () => void;
  /**
   * One manager per collection declared inside a row, keyed by its full path.
   *
   * They belong to the row, not to the form: the row declared them and they go when it goes. A
   * form-level registry would have to work that ownership back out of a path, which is the thing
   * ADR 0040 says not to do.
   */
  private readonly _nested = new Map<string, MdyNestedCollection>();

  /** The declared keys, in declaration order. */
  readonly keys: MdySignal<readonly string[]>;

  constructor(deps: MdyRecordManagerDeps, initial: Readonly<Record<string, unknown>>) {
    assertRowShape(deps.item);
    this._deps = deps;
    this._initial = initial;
    this._keysSig = deps.rx.signal<readonly string[]>([]);
    this.keys = this._keysSig.asReadonly();

    this._releaseGate = deps.engine.registerPathGate(deps.path, {
      isOpen: (name) => {
        if (name === deps.path) return true;
        return this._declared.has(this._keyOf(name));
      },
      // A value written straight into the engine — a draft coming back, an undo that crosses the
      // moment a row was added — is this collection's own data returning. Declaring the row here is
      // what keeps a restore from quietly losing it; a control mounting still declares nothing.
      onRefusedWrite: (name) => {
        const key = this._keyOf(name);
        if (key.length > 0) this.upsert(key);
      },
      // A whole-value write says which rows there are, so one it does not mention is one the user
      // removed before it was written — restoring it would undo their deletion.
      onReplace: (paths) => {
        const present = new Set<string>();
        for (const path of paths) {
          const key = this._keyOf(path);
          if (key.length > 0) present.add(key);
        }
        for (const key of [...this._declared]) {
          if (!present.has(key)) this.remove(key);
        }
      },
    });

    // A phantom field at the record's own path, so record-level validator errors reach
    // `engine.errorsFor()` — the same reason the array manager registers one.
    deps.engine.getField(deps.path);

    this.setAll(initial);
  }

  /**
   * The set is what answers; the signal is what makes the answer live.
   *
   * `_declared` is deliberately a plain set — the gate reads it from the engine's write paths, where
   * touching a signal would tie an unrelated computation to this collection's shape. That is right
   * for the gate and wrong for a caller: every other member of the handle re-evaluates when its
   * answer changes, and one that did not would be read once in a template and never again.
   */
  has(key: string): boolean {
    this._keysSig();
    return this._declared.has(key);
  }

  /** Declares the row, or rewrites the value of one already declared. */
  upsert(key: string, value?: unknown): void {
    if (!this._acceptKey(key)) return;
    // A row that does not exist yet has nothing to read back: every cell of it reads as `null`, and
    // handing those down would declare a row of nulls where the template says what a row starts as.
    // Left undefined, each cell takes the initial its descriptor declares.
    const rowValue = value !== undefined
      ? value
      : this._declared.has(key) ? this._readRow(key) : undefined;
    const isNew = !this._declared.has(key);
    if (isNew) {
      this._declared.add(key);
      this._keysSig.update((keys) => [...keys, key]);
    }
    try {
      // One row, one change. A row's cells are registered one at a time, and a runtime whose
      // computations run eagerly would otherwise re-read the form between two of them — seeing a row
      // that has some of its cells, which is a shape the schema does not describe and a read that
      // raises. Batching is asked for rather than assumed: a runtime without it runs as before.
      this._batched(() => {
        this._registerNode(`${this._deps.path}.${key}`, this._deps.item, rowValue, `${this._deps.path}.${key}`, this._deps.sections ?? []);
      });
    } catch (error) {
      // Reading the value can raise — a getter over a store that is not loaded, a proxy that
      // refuses — and the caller catching that would reasonably assume the row was not declared.
      // The key goes back, so `keys()` and `getValue()` cannot disagree about a row that half
      // arrived. A key that was already there keeps the row it had, which is what a rewrite that
      // never reached a write leaves behind anyway.
      if (isNew) this.remove(key);
      throw error;
    }
    // Admits the waiting claims of controls that mounted before this row was declared — after the
    // row has registered its own fields, so that the row's shape is the template's and not the
    // order in which controls happened to arrive. A value whose keys follow the rendering is a
    // value the rendering can be read out of.
    if (isNew) this._deps.engine.refreshPathGate(this._deps.path);
  }

  /**
   * Ends the row. Its value goes with it, and controls still mounted on it go back to waiting —
   * deletion is the owner's word, and a mounted control neither prevents it nor survives it.
   */
  /**
   * A collection inside a row: declared when the row is, destroyed with it.
   *
   * Re-declaring replaces what is there. A row rewritten by `upsert` runs the whole visit again,
   * and two managers over one path would both answer the gate for it.
   */
  private _declareNested(path: string, node: MdyAnyRecordDescriptor, value: unknown): void {
    // The subtree being replaced ends with the declaration that held it: its manager goes, and so do
    // the fields it registered. Left behind, they are read back as rows by the reconciliation and the
    // old list reappears under the new one.
    const replaced = this._nested.get(path);
    if (replaced) {
      const leaves = replaced.leafPathsNow();
      replaced.destroy();
      for (const leaf of leaves) this._deps.engine.endField(leaf);
    }
    const kind = (node as { kind: MdyCollectionKind }).kind;
    this._nested.set(path, this._deps.createCollection(
      kind,
      {
        rx: this._deps.rx,
        engine: this._deps.engine,
        path,
        item: node.item as MdyRowNode,
        warn: this._deps.warn,
        // Everything the row answers to, and the row itself: a collection inside a row that is no
        // longer declared is out of play with it.
        sections: [
          ...(this._deps.sections ?? []),
          () => this._declared.has(this._keyOf(path)),
        ],
        positionalAncestor: this._deps.positionalAncestor ?? false,
        createCollection: this._deps.createCollection,
      },
      value,
    ));
  }

  /** Every leaf path of every declared row — what an enclosing collection treats as its fields. */
  leafPathsNow(): string[] {
    return this.keysNow().flatMap((key) =>
      this._leafPaths(`${this._deps.path}.${key}`, this._deps.item));
  }

  /** The manager for a collection declared inside one of these rows, wherever it sits below. */
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

  remove(key: string): void {
    if (!this._declared.delete(key)) return;
    // One change, like the declaration is: a row ends cell by cell, and a runtime whose computations
    // run eagerly reads the form between two of them — finding a row holding some of its cells,
    // which is a shape the schema does not describe and a read that raises.
    this._batched(() => {
      this._destroyNestedUnder(`${this._deps.path}.${key}`);
      this._keysSig.update((keys) => keys.filter((k) => k !== key));
      this._deps.engine.refreshPathGate(this._deps.path);
    });
  }

  /**
   * Declares exactly these keys, removing every other.
   *
   * Handed something that is not an object — the `undefined` a response can carry — it declares
   * nothing and says so. Emptying the collection stays possible and stays deliberate: `setAll({})`.
   */
  setAll(values: Readonly<Record<string, unknown>>): void {
    if (!isRecord(values) || Array.isArray(values)) {
      this._warn(
        `setAll on "${this._deps.path}" ignored ${describe(values)}: it takes an object keyed by row ` +
        "key. Pass {} to empty the collection.",
      );
      return;
    }
    const wanted = values;
    for (const key of [...this._declared]) {
      if (!(key in wanted)) this.remove(key);
    }
    for (const [key, value] of Object.entries(wanted)) {
      this.upsert(key, value);
    }
  }

  /**
   * Writes several rows in one call. A key that is not declared yet is declared here: a patch on a
   * record comes from whoever owns the keys, which is the one party allowed to say a row exists.
   */
  patch(values: Readonly<Record<string, unknown>>): void {
    if (!isRecord(values) || Array.isArray(values)) {
      this._warn(
        `patch on "${this._deps.path}" ignored ${describe(values)}: it takes an object keyed by row ` +
        "key — { key: { field: value } }.",
      );
      return;
    }
    for (const [key, value] of Object.entries(values)) {
      if (this._deps.item.kind === "group" && !isRecord(value)) {
        this._warn(
          `patch on "${this._deps.path}.${key}" ignored ${describe(value)}: this row is a group, so ` +
          "a patch names its fields — { field: value }.",
        );
        continue;
      }
      if (!this._declared.has(key)) {
        this.upsert(key, value);
        continue;
      }
      this._writeInto(`${this._deps.path}.${key}`, this._deps.item, value);
    }
  }

  /**
   * Moves a row to a new key, carrying value, validity and `touched`.
   *
   * `remove` followed by `upsert` reaches the same value; what only this can keep is the state the
   * user produced — a field they visited stays visited. Renaming onto an existing key is refused,
   * because the row that key already names would be silently replaced.
   */
  rename(from: string, to: string): void {
    if (!this._declared.has(from)) {
      this._warn(`rename on "${this._deps.path}" ignored: there is no row "${from}" to move.`);
      return;
    }
    if (this._declared.has(to)) {
      this._warn(
        `rename on "${this._deps.path}" ignored: "${to}" already names a row, and moving onto it ` +
        `would replace it. Remove "${to}" first if that is what you mean.`,
      );
      return;
    }
    if (!this._acceptKey(to)) return;
    const value = this._readRow(from);
    const flags = this._readFlags(from);
    // The row's leaves, before and after: what a binder said about a cell moves with the row, like
    // its value and its marks. Read before the removal, because removing the row releases them.
    const leaves = this._leafPaths(`${this._deps.path}.${from}`, this._deps.item)
      .map((path) => path.slice(`${this._deps.path}.${from}`.length));
    // Moved before the removal: ending the row releases what a binder said about its cells, and the
    // row is not ending — it is arriving under another key.
    this._deps.engine.carryBindings(
      leaves.map((suffix) => [`${this._deps.path}.${from}${suffix}`, `${this._deps.path}.${to}${suffix}`] as const),
    );
    // The row leaves one key and arrives at another as one change: between the two it exists under
    // neither, and an eager runtime reading there sees a form the schema cannot describe.
    this._batched(() => {
      this.remove(from);
      this.upsert(to, value);
      this._writeFlags(to, flags);
    });
  }

  /** Runs `write` as one change where the runtime can, and plainly where it cannot. */
  private _batched(write: () => void): void {
    const rx = this._deps.rx;
    if (reactivityBatches(rx)) rx.batch(write);
    else write();
  }

  /** Every declared row's value, read back from the engine. */
  getValues(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of this._declared) out[key] = this._readRow(key);
    return out;
  }

  /** True when every field of the row passes — a row nobody mounted answers as truly as one on screen. */
  validOf(key: string): boolean {
    // Read before the early return: an undeclared key reads no field signal, so without this the
    // answer would be computed once, when it was false, and stay false after the row arrived.
    this._keysSig();
    if (!this._declared.has(key)) return false;
    return this._leafPaths(`${this._deps.path}.${key}`, this._deps.item).every((path) => {
      const ref = this._deps.engine.peekField(path);
      return ref ? ref().valid() : true;
    });
  }

  /** Declares the keys the schema started with. */
  resetToInitial(): void {
    this.setAll(this._initial);
  }

  /** Releases the gate — call when the owning form is destroyed. */
  destroy(): void {
    for (const manager of this._nested.values()) manager.destroy();
    this._nested.clear();
    this._releaseGate();
  }

  /**
   * The leaves a row offers, relative to the row: `["name", "inner.deep"]`, or `[""]` when the rows
   * are leaves themselves. What `cell()` is allowed to address, and what a diagnostic can suggest.
   */
  rowLeaves(): readonly string[] {
    const prefix = `${this._deps.path}.`;
    return this._leafPaths(this._deps.path, this._deps.item).map((leaf) =>
      leaf.startsWith(prefix) ? leaf.slice(prefix.length) : "",
    );
  }

  /** True when `path` (relative to a row, `undefined` for a leaf row) addresses one of them. */
  addresses(path: string | undefined): boolean {
    return this.rowLeaves().includes(path ?? "");
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private _warn(message: string): void {
    if (MDY_DEV) this._deps.warn(message);
  }

  /** The row key a path below this collection belongs to. */
  private _keyOf(path: string): string {
    return path.slice(this._deps.path.length + 1).split(".")[0] ?? "";
  }

  /**
   * A key is a path segment, so it may not carry the separator, and it inherits the path grammar
   * that keeps `__proto__` and friends out. A rejected key is reported and dropped rather than
   * thrown, because keys arrive from outside — a server row should not take the form down.
   */
  private _acceptKey(key: string): boolean {
    if (key.length > 0 && !key.includes(".") && isSafeFieldPath(`${this._deps.path}.${key}`)) {
      return true;
    }
    this._warn(
      `Ignored record key ${JSON.stringify(key)} on "${this._deps.path}": a key must be non-empty, ` +
      "must not contain \".\", and must not be a prototype-polluting name.",
    );
    return false;
  }

  /** The row a path belongs to, as the value an enclosing condition reads. */
  private _rowValue(rowPath: string): Record<string, unknown> {
    const row = this._readNode(rowPath, this._deps.item);
    return isRecord(row) ? row : {};
  }

  private _registerNode(
    fullPath: string,
    rowNode: MdyRowNode,
    value: unknown,
    rowPath: string,
    sections: ReadonlyArray<() => boolean> = [],
  ): void {
    registerRowNode(this._registration, fullPath, rowNode, value, rowPath, sections);
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
        this._declareNested(path, node as MdyAnyRecordDescriptor, value);
      },
    };
  }

  /** Writes a partial row without re-registering it — the row keeps its validators and its flags. */
  private _writeInto(fullPath: string, rowNode: MdyRowNode, value: unknown): void {
    if (rowNode.kind === "field") {
      const ref = this._deps.engine.peekField(fullPath);
      if (ref) ref().value.set(value);
      return;
    }
    // A collection is written whole, by its own manager, rather than walked into here.
    if (rowNode.kind === "record" || rowNode.kind === "array") {
      this._nested.get(fullPath)?.setAllFrom(value);
      return;
    }
    if (!isRecord(value)) return;
    for (const [key, child] of Object.entries((rowNode as MdyAnyGroupDescriptor).children)) {
      if (!(key in value)) continue;
      const at = `${fullPath}.${key}`;
      if ((child as MdyAnyRowDescriptor).kind === "record" || (child as MdyAnyRowDescriptor).kind === "array") {
        // `setAll`, because a whole-row write says what the row is: a nested collection the write
        // does not mention is emptied, not left behind.
        this._nested.get(at)?.setAllFrom(value[key]);
        continue;
      }
      this._writeInto(at, child as MdyRowNode, value[key]);
    }
  }

  private _leafPaths(fullPath: string, rowNode: MdyRowNode | { readonly kind: "array" | "record" }): string[] {
    if (rowNode.kind === "record" || rowNode.kind === "array") {
      return this._nested.get(fullPath)?.leafPathsNow() ?? [];
    }
    if (rowNode.kind === "field") return [fullPath];
    const group = rowNode as MdyAnyGroupDescriptor;
    return Object.entries(group.children).flatMap(([key, child]) =>
      this._leafPaths(`${fullPath}.${key}`, child as MdyRowNode));
  }

  /**
   * Replaces the rows wholesale, from whatever the enclosing write carried.
   *
   * A value that is not a record says nothing about keys, so it changes nothing: a whole-row write
   * that names this collection with the wrong shape is a defect upstream, not an instruction to
   * empty it.
   */
  setAllFrom(value: unknown): void {
    if (isRecord(value)) this.setAll(value);
  }

  /** The declared keys as a plain array, for a sibling manager reading through this one. */
  keysNow(): readonly string[] {
    return [...this._declared];
  }

  private _readRow(key: string): unknown {
    return this._readNode(`${this._deps.path}.${key}`, this._deps.item);
  }

  private _readNode(fullPath: string, rowNode: MdyRowNode | { readonly kind: "array" | "record" }): unknown {
    if (rowNode.kind === "record" || rowNode.kind === "array") {
      // Through the manager that owns it: the rows are its answer, not something derivable from
      // the declaration, which names no keys.
      const nested = this._nested.get(fullPath);
      if (nested) return nested.getValues();
      return rowNode.kind === "array" ? [] : {};
    }
    if (rowNode.kind === "field") {
      const ref = this._deps.engine.peekField(fullPath);
      return ref ? ref().value() : null;
    }
    const out: Record<string, unknown> = {};
    const group = rowNode as MdyAnyGroupDescriptor;
    for (const [key, child] of Object.entries(group.children)) {
      out[key] = this._readNode(`${fullPath}.${key}`, child as MdyRowNode);
    }
    return out;
  }

  private _readFlags(key: string): Map<string, { touched: boolean; dirty: boolean }> {
    const prefix = `${this._deps.path}.${key}`;
    const out = new Map<string, { touched: boolean; dirty: boolean }>();
    for (const path of this._leafPaths(prefix, this._deps.item)) {
      const ref = this._deps.engine.peekField(path);
      if (!ref) continue;
      const state = ref();
      out.set(path.slice(prefix.length), { touched: state.touched(), dirty: state.dirty() });
    }
    return out;
  }

  private _writeFlags(
    key: string,
    flags: ReadonlyMap<string, { touched: boolean; dirty: boolean }>,
  ): void {
    const prefix = `${this._deps.path}.${key}`;
    for (const [suffix, flag] of flags) {
      const ref = this._deps.engine.peekField(`${prefix}${suffix}`);
      if (!ref) continue;
      const state = ref();
      state.touched.set(flag.touched);
      state.dirty.set(flag.dirty);
    }
  }
}
