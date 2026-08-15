/**
 * What a caller holds onto: one field, one collection, and the tree shaped like the schema.
 *
 * A handle is the stable identity a control binds to. Its members are signals, so a host reads them
 * with whatever reactive primitives it has and nothing here names a framework.
 */

import type { MdySignal } from "../reactivity-contract.js";
import type { MdyFieldError, MdyInteractivity } from "../types.js";
import type { MdyFieldConstraints } from "../validator-facts.js";

import type {
  MdyArrayDescriptor,
  MdyArrayItemValue,
  MdyFieldDescriptor,
  MdyFormSchema,
  MdyGroupDescriptor,
  MdyRecordDescriptor,
} from "./descriptors.js";

/**
 * Typed handle for a single field, exposed on `form.f` — a typo on the
 * handle path is a compile error, unlike a stringly name.
 */
export interface MdyFieldHandle<TValue> {
  /** Flat engine path of the field (dot-separated for nested groups). */
  readonly path: string;
  readonly value: MdySignal<TValue>;
  readonly errors: MdySignal<ReadonlyArray<MdyFieldError>>;
  readonly touched: MdySignal<boolean>;
  readonly dirty: MdySignal<boolean>;
  readonly valid: MdySignal<boolean>;
  readonly pending: MdySignal<boolean>;
  readonly required: MdySignal<boolean>;
  /** What this field's rules state that an input can carry. See {@link MdyFieldConstraints}. */
  readonly constraints: MdySignal<MdyFieldConstraints>;
  /** What the user may do, as one value; `disabled` and `readonly` below are its derived halves. */
  readonly interactivity: MdySignal<MdyInteractivity>;
  readonly disabled: MdySignal<boolean>;
  /** Read but not written: the user may focus the control and copy from it, but not change it. */
  readonly readonly: MdySignal<boolean>;
  set(value: TValue): void;
  markAsTouched(): void;
  markAsDirty(): void;
  /**
   * What this control holds does not represent what the person entered, in words they can read —
   * or `null` once it does again.
   *
   * A picker given text it cannot read keeps the text on screen and holds `null`, and `null` is a
   * value no rule objects to: the page said the entry was wrong and the form said it was fine, so a
   * submit went out holding nothing where somebody had typed something. A verdict shown to a person
   * has to be one the form counts, and this is how a control says so.
   */
  reportEntry(problem: string | null): void;
}

/** Typed handle for a repeatable array item, exposed on `form.f` (`form.f.items`). */
export interface MdyArrayHandle<TItemHandle, TItemValue> {
  readonly path: string;
  readonly length: MdySignal<number>;
  readonly rows: MdySignal<ReadonlyArray<TItemHandle>>;
  readonly errors: MdySignal<ReadonlyArray<MdyFieldError>>;
  readonly valid: MdySignal<boolean>;
  push(value: TItemValue): void;
  insert(index: number, value: TItemValue): void;
  remove(index: number): void;
  move(from: number, to: number): void;
  setAll(values: ReadonlyArray<TItemValue>): void;
  at(index: number): TItemHandle | null;
}

/**
 * Typed handle for a keyed collection, exposed on `form.f` (`form.f.rows`).
 *
 * `cell` is what makes cell-by-cell mounting possible: a renderer asks for one control of one row
 * without knowing whether the row exists yet, and gets a handle that is inert until it does and stays
 * the same object across `upsert`/`remove`/`upsert`. A handle that changed identity would make a
 * binding re-bind and a control re-claim on every structural change.
 *
 * Every member reads live, including the two that return a plain value: `has` and `validOf` are
 * usable inside a computed and re-evaluate when their answer changes, like the signals beside them.
 */
export interface MdyRecordHandle<TItemHandle, TItemValue> {
  readonly path: string;
  /** The declared keys, in declaration order. Existence lives here, not in what is mounted. */
  readonly keys: MdySignal<ReadonlyArray<string>>;
  readonly value: MdySignal<Readonly<Record<string, TItemValue>>>;
  readonly errors: MdySignal<ReadonlyArray<MdyFieldError>>;
  readonly valid: MdySignal<boolean>;
  /** True while the key is declared. */
  has(key: string): boolean;
  /** The row's handle tree. Returned for undeclared keys too, inert until the row is declared. */
  row(key: string): TItemHandle;
  /**
   * One control of one row. `path` addresses a leaf inside the row and is omitted when rows are
   * leaves themselves. Stable per `key`/`path` pair.
   *
   * The value type is `unknown` unless stated, because the part is a string chosen at runtime — that
   * is the point of this call. Where the part is known at compile time, `row(key)` gives the typed
   * tree instead, and a binding that needs a typed handle should prefer it.
   */
  cell<TCell = unknown>(key: string, path?: string): MdyFieldHandle<TCell>;
  /** Declares the row, or rewrites the value of one already declared. */
  upsert(key: string, value?: TItemValue): void;
  remove(key: string): void;
  /** Declares exactly these keys, removing the rest. */
  setAll(values: Readonly<Record<string, TItemValue>>): void;
  /** Several rows in one write — one structural change, not one per row. */
  patch(values: Readonly<Record<string, unknown>>): void;
  /** Carries value, validity and touched to the new key. */
  rename(from: string, to: string): void;
  validOf(key: string): boolean;
}

/** The handle tree for a single array item — a field handle or nested group tree. */
export type MdyItemHandleTree<I> = I extends MdyGroupDescriptor<infer C>
  ? MdyFieldHandleTree<C>
  : I extends MdyFieldDescriptor<infer V>
  ? MdyFieldHandle<V>
  : I extends MdyRecordDescriptor<infer R>
  ? MdyRecordHandle<MdyItemHandleTree<R>, MdyArrayItemValue<R>>
  : I extends MdyArrayDescriptor<infer A>
  ? MdyArrayHandle<MdyItemHandleTree<A>, MdyArrayItemValue<A>>
  : never;

/** The typed handle tree mirroring the schema shape (`form.f.address.city`). */
export type MdyFieldHandleTree<S extends MdyFormSchema> = {
  readonly [K in keyof S]: S[K] extends MdyFieldDescriptor<infer V>
  ? MdyFieldHandle<V>
  : S[K] extends MdyGroupDescriptor<infer C>
  ? MdyFieldHandleTree<C>
  : S[K] extends MdyArrayDescriptor<infer I>
  ? MdyArrayHandle<MdyItemHandleTree<I>, MdyArrayItemValue<I>>
  : S[K] extends MdyRecordDescriptor<infer I>
  ? MdyRecordHandle<MdyItemHandleTree<I>, MdyArrayItemValue<I>>
  : never;
};

// ─── Factories ────────────────────────────────────────────────────────────────
