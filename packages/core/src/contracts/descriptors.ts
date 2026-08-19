/**
 * What a schema is made of, and what a form built from one holds.
 *
 * Declaration only, and a leaf by design: the traversal that reads a schema and the form that owns
 * one both need these, and either owning them makes the other import it back.
 */

import type {
  MdyAsyncValidatorFn,
  ValidatorFn,
} from "../types.js";
import type { MdySanitizer } from "../security.js";
import type { MdyValueShape } from "../value-contracts.js";

/** Leaf descriptor produced by {@link field}. */
export interface MdyFieldDescriptor<TValue> {
  readonly kind: "field";
  readonly initial: TValue;
  readonly validators: ReadonlyArray<ValidatorFn<TValue>>;
  readonly asyncValidators: ReadonlyArray<MdyAsyncValidatorFn<TValue>>;
  readonly asyncDebounceMs: number;
  readonly asyncDependsOn: ReadonlyArray<string>;
  readonly asyncTimeoutMs: number;
  readonly asyncWhen: ((value: unknown, formValue: Record<string, unknown>) => boolean) | null;
  /** Whether the field is in play; null → always. See {@link MdyFieldOptions.when}. */
  readonly when: ((value: unknown, formValue: Record<string, unknown>) => boolean) | null;
  /** Per-field sanitizer override; null → the form-level policy applies. */
  readonly sanitize: MdySanitizer | null;
  /** Whether the value is a secret. See {@link MdyFieldOptions.sensitive}. */
  readonly sensitive: boolean;
  /** The runtime shape this field's kind declares, or null when nothing declared one. */
  readonly shape: MdyValueShape | null;
  /** The values this field offers, when its kind chooses from a list; null when it does not. */
  readonly options: readonly unknown[] | null;
}

/** Group descriptor produced by {@link group}. */
export interface MdyGroupDescriptor<TChildren extends MdyFormSchema> {
  readonly kind: "group";
  readonly children: TChildren;
  /** Whether the whole section is in play; null → always. See {@link MdyGroupOptions.when}. */
  readonly when: ((value: unknown, enclosing: Record<string, unknown>) => boolean) | null;
}

/**
 * Widest field shape, used as the schema constraint. Validators are typed
 * contravariantly (`never`) so any `MdyFieldDescriptor<T>` is assignable.
 */
export interface MdyAnyFieldDescriptor {
  readonly kind: "field";
  readonly initial: unknown;
  readonly validators: ReadonlyArray<ValidatorFn<never>>;
  readonly asyncValidators: ReadonlyArray<MdyAsyncValidatorFn<never>>;
  readonly asyncDebounceMs: number;
  readonly asyncDependsOn: ReadonlyArray<string>;
  readonly asyncTimeoutMs: number;
  readonly asyncWhen: ((value: unknown, formValue: Record<string, unknown>) => boolean) | null;
  readonly when: ((value: unknown, formValue: Record<string, unknown>) => boolean) | null;
  readonly sanitize: MdySanitizer | null;
  readonly sensitive: boolean;
  readonly shape: MdyValueShape | null;
  readonly options: readonly unknown[] | null;
}

export interface MdyAnyGroupDescriptor {
  readonly kind: "group";
  readonly children: MdyFormSchema;
  readonly when: ((value: unknown, enclosing: Record<string, unknown>) => boolean) | null;
}

/** Array descriptor produced by {@link array}. Rows follow the value — see array-manager.ts. */
export interface MdyArrayDescriptor<TItem> {
  readonly kind: "array";
  /**
   * Row schema: a field (rows are leaves), a group (rows are objects), or a collection of either
   * kind — a row may hold as many levels as the form needs.
   */
  readonly item: TItem;
  readonly initial: ReadonlyArray<unknown>;
  readonly validators: ReadonlyArray<ValidatorFn<readonly unknown[]>>;
}

/**
 * What a row of a collection may be, whatever kind declared it.
 *
 * Named rather than spelled out at each site because it is recursive: a row holds fields, groups and
 * collections, and a collection's row holds the same again, for as many levels as a form needs.
 */
export type MdyAnyRowDescriptor =
  | MdyAnyFieldDescriptor
  | MdyAnyGroupDescriptor
  | MdyAnyArrayDescriptor
  | MdyAnyRecordDescriptor;

export interface MdyAnyArrayDescriptor {
  readonly kind: "array";
  readonly item: MdyAnyRowDescriptor;
  readonly initial: ReadonlyArray<unknown>;
  readonly validators: ReadonlyArray<ValidatorFn<never>>;
}

/**
 * Record descriptor produced by {@link record}: a collection whose keys are data.
 *
 * Where an array is keyed by position, a record is keyed by a value the domain owns — an entity id,
 * a provisional key, a slug — so a key is stable under sorting, filtering and re-rendering, and a row
 * is not addressed by where it happens to sit.
 *
 * A row exists because it was declared (`upsert`), never because a control mounted. Controls claim
 * and release; the set of keys is the record's own. See record-manager.ts for what follows from that.
 */
