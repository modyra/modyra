/**
 * Owns one record node: a collection whose keys are data.
 *
 * Where {@link MdyArrayManager} makes structure follow the value, here structure follows a
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
import { MdyFormEngine } from "./form-engine.js";
import { isSafeFieldPath } from "./path-utils.js";
import {
  MdyReactivity,
  MdySignal,
  MdyWritableSignal,
} from "./reactivity.js";
import { hasRequiredMarker } from "./schema-utils.js";
import type {
  MdyAnyFieldDescriptor,
  MdyAnyGroupDescriptor,
} from "./typed-form.js";
import { isRecord } from "./record-utils.js";
import { composeConditions, type MdyCondition } from "./conditions.js";

/** A row's own schema node — a record's row is a field or a group, never another collection. */
type MdyRowNode = MdyAnyFieldDescriptor | MdyAnyGroupDescriptor;

function assertRowNode(
  node: MdyRowNode | { readonly kind: "array" | "record" },
): asserts node is MdyRowNode {
  if (node.kind === "array" || node.kind === "record") {
    throw new Error(
      `[modyra] A record's row cannot contain another ${node.kind} — one collection per node`,
    );
  }
}

/** Refuses a nested collection anywhere in the row, when the form is built rather than when a row arrives. */
function assertRowShape(node: MdyRowNode): void {
  assertRowNode(node);
  if (node.kind === "group") {
    for (const child of Object.values(node.children)) {
      assertRowShape(child as MdyRowNode);
    }
  }
}

/** Names a rejected argument in a diagnostic without printing a whole payload. */
function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return `a ${typeof value}`;
}

/** Owner key for validators this manager registers (schema namespace, as arrays use). */
const ROW_SCHEMA_KEY = "mdy-schema";

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
  readonly engine: MdyFormEngine;
  /** Dotted record path, e.g. "rows" or "order.rows". */
  readonly path: string;
  readonly item: MdyRowNode;
  /** The host's development channel, so `devWarnings: false` silences these too. */
  readonly warn: (message: string) => void;
}

export class MdyRecordManager {
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
    const rowValue = value === undefined ? this._readRow(key) : value;
    if (!this._declared.has(key)) {
      this._declared.add(key);
      this._keysSig.update((keys) => [...keys, key]);
      // Admits the waiting claims of controls that mounted before this row was declared.
      this._deps.engine.refreshPathGate(this._deps.path);
    }
    this._registerNode(`${this._deps.path}.${key}`, this._deps.item, rowValue, `${this._deps.path}.${key}`, this._deps.sections ?? []);
  }

  /**
   * Ends the row. Its value goes with it, and controls still mounted on it go back to waiting —
   * deletion is the owner's word, and a mounted control neither prevents it nor survives it.
   */
  remove(key: string): void {
    if (!this._declared.delete(key)) return;
    this._keysSig.update((keys) => keys.filter((k) => k !== key));
    this._deps.engine.refreshPathGate(this._deps.path);
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
    this.remove(from);
    this.upsert(to, value);
    this._writeFlags(to, flags);
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

  private _registerNode(fullPath: string, rowNode: MdyRowNode, value: unknown, rowPath: string, sections: ReadonlyArray<() => boolean> = []): void {
    const { engine } = this._deps;
    if (rowNode.kind === "field") {
      const v = value === undefined ? rowNode.initial : value;
      if (rowNode.sanitize !== null) {
        engine.setSanitizer(fullPath, rowNode.sanitize);
      }
      engine.setInitialValue(fullPath, v);
      engine.getField(fullPath);
      const marksRequired = rowNode.validators.some((fn) => hasRequiredMarker(fn));
      engine.upsertValidators(fullPath, ROW_SCHEMA_KEY, rowNode.validators, marksRequired);
      // Its own condition and every section of the row above it, composed once by
      // `conditions.ts` — the same sentence the schema registration uses.
      // Already bound to what they read — a section above this collection knows the form, not the
      // row — so they take no arguments and none are invented for them.
      const conditions: MdyCondition[] = sections.map((holds) => ({
        holds: () => holds(),
        read: () => ({ value: null, enclosing: {} }),
      }));
      if (rowNode.when !== null) {
        const when = rowNode.when;
        conditions.push({
          holds: when,
          read: () => {
            const row = this._readNode(rowPath, this._deps.item);
            return {
              value: engine.peekField(fullPath)?.().value(),
              enclosing: isRecord(row) ? row : {},
            };
          },
        });
      }
      if (conditions.length > 0) {
        engine.setInactive(fullPath, composeConditions(this._deps.rx, conditions));
      }
      if (rowNode.asyncValidators.length > 0) {
        engine.upsertAsyncValidators(fullPath, ROW_SCHEMA_KEY, rowNode.asyncValidators, {
          debounceMs: rowNode.asyncDebounceMs,
          dependsOn: rowNode.asyncDependsOn,
          timeoutMs: rowNode.asyncTimeoutMs,
          when: rowNode.asyncWhen ?? undefined,
        });
      }
      return;
    }
    const rec = isRecord(value) ? value : {};
    // A section inside a row: its children answer to it as well as to everything above it.
    const nested = rowNode.when !== null
      ? [
          ...sections,
          () =>
            rowNode.when!(
              this._readNode(fullPath, rowNode) as Record<string, unknown>,
              this._rowValue(rowPath),
            ),
        ]
      : sections;
    for (const [key, child] of Object.entries(rowNode.children)) {
      assertRowNode(child);
      this._registerNode(`${fullPath}.${key}`, child, rec[key], rowPath, nested);
    }
  }

  /** Writes a partial row without re-registering it — the row keeps its validators and its flags. */
  private _writeInto(fullPath: string, rowNode: MdyRowNode, value: unknown): void {
    if (rowNode.kind === "field") {
      const ref = this._deps.engine.peekField(fullPath);
      if (ref) ref().value.set(value);
      return;
    }
    if (!isRecord(value)) return;
    for (const [key, child] of Object.entries(rowNode.children)) {
      if (!(key in value)) continue;
      assertRowNode(child);
      this._writeInto(`${fullPath}.${key}`, child, value[key]);
    }
  }

  private _leafPaths(fullPath: string, rowNode: MdyRowNode): string[] {
    if (rowNode.kind === "field") return [fullPath];
    return Object.entries(rowNode.children).flatMap(([key, child]) => {
      assertRowNode(child);
      return this._leafPaths(`${fullPath}.${key}`, child);
    });
  }

  private _readRow(key: string): unknown {
    return this._readNode(`${this._deps.path}.${key}`, this._deps.item);
  }

  private _readNode(fullPath: string, rowNode: MdyRowNode): unknown {
    if (rowNode.kind === "field") {
      const ref = this._deps.engine.peekField(fullPath);
      return ref ? ref().value() : null;
    }
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(rowNode.children)) {
      assertRowNode(child);
      out[key] = this._readNode(`${fullPath}.${key}`, child);
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