export interface MdyRecordDescriptor<TItem> {
  readonly kind: "record";
  /**
   * Row schema: a field (rows are leaves), a group (rows are objects), or a collection of either
   * kind — a row may hold as many levels as the form needs.
   */
  readonly item: TItem;
  readonly initial: Readonly<Record<string, unknown>>;
  readonly validators: ReadonlyArray<ValidatorFn<Readonly<Record<string, unknown>>>>;
}

export interface MdyAnyRecordDescriptor {
  readonly kind: "record";
  readonly item: MdyAnyRowDescriptor;
  readonly initial: Readonly<Record<string, unknown>>;
  readonly validators: ReadonlyArray<ValidatorFn<never>>;
}

/** A form schema: field descriptors and (arbitrarily nested) groups, arrays or records. */
export type MdyFormSchema = Readonly<
  Record<
    string,
    | MdyAnyFieldDescriptor
    | MdyAnyGroupDescriptor
    | MdyAnyArrayDescriptor
    | MdyAnyRecordDescriptor
  >
>;

// ─── Inferred model types ─────────────────────────────────────────────────────

/** The value an array item descriptor produces — a row of {@link MdyFormValue} or a leaf. */
export type MdyArrayItemValue<I> = I extends MdyGroupDescriptor<infer C>
  ? MdyFormValue<C>
  : I extends MdyFieldDescriptor<infer V>
  ? V
  : I extends MdyRecordDescriptor<infer R>
  ? Record<string, MdyArrayItemValue<R>>
  : I extends MdyArrayDescriptor<infer A>
  ? MdyArrayItemValue<A>[]
  : never;

/** The value type a schema produces — `form.getValue()` returns this. */
export type MdyFormValue<S extends MdyFormSchema> = {
  [K in keyof S]: S[K] extends MdyFieldDescriptor<infer V>
  ? V
  : S[K] extends MdyGroupDescriptor<infer C>
  ? MdyFormValue<C>
  : S[K] extends MdyArrayDescriptor<infer I>
  ? MdyArrayItemValue<I>[]
  : S[K] extends MdyRecordDescriptor<infer I>
  ? Record<string, MdyArrayItemValue<I>>
  : never;
};

/**
 * What a submit actually sends.
 *
 * Weaker than {@link MdyFormValue} because any field may be disabled at runtime and a disabled
 * field is not submitted. A total type would promise something no runtime check guarantees.
 *
 * The gap between the two types is the semantics: {@link MdyFormValue} is what the user is editing
 * and always complete; this is what leaves the process. A read-only field is present in both — it
 * holds a real answer the form asserts, the user simply may not change it.
 *
 * Optional at every level the schema declares, and no deeper. A leaf inside a group can be disabled
 * on its own, so groups recurse; an object-valued *leaf* must not, since making the halves of a
 * date range optional would describe a payload the form can never produce. Only the schema
 * distinguishes the two, which is why this is driven by `S` rather than by the value type.
 *
 * Arrays keep their element type: a row is submitted whole or not at all.
 */
export type MdySubmittedValue<S extends MdyFormSchema> = {
  readonly [K in keyof S]?: S[K] extends MdyFieldDescriptor<infer V>
  ? V
  : S[K] extends MdyGroupDescriptor<infer C>
  ? MdySubmittedValue<C>
  : S[K] extends MdyArrayDescriptor<infer I>
  ? ReadonlyArray<MdyArrayItemValue<I>>
  : S[K] extends MdyRecordDescriptor<infer I>
  ? Readonly<Record<string, MdyArrayItemValue<I>>>
  : never;
};

/** Deep partial of the schema value — accepted by `patch`. */
export type MdyFormPatch<S extends MdyFormSchema> = {
  readonly [K in keyof S]?: S[K] extends MdyFieldDescriptor<infer V>
  ? V
  : S[K] extends MdyGroupDescriptor<infer C>
  ? MdyFormPatch<C>
  : S[K] extends MdyArrayDescriptor<infer I>
  ? ReadonlyArray<MdyArrayItemValue<I>>
  : S[K] extends MdyRecordDescriptor<infer I>
  // A row as a patch names it: a keyed collection merges what a patch carries and leaves the cells
  // it does not name alone, so requiring the whole row here would make the documented call
  // impossible to write without a cast. A positional collection is not partial in the same way — a
  // whole-array write states which rows there are — so it keeps complete item values above.
  ? Readonly<Record<string, I extends MdyGroupDescriptor<infer C>
    ? MdyFormPatch<C>
    : MdyArrayItemValue<I>>>
  : never;
};

// ─── Field handles ────────────────────────────────────────────────────────────
