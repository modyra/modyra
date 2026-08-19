import { MDY_UNSUPPORTED_ADAPTER_OPTION, type MdyDiagnostics } from "./reactivity-diagnostics.js";
import type { MdyValueShape } from "./value-contracts.js";
import {
  MdyDraftOptions,
  MdyFormEngine,
  MdyFormRegistry,
} from "./form-engine.js";
import { MDY_DEV } from "./dev-flags.js";
import { MdyReactivity, MdySignal, vanillaReactivity } from "./reactivity.js";
import { registerHandleForm, registerHandleOwner } from "./reactive-owner.js";
import { NO_CONSTRAINTS } from "./validator-facts.js";
import { composeConditions, type MdyCondition } from "./conditions.js";
import { MdyArrayManager } from "./array-manager.js";
import { MdyRecordManager } from "./record-manager.js";
import { isRecord as isRecordValue } from "./record-utils.js";
import type {
  MdyCollectionFactory,
  MdyNestedCollection,
} from "./contracts/collection-manager.js";

/** The value at a dotted path inside a nested form value; `{}` where the path names no object. */
function valueAt(value: Record<string, unknown>, path: string): Record<string, unknown> {
  let current: unknown = value;
  for (const segment of path.split(".")) {
    if (typeof current !== "object" || current === null) return {};
    current = (current as Record<string, unknown>)[segment];
  }
  return isRecordValue(current) ? current : {};
}

/** Whether a whole value names a path at all — distinct from naming it and holding null. */
function namesPath(value: unknown, path: string): boolean {
  let current: unknown = value;
  for (const part of path.split(".")) {
    if (!isRecordValue(current) || !Object.hasOwn(current, part)) return false;
    current = current[part];
  }
  return true;
}

/** What a handle reports while it has no field: no rule, so no constraint to offer. */
import {
  collectSchemaPaths,
  flattenPatch,
  hasRequiredMarker,
  isFieldHandleTree,
  isSchemaPatch,
  isSchemaValue,
  numericKeysToArrays,
  pathGet,
  unflatten,
  walkSchema,
} from "./schema-utils.js";
import {
  MdyAsyncValidatorFn,
  MdyAsyncValidatorOptions,
  MdyFieldRef,
  MdyFieldState,
  MdyFormAdapter,
  MdyFormError,
  MdyFormState,
  MdyFormSubmitEvent,
  MdyFormValidatorFn,
  MdySubmitMode,
  ValidatorFn,
} from "./types.js";
import { MdySanitizer, MdySecurityPolicy } from "./security.js";

import type {
  MdyAnyArrayDescriptor,
  MdyAnyFieldDescriptor,
  MdyAnyGroupDescriptor,
  MdyAnyRecordDescriptor,
  MdyAnyRowDescriptor,
  MdyArrayDescriptor,
  MdyFieldDescriptor,
  MdyFormPatch,
  MdyFormSchema,
  MdyFormValue,
  MdyGroupDescriptor,
  MdyRecordDescriptor,
  MdySubmittedValue,
} from "./contracts/descriptors.js";
import type {
  MdyArrayHandle,
  MdyFieldHandle,
  MdyFieldHandleTree,
  MdyRecordHandle,
} from "./contracts/handles.js";

// The schema vocabulary and the handles are declared in `contracts/`, and published from here:
// splitting a file is not a reason for a consumer to learn a second import path.
export type {
  MdyAnyArrayDescriptor,
  MdyAnyFieldDescriptor,
  MdyAnyGroupDescriptor,
  MdyAnyRecordDescriptor,
  MdyAnyRowDescriptor,
  MdyArrayDescriptor,
  MdyArrayItemValue,
  MdyFieldDescriptor,
  MdyFormPatch,
  MdyFormSchema,
  MdyFormValue,
  MdyGroupDescriptor,
  MdyRecordDescriptor,
  MdySubmittedItemValue,
  MdySubmittedValue,
} from "./contracts/descriptors.js";
export type {
  MdyArrayHandle,
  MdyFieldHandle,
  MdyFieldHandleTree,
  MdyItemHandleTree,
  MdyRecordHandle,
} from "./contracts/handles.js";

// ─── Schema descriptors ───────────────────────────────────────────────────────

export interface MdyFieldOptions<TValue> {
  readonly asyncValidators?: ReadonlyArray<MdyAsyncValidatorFn<TValue>>;
  /**
   * Milliseconds to wait after the last change before running the async
   * validators (the field stays `pending` for the whole window).
   */
  readonly asyncDebounceMs?: number;
  /** Dotted paths whose changes re-run the async validators (cross-field server checks). */
  readonly asyncDependsOn?: ReadonlyArray<string>;
  /** After N ms the run fails with kind "async-timeout" and pending settles. */
  readonly asyncTimeoutMs?: number;
  /** Precondition evaluated before pending turns on; false → skip the server call. */
  readonly asyncWhen?: (value: TValue, formValue: Record<string, unknown>) => boolean;
  /**
   * Whether this field is in play at all.
   *
   * A schema is static and a form is not: a field belonging to a branch the user did not take is
   * declared like every other, and a `required()` on it makes the form permanently invalid — with
   * the offending field nowhere on screen to explain why. `when` is how the schema says the field
   * only counts under a condition.
   *
   * While it answers false the field is **inactive**, which is what a disabled field already
   * means here: not validated, not submitted, and its value kept — a branch the user leaves and
   * comes back to still holds what they typed. It is deliberately not a fourth state.
   *
   * The second argument is **what encloses the field**: the form's value, or the row's when the
   * field is inside a `record()` or an `array()` — a rule written once for the item of a collection
   * cannot name a key or an index, so what it reads is its own row.
   *
   * The predicate re-runs when what it reads changes, so it must be a pure function of the
   * arguments it is given.
   */
  readonly when?: (value: TValue, formValue: Record<string, unknown>) => boolean;
  /**
   * Per-field sanitizer override (see `MdySecurityPolicy.sanitize`). Use
   * `"off"` to exempt a field from the form-level policy (e.g. a code
   * editor), or a function for custom allow-listing (e.g. DOMPurify).
   */
  readonly sanitize?: MdySanitizer;
  /**
   * Whether this field holds a secret.
   *
   * It is a statement about the value, and every place that would otherwise copy it reads it: the
   * draft leaves it out of storage, and the devtools panel masks it without needing the name to
   * look like a password. A form-level `exclude` and the panel's own predicate still apply on top —
   * this is the field saying so once, where an author writes the field.
   */
  readonly sensitive?: boolean;
  /**
   * The runtime shape this field's value takes — `MDY_VALUE_CONTRACTS[kind].shape`.
   *
   * Declared so a value arriving from storage can be held to the kind's own shape. Without it the
   * only thing a form knows about a field seeded `null` is that it is `null`, and `null` is what the
   * contract declares for every kind that has no empty of its own — so the shape check that guards a
   * restored draft had nothing to check against and let any JSON through.
   */
  readonly shape?: MdyValueShape;
  /**
   * The values this field offers, for a kind that chooses from a list.
   *
   * `oneOf` refuses a value outside them when the field is *validated*; this is the same list said
   * where the form can read it, so a value arriving from storage is not written into the field first
   * and judged afterwards — a renderer draws what the form holds, not what the form approves.
   */
  readonly options?: readonly unknown[];
}

/**
 * Widens literal primitives so `field("")` infers `string`, not `""`.
 * Unions distribute (`number | null` stays `number | null`); intentional
 * literal-union fields should annotate the descriptor type explicitly.
 */
export type MdyWiden<T> = T extends string
  ? string
  : T extends number
  ? number
  : T extends boolean
  ? boolean
  : T;

/** Declares a typed leaf field of a {@link createForm} schema. */
export function field<TValue>(
  initial: MdyWiden<TValue>,
  validators: ReadonlyArray<ValidatorFn<MdyWiden<TValue>>> = [],
  options?: MdyFieldOptions<MdyWiden<TValue>>,
): MdyFieldDescriptor<MdyWiden<TValue>> {
  reportUnknownFieldOptions(options);
  return {
    kind: "field",
    initial,
    validators,
    asyncValidators: options?.asyncValidators ?? [],
    asyncDebounceMs: options?.asyncDebounceMs ?? 0,
    asyncDependsOn: options?.asyncDependsOn ?? [],
    asyncTimeoutMs: options?.asyncTimeoutMs ?? 0,
    asyncWhen: (options?.asyncWhen as MdyFieldDescriptor<MdyWiden<TValue>>["asyncWhen"]) ?? null,
    when: (options?.when as MdyFieldDescriptor<MdyWiden<TValue>>["when"]) ?? null,
    sanitize: assertSanitizer(options?.sanitize),
    sensitive: options?.sensitive === true,
    shape: options?.shape ?? null,
    options: options?.options ?? null,
  };
}

/**
 * The sanitizer profiles a field may name. The same closed set the form-level policy has, checked
 * here too: a repair that reached only the form leaves `field("", [], { sanitize: "stict" })`
 * falling back to the profile that does nothing, which is the defect one level down.
 */
const FIELD_SANITIZE_PROFILES: ReadonlySet<string> = new Set(["off", "text", "strict"]);

function assertSanitizer(sanitize: unknown): MdySanitizer | null {
  if (sanitize === undefined || sanitize === null) return null;
  if (typeof sanitize === "function") return sanitize as MdySanitizer;
  if (typeof sanitize === "string" && FIELD_SANITIZE_PROFILES.has(sanitize)) return sanitize as MdySanitizer;
  throw new Error(
    `[modyra] There is no sanitizer called ${JSON.stringify(sanitize)}. ` +
    `Name one of ${[...FIELD_SANITIZE_PROFILES].join(", ")}, or pass a function.`,
  );
}

/** Declares a nested group of fields (`address.city` paths on the engine). */
export interface MdyGroupOptions {
  /**
   * Whether this whole section is in play.
   *
   * The same question {@link MdyFieldOptions.when} answers for one field, asked once for a branch:
   * while it is false **every field under the group is inactive** — not validated, not submitted,
   * and its value kept. Without it a conditional section means repeating one predicate on every
   * leaf it contains, which is the work `when` exists to remove.
   *
   * A field's own `when` and the sections above it are **all** consulted: the field is in play only
   * while every one of them says so.
   *
   * The predicate receives the group's own value and the value that encloses it — the form, or the
   * row when the group is the item of a `record()` or an `array()`.
   */
  readonly when?: (value: Record<string, unknown>, enclosing: Record<string, unknown>) => boolean;
}

/**
 * A schema key that spells a path becomes the structure that path describes.
 *
 * A name is a path everywhere else in the framework: `claimField("shipping.city")` registers a
 * field inside `shipping`, and every value the engine holds is stored flat by path and read back
 * unflattened. A schema declaring the literal key `"shipping.city"` therefore describes a shape no
 * read can produce — one key at the root, against a two-level value — and the mismatch surfaces as
 * a throw from the first `getValue()`, far from the declaration that caused it.
 *
 * Rather than refuse the key, it is given the meaning it already has. This is what lets a flattened
 * document mount: the dynamic contract carries a nested form as a list of fields named by path, and
 * a consumer that builds a schema from those names gets the structure back.
 *
 * Only groups are rebuilt. Whether a segment was an array row or a record key is not recoverable
 * from a path — `lines.0` reads as the key `"0"` — so a collection flattened into paths comes back
 * as nested groups, and a form that must round-trip a list declares {@link array} itself.
 */
function nestDottedKeys<S extends MdyFormSchema>(schema: S): S {
  return nestLevel(schema, normalizedBelow(schema)) as S;
}

/**
 * Every node below `schema`, normalized, computed from the bottom up.
 *
 * A group's children and a collection's item are schemas of their own, and normalizing one by
 * calling back into this file's entry point makes the schema's depth the call stack's depth. A
 * schema built from a document has no declared limit, so the walk is explicit: nodes are collected
 * downwards, then rebuilt in reverse, by which point every child a node needs is already done.
 */
function normalizedBelow(schema: MdyFormSchema): Map<unknown, unknown> {
  const order: unknown[] = [];
  const pending: unknown[] = Object.values(schema);
  while (pending.length > 0) {
    const node = pending.pop();
    if (isGroupDescriptor(node)) {
      order.push(node);
      pending.push(...Object.values(node.children as MdyFormSchema));
    } else if (isCollectionDescriptor(node)) {
      order.push(node);
      pending.push(node.item);
    }
  }
  const normalized = new Map<unknown, unknown>();
  for (let index = order.length - 1; index >= 0; index -= 1) {
    const node = order[index];
    if (isGroupDescriptor(node)) {
      const children = nestLevel(node.children as MdyFormSchema, normalized);
      normalized.set(node, children === node.children ? node : { ...node, children });
      continue;
    }
    const collection = node as { readonly item: unknown };
    const item = normalized.get(collection.item) ?? collection.item;
    normalized.set(node, item === collection.item ? node : { ...(node as object), item });
  }
  return normalized;
}

/** One level of a schema, with dotted keys turned into the structure they describe. */
function nestLevel(schema: MdyFormSchema, normalized: Map<unknown, unknown>): MdyFormSchema {
  const nested: Record<string, unknown> = {};

  /** Puts a node at `segments` under `level`, building the groups the path passes through. */
  /**
   * The children of the group at `head`, as an object this normalization owns.
   *
   * The group may be the caller's — `shipping: group({ zip })` written in their module — and a path
   * passing through it must not add a child to the object they declared: a schema held in a constant
   * would gain members it never had, and building a second form from it would then find the name
   * already taken. Descending copies, so what is written into belongs to the form being built.
   */
  const openGroup = (level: Record<string, unknown>, head: string, held: MdyGroupDescriptor<MdyFormSchema>): Record<string, unknown> => {
    const children = { ...held.children } as Record<string, unknown>;
    level[head] = { ...held, children };
    return children;
  };

  const place = (level: Record<string, unknown>, segments: string[], key: string, node: unknown): void => {
    const [head, ...rest] = segments;
    if (rest.length === 0) {
      // Own properties only. The accumulator is a plain object, so a polluted `Object.prototype`
      // would otherwise answer for a name this schema never declared — and the failure it produced
      // named a defect in the caller's schema for a cause that is nowhere in it.
      const held = Object.hasOwn(level, head) ? level[head] : undefined;
      // Two groups meeting at the same name are one group: `shipping: group({ zip })` beside
      // `"shipping.city"` describes a single `shipping`, whichever was written first.
      if (isGroupDescriptor(held) && isGroupDescriptor(node)) {
        const children = openGroup(level, head, held);
        for (const [childKey, child] of Object.entries(node.children)) {
          place(children, childKey.split("."), childKey, child);
        }
        return;
      }
      if (held !== undefined) {
        throw new Error(
          `[modyra] Schema key "${key}" is declared twice, once as a field and once as a group.`,
        );
      }
      level[head] = node;
      return;
    }
    const held = Object.hasOwn(level, head) ? level[head] : undefined;
    if (held === undefined) {
      const children: Record<string, unknown> = {};
      level[head] = group(children as MdyFormSchema);
      place(children, rest, key, node);
      return;
    }
    if (!isGroupDescriptor(held)) {
      throw new Error(`[modyra] Schema key "${key}" needs "${head}" to be a group, and it is a field.`);
    }
    place(openGroup(level, head, held), rest, key, node);
  };

  // A schema with nothing to normalize is returned as it came: the common form is one without a
  // path in it, and a rebuilt copy would cost every consumer that compares descriptors by identity.
  let moved = false;
  for (const [key, node] of Object.entries(schema)) {
    // A collection's item and a group's children are schemas of their own, and a path spelled
    // inside one describes structure exactly as it does at the root.
    const replacement = normalized.get(node) ?? node;
    if (replacement !== node || key.includes(".")) moved = true;
    place(nested, key.split("."), key, replacement);
  }
  return moved ? nested as MdyFormSchema : schema;
}

/** A schema node whose shape repeats: an array's rows, a record's entries. */
function isCollectionDescriptor(node: unknown): node is { readonly kind: string; readonly item: unknown } {
  if (typeof node !== "object" || node === null) return false;
  const kind = (node as { kind?: unknown }).kind;
  return (kind === "array" || kind === "record") && "item" in node;
}

/** A schema node that holds children rather than a value. */
function isGroupDescriptor(node: unknown): node is MdyGroupDescriptor<MdyFormSchema> {
  return typeof node === "object" && node !== null && (node as { kind?: unknown }).kind === "group";
}

export function group<TChildren extends MdyFormSchema>(
  children: TChildren,
  options?: MdyGroupOptions,
): MdyGroupDescriptor<TChildren> {
  return {
    kind: "group",
    children,
    when: (options?.when as MdyGroupDescriptor<TChildren>["when"]) ?? null,
  };
}

/**
 * Declares a repeatable array of fields or groups (`items.0.name` paths on
 * the engine). Rows follow the value: structure is rebuilt whenever the
 * array changes shape (`push`/`insert`/`remove`/`move`/`setAll`, or a
 * `patch`/`setValue`/`reset` that touches this path) — touched/dirty/errors
 * of affected rows reset on structural changes (v1 semantics, see docs).
 */
export function array<TItem extends MdyAnyRowDescriptor>(
  item: TItem,
  options?: {
    readonly initial?: ReadonlyArray<unknown>;
    readonly validators?: ReadonlyArray<ValidatorFn<readonly unknown[]>>;
  },
): MdyArrayDescriptor<TItem> {
  return {
    kind: "array",
    item,
    initial: options?.initial ?? [],
    validators: options?.validators ?? [],
  };
}

/**
 * Declares a collection keyed by data (`rows.a3f9.name` paths on the engine).
 *
 * Unlike {@link array}, structure does **not** follow the value and does not follow what is mounted:
 * a row exists once `upsert` declares it and stops existing once `remove` does. A control that mounts
 * on an undeclared key claims nothing and renders empty until the key arrives, which is what lets a
 * table render column by column — the controls of one row are mounted apart, at different times.
 *
 * The consequence worth stating: validity belongs to the declared row. Sorting, filtering or
 * collapsing rows unmounts controls and changes nothing about whether the form is valid.
 */
export function record<TItem extends MdyAnyRowDescriptor>(
  item: TItem,
  options?: {
    readonly initial?: Readonly<Record<string, unknown>>;
    readonly validators?: ReadonlyArray<ValidatorFn<Readonly<Record<string, unknown>>>>;
  },
): MdyRecordDescriptor<TItem> {
  return {
    kind: "record",
    item,
    initial: options?.initial ?? {},
    validators: options?.validators ?? [],
  };
}

export interface MdyCoreFormOptions<
  TValue extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly submitMode?: MdySubmitMode;
  /**
   * Reactive implementation the form runs on. Defaults to the built-in
   * {@link vanillaReactivity} (Node/CLI/tests); framework adapters pass
   * their own so form state integrates with the host's change detection.
   */
  readonly reactivity?: MdyReactivity;
  /**
   * Form-level (cross-field) validators. Each receives the whole typed value
   * and returns errors attributed to field paths (dotted for nested groups)
   * or to the form itself (`path: null`). Build them with `crossField()`.
   */
  readonly validators?: ReadonlyArray<MdyFormValidatorFn<TValue>>;
  /**
   * Records value snapshots for `undo()`/`redo()`.
   * Pass `true` or `{ maxEntries, debounceMs }` (defaults: 100 entries,
   * no debounce).
   */
  readonly history?:
  | boolean
  | { readonly maxEntries?: number; readonly debounceMs?: number };
  /**
   * Autosaves the form value under `key` and restores an existing draft on
   * creation. Cleared automatically after an error-free submit. Use
   * `exclude` to keep sensitive fields out of storage, `ttlMs` for expiry
   * and `version` for schema migrations.
   */
  readonly draft?: string | MdyDraftOptions;
  /**
   * Injection-prevention policy for field values: sanitization profiles
   * (`"text"`/`"strict"` or a custom function), string length caps and a
   * violation telemetry hook. Opt-in in 0.x (`sanitize` defaults to
   * `"off"`); the structural checks (draft shape, server-error paths) are
   * always on. See docs/guides/security.md.
   */
  readonly security?: MdySecurityPolicy;
  /**
   * `false` defers draft/history/async-validator effects until
   * {@link MdyTypedFormBase.activate} is called — see
   * {@link import("./form-engine.js").MdyFormEngineOptions.autoActivate}.
   * Default `true`.
   */
  readonly autoActivate?: boolean;
  /**
   * Development diagnostics: the calls that could not do anything, and the choices a mechanism
   * cannot make for you. `false` silences them.
   *
   * They are the library's way of not being silent where it does the right thing invisibly, so the
   * switch is deliberately one switch: turning off part of it would leave a reader wondering which
   * part they had.
   */
  readonly devWarnings?: boolean;
  /**
   * Where the form reports what it could not do, as codes rather than console lines.
   *
   * `createConsoleDiagnostics()` and `createSilentDiagnostics()` build one, and the codes are
   * published beside them. A degradation — an async check a reactivity cannot run, a draft that
   * could not start — is otherwise invisible on every surface an application reads.
   */
  readonly diagnostics?: MdyDiagnostics;
}

/**
 * Creates a typed, reactive form model from a schema — the framework-free
 * heart of Modyra. Runs anywhere JavaScript runs:
 *
 * ```ts
 * const form = createForm({
 *   email: field("", [required(), email()]),
 *   address: group({ city: field("Rome") }),
 * });
 *
 * form.f.email.set("foo@bar.com");
 * form.f.email.errors();   // []
 * form.getValue().address.city; // "Rome" — typos do not compile
 * ```
 */
export function createForm<S extends MdyFormSchema>(
  schema: S,
  options?: MdyCoreFormOptions<MdyFormValue<S>>,
): MdyTypedForm<S> {
  // A schema names the fields a form has, so something with no names is not one. Left unchecked, a
  // string or an array reached `Object.entries` and threw a `TypeError` naming neither the argument
  // nor this call — and a number or a boolean built a form with no fields at all, which reported
  // itself valid and submittable. The second is the worse half: nothing to catch, nothing to read.
  assertFormSchema(schema, "createForm");
  reportUnknownOptions(options);
  return new MdyTypedForm(schema, options);
}

/** What a form may be given. Grows with the library, which is why an unknown key is said rather than refused. */
const FORM_OPTIONS: ReadonlySet<string> = new Set([
  "submitMode", "reactivity", "validators", "history", "draft", "security", "autoActivate", "devWarnings",
  "diagnostics",
]);

/**
 * An option nobody has is reported, because a misplaced one is indistinguishable from silence.
 *
 * `{ sanitize: "strict" }` at the top level is the case: the key belongs one level down, inside
 * `security`, and written here it does nothing — which looks exactly like not having asked. Said
 * rather than refused, because this bag grows with the library and a consumer passing an option a
 * newer version understands should not be stopped by an older one.
 */
function reportUnknownOptions(options: unknown): void {
  if (!MDY_DEV || typeof options !== "object" || options === null) return;
  const unknown = Object.keys(options).filter((key) => !FORM_OPTIONS.has(key));
  if (unknown.length === 0) return;
  const message =
    `createForm was given ${unknown.map((key) => `"${key}"`).join(", ")}, which it does not ` +
    `read. A form takes ${[...FORM_OPTIONS].join(", ")}${
      unknown.includes("sanitize") ? '; a sanitizer is asked for as security: { sanitize }' : ""
    }.`;
  // To the sink the caller gave, if they gave one. A consumer who asked for these as events asked
  // for *this* one too: an option a form does not read is the first thing a host wants routed, and
  // it was the one degradation that could only ever reach a console.
  const sink = (options as { diagnostics?: MdyDiagnostics }).diagnostics;
  if (sink && typeof sink.report === "function") {
    sink.report({ code: MDY_UNSUPPORTED_ADAPTER_OPTION, severity: "warning", message });
    return;
  }
  console.warn(`[modyra] ${message}`);
}

/** What a field may be given. Grows with the library, which is why an unknown key is said rather than refused. */
const FIELD_OPTIONS: ReadonlySet<string> = new Set([
  "asyncValidators", "asyncDebounceMs", "asyncDependsOn", "asyncTimeoutMs", "asyncWhen",
  "when", "sanitize", "sensitive", "shape", "options",
]);

/**
 * An option a field does not read is reported, the way `createForm` reports one it does not.
 *
 * The decision was already taken one level up and for this reason: a misplaced option is
 * indistinguishable from not having asked. Inside a single option the contrast is the finding —
 * `sanitize: "stict"` is refused by name at construction, while `sanitise: "strict"`, the British
 * spelling and the ordinary way to get it wrong, built a field that was never sanitized and said
 * nothing. `asyncDebounce` for `asyncDebounceMs` is the same shape at a different cost: every
 * keystroke reaches the server.
 *
 * Said rather than refused, because this bag grows and a consumer passing an option a newer version
 * understands must not be stopped by an older one.
 */
function reportUnknownFieldOptions(options: unknown): void {
  if (!MDY_DEV || typeof options !== "object" || options === null) return;
  const unknown = Object.keys(options).filter((key) => !FIELD_OPTIONS.has(key));
  if (unknown.length === 0) return;
  console.warn(
    `[modyra] field() was given ${unknown.map((key) => `"${key}"`).join(", ")}, which it does not ` +
    `read. A field takes ${[...FIELD_OPTIONS].join(", ")}.`,
  );
}

/** Refuses anything that cannot name fields, where a schema arrives. */
export function assertFormSchema(schema: unknown, method: string): asserts schema is MdyFormSchema {
  if (typeof schema === "object" && schema !== null && !Array.isArray(schema)) return;
  throw new Error(
    `[modyra] ${method} takes a schema naming the form's fields, received ${
      schema === null ? "null" : Array.isArray(schema) ? "an array" : `a ${typeof schema}`
    }. A schema is an object: { email: field(""), … }.`,
  );
}

// ─── Typed form ───────────────────────────────────────────────────────────────

/** Owner key for validators registered from the schema. */
export const SCHEMA_KEY = "mdy-schema";

/**
 * Options shared by every typed-form specialization (core and adapters).
 * Framework-specific constructors supply their own reactivity / submit-mode
 * handling, then forward the rest to {@link MdyTypedFormBase}.
 */
export interface MdyTypedFormBaseOptions<
  TValue extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly validators?: ReadonlyArray<MdyFormValidatorFn<TValue>>;
  readonly history?:
  | boolean
  | { readonly maxEntries?: number; readonly debounceMs?: number };
  readonly draft?: string | MdyDraftOptions;
  /** Injection-prevention policy — see {@link MdyCoreFormOptions.security}. */
  readonly security?: MdySecurityPolicy;
  /** See {@link MdyCoreFormOptions.autoActivate}. */
  readonly autoActivate?: boolean;
}

/**
 * Framework-agnostic typed form implementation.
 *
 * The base owns the schema registration, handle-tree building, nested value
 * mapping and the flat-path delegation surface. Subclasses only provide:
 * - the underlying {@link MdyFormEngine}, or a branded extension of it;
 * - a `_buildHandle` factory matching their signal type;
 * - the public `value` / `f` declarations with the correct signal/handle types.
 */
export abstract class MdyTypedFormBase<
  S extends MdyFormSchema,
  THandle,
  TBooleanSignal extends MdySignal<boolean> = MdySignal<boolean>,
> implements MdyFormAdapter<MdyFormValue<S>, MdySubmittedValue<S>>, MdyFormRegistry<TBooleanSignal> {
  protected readonly _schema: S;
  protected readonly _adapter: MdyFormEngine;
  /** Leaf paths in schema order. */
  protected readonly _leafPaths: readonly string[];
  /** The leaf patterns inside a row, which say whether a row is a value or a set of cells. */
  protected readonly _itemLeafPaths: ReadonlySet<string>;
  /** What the form held when it was destroyed — see {@link MdyTypedFormBase.getValue}. */
  private _valueAtDestroy: MdyFormValue<S> | null = null;
  /** What would have been sent at the moment the form ended; see {@link MdyTypedFormBase.getValue}. */
  private _submitValueAtDestroy: MdySubmittedValue<S> | null = null;
  /** What was made from this form and has to end with it — see {@link MdyTypedFormBase.onDestroy}. */
  private readonly _teardowns = new Set<() => void>();
  /** The same paths as a set, for the reads that ask about one path at a time. */
  protected readonly _leafPathSet: ReadonlySet<string>;
  /** Group prefixes — used to flatten nested patches. */
  protected readonly _groupPaths: ReadonlySet<string>;
  /** Array prefixes — used to flatten patches and unflatten values. */
  protected readonly _arrayPaths: ReadonlySet<string>;
  /** Record prefixes — like arrays for flattening, and never index-converted when unflattening. */
  protected readonly _recordPaths: ReadonlySet<string>;
  /** One {@link MdyArrayManager} per array node, keyed by dotted path. */
  protected readonly _arrays: ReadonlyMap<string, MdyArrayManager>;
  /** One {@link MdyRecordManager} per record node, keyed by dotted path. */
  protected readonly _records: ReadonlyMap<string, MdyRecordManager>;
  /**
   * Cell handles, kept so `cell(key, path)` answers with the same object every time.
   *
   * Held weakly: identity is a promise to whoever is *using* a handle — a control bound across
   * `upsert`/`remove`/`upsert` must not be re-bound — and a weak reference keeps exactly that while
   * letting go of handles for rows nobody is looking at. A table churning provisional keys would
   * otherwise accumulate one entry per key it ever showed.
   */
  private readonly _cellHandles = new Map<string, WeakRef<MdyFieldHandle<unknown>>>();
  /** Wrong cell parts already reported, so a template repeating a mistake reports it once. */
  private readonly _reportedCellParts = new Set<string>();
  private readonly _cellHandlesSweep = new FinalizationRegistry<string>((path) => {
    // Only when nothing has replaced it in the meantime.
    if (this._cellHandles.get(path)?.deref() === undefined) this._cellHandles.delete(path);
  });

  /**
   * Concrete handle tree type is declared by subclasses: this package uses
   * {@link MdyFieldHandleTree}, and an adapter substitutes its own signal type.
   */
  abstract readonly f: unknown;
  abstract readonly state: MdyFormState;
  abstract readonly value: MdySignal<MdyFormValue<S>>;

  constructor(
    schema: S,
    adapter: MdyFormEngine,
    options?: MdyTypedFormBaseOptions<MdyFormValue<S>>,
  ) {
    // Everything below reads the normalized schema: a key that spelled a path is now the structure
    // it described, and nothing downstream should see the two spellings of the same form.
    schema = nestDottedKeys(schema);
    this._schema = schema;
    this._adapter = adapter;

    const paths = collectSchemaPaths(schema);
    this._leafPaths = paths.leafPaths;
    this._itemLeafPaths = paths.itemLeafPaths;
    this._leafPathSet = new Set(paths.leafPaths);
    this._groupPaths = paths.groupPaths;
    this._arrayPaths = paths.arrayPaths;
    this._recordPaths = paths.recordPaths;

    const collections = this._buildCollections(schema, adapter);
    this._arrays = collections.arrays;
    this._records = collections.records;

    this._registerSchema(schema);
    const arrayValidators = this._buildArrayValidators(schema);

    // The form is built: what it holds now is what it started with, rows included.
    this._adapter.markBaseline();

    this._enableHistory(options?.history);
    this._enableDraft(options?.draft);
    this._installFormValidators(options?.validators ?? [], arrayValidators);
  }

  /**
   * One manager per array and record node, each told which sections it sits under.
   *
   * The walk fills the section conditions as it descends, so a collection built below a section
   * already knows about it — the ordering is the reason this is one pass and not two.
   */
  private _buildCollections(
    schema: S,
    adapter: MdyFormEngine,
  ): {
    readonly arrays: ReadonlyMap<string, MdyArrayManager>;
    readonly records: ReadonlyMap<string, MdyRecordManager>;
  } {
    const arrays = new Map<string, MdyArrayManager>();
    const records = new Map<string, MdyRecordManager>();
    /**
     * The condition of every section, by path — filled as the walk descends, which is why a
     * collection built below one already knows about it.
     */
    const schemaSections = new Map<
      string,
      (value: unknown, enclosing: Record<string, unknown>) => boolean
    >();
    /**
     * The sections a collection sits under, as predicates over the form.
     *
     * A collection inside a closed section is out of play like anything else under it — including
     * the rows already declared, which is the case that says whether this was really fixed or only
     * moved.
     */
    const enclosingSections = (at: string): ReadonlyArray<() => boolean> =>
      [...schemaSections]
        .filter(([sectionPath]) => at.startsWith(`${sectionPath}.`))
        .map(([sectionPath, holds]) => () => {
          const formValue = this.getValue() as Record<string, unknown>;
          return holds(valueAt(formValue, sectionPath), formValue);
        });

    /**
     * Which manager owns a collection, wherever it was declared.
     *
     * The two kinds are mutually recursive — a record's row may hold an array and an array's row a
     * record — and this is the one place that knows both, so neither has to name the other.
     */
    const createCollection: MdyCollectionFactory = (kind, deps, value) =>
      kind === "array"
        ? new MdyArrayManager(
            { ...deps, item: deps.item as MdyAnyGroupDescriptor | MdyAnyFieldDescriptor },
            Array.isArray(value) ? value : [],
          )
        : new MdyRecordManager(
            { ...deps, item: deps.item as MdyAnyGroupDescriptor | MdyAnyFieldDescriptor },
            isRecordValue(value) ? value : {},
          );

    walkSchema(
      schema,
      "",
      () => { /* fields registered below, by _registerSchema */ },
      (groupPath, groupNode) => {
        if (groupNode.when !== null) schemaSections.set(groupPath, groupNode.when);
      },
      (path, node) => {
        arrays.set(
          path,
          new MdyArrayManager(
            {
              rx: adapter.reactivity,
              engine: adapter,
              path,
              item: node.item,
              sections: enclosingSections(path),
              warn: (message) => adapter.warnDev(message),
              createCollection,
            },
            node.initial,
          ),
        );
      },
      (path, node) => {
        records.set(
          path,
          new MdyRecordManager(
            {
              rx: adapter.reactivity,
              engine: adapter,
              path,
              item: node.item,
              sections: enclosingSections(path),
              warn: (message) => adapter.warnDev(message),
              createCollection,
            },
            node.initial,
          ),
        );
      },
    );
    return { arrays, records };
  }

  /** History is off unless asked for; `true` takes the engine's own defaults. */
  private _enableHistory(history: MdyTypedFormBaseOptions<MdyFormValue<S>>["history"]): void {
    if (history === true) {
      this._adapter.enableHistory();
    } else if (history) {
      this._adapter.enableHistory(history);
    }
  }

  /** A bare string is the storage key; anything else is the full option set. */
  private _enableDraft(draft: MdyTypedFormBaseOptions<MdyFormValue<S>>["draft"]): void {
    if (typeof draft === "string") {
      this._adapter.enableDraft({ key: draft });
    } else if (draft) {
      this._adapter.enableDraft(draft);
    }
  }

  /**
   * Cross-field validators see the nested typed value, and the errors they return use the same
   * dotted paths the flat adapter stores fields under.
   *
   * Array-level rules — `minLength` on the array itself — are merged in here rather than installed
   * separately, because `setFormValidators` replaces the whole list.
   */
  private _installFormValidators(
    formValidators: ReadonlyArray<MdyFormValidatorFn<MdyFormValue<S>>>,
    arrayValidators: ReadonlyArray<(flat: Record<string, unknown>) => ReadonlyArray<MdyFormError>>,
  ): void {
    if (formValidators.length === 0 && arrayValidators.length === 0) return;
    this._adapter.setFormValidators([
      ...formValidators.map(
        (fn) => (flat: Record<string, unknown>) => fn(this._flatToValue(flat)),
      ),
      ...arrayValidators,
    ]);
  }

  // ── MdyFormAdapter ──────────────────────────────────────────────────────────

  getValue(): MdyFormValue<S> {
    // Teardown is a read path: a renderer unmounting, an effect evaluating once more, a consumer
    // logging what it held. A destroyed form has no fields left, so building the value from them
    // produces a shape the schema does not describe — the answer is what it held when it ended.
    if (this._valueAtDestroy !== null) return this._valueAtDestroy;
    return this._flatToValue(this._adapter.getValue());
  }

  getField<K extends keyof MdyFormValue<S>>(
    name: K,
  ): MdyFieldRef<MdyFormValue<S>[K]> | null;
  getField(name: string): MdyFieldRef<unknown> | null;
  getField(name: string): MdyFieldRef<unknown> | null {
    const ref = this._adapter.getField(name);
    return ref === null ? null : this._own(ref);
  }

  errorsFor(
    path: keyof MdyFormValue<S> | string,
  ): MdySignal<ReadonlyArray<MdyFormError>> {
    return this._adapter.errorsFor(String(path));
  }

  /**
   * What would be sent right now: every field except the disabled ones.
   *
   * Pairs with {@link MdyTypedFormBase.getValue}, which stays total. Reach for this when you need
   * to show or log the payload without submitting.
   */
  submitValue(): MdySubmittedValue<S> {
    // The same rule `getValue` follows, for the same reason: with no fields left, building the
    // payload from them answers `{}` for a form that was holding rows — so the two reads described
    // different forms, and a consumer composing them saw a contradiction rather than an ending.
    if (this._submitValueAtDestroy !== null) return this._submitValueAtDestroy;
    return this._flatToSubmitted(this._adapter.submitValue());
  }

  /**
   * A submitted value is missing its disabled fields, so it is checked against the schema as a
   * *partial*; {@link MdyTypedFormBase._flatToValue} asserts totality and rejects this shape.
   * `MdySubmittedValue<S>` and `MdyFormPatch<S>` are the same deep-optional shape over one schema,
   * so the check is shared rather than restated.
   */
  protected _flatToSubmitted(flat: Record<string, unknown>): MdySubmittedValue<S> {
    return this._keepingPositions(
      this._flatToPatch(flat) as unknown as MdySubmittedValue<S>,
      flat,
    );
  }

  /**
   * Puts back the positions a compacted list lost.
   *
   * A submitted value leaves out disabled fields, and a row whose fields are all disabled therefore
   * contributes no key at all — so the list built from what is left is *shorter*, and every row
   * after the missing one is sent at a position it does not have. In a positional collection the
   * position is the identity: a server told "row 0" is told about a row the person can see below it.
   *
   * A row that sent nothing holds nothing at the place it occupies, in the shape its own declaration
   * has: a row of cells is `{}`, a row that is itself a list is a list of the same length holding
   * nothing, and a row that is a single value is `undefined` — a list of words stays a list of
   * words. The alternative, a shorter list, is the one answer that cannot be read correctly by
   * anyone.
   *
   * Keyed collections are untouched: a key that is not sent is a key a merge leaves alone, which is
   * a reading a server already has.
   */
  private _keepingPositions(
    submitted: MdySubmittedValue<S>,
    flat: Record<string, unknown>,
  ): MdySubmittedValue<S> {
    if (this._arrayPaths.size === 0) return submitted;
    const held = this.getValue() as Record<string, unknown>;
    // Every prefix of every submitted key, so "did row 3 of this list send anything" is one lookup
    // rather than a scan of the payload. Without it the walk below costs rows × keys, which on a
    // form of a few thousand cells is the whole submit.
    const sent = new Set<string>();
    for (const key of Object.keys(flat)) {
      let cut = key.indexOf(".");
      while (cut !== -1) {
        sent.add(key.slice(0, cut));
        cut = key.indexOf(".", cut + 1);
      }
      sent.add(key);
    }
    const restore = (node: unknown, heldNode: unknown, path: string, concrete: string): unknown => {
      if (Array.isArray(node) && Array.isArray(heldNode) && this._arrayPaths.has(path)) {
        const rows: unknown[] = [];
        // `at` walks the compacted list: a row that sent nothing consumes no entry of it.
        let at = 0;
        for (let index = 0; index < heldNode.length; index += 1) {
          if (!sent.has(`${concrete}.${index}`)) {
            rows.push(this._nothingLike(`${path}.*`, heldNode[index]));
            continue;
          }
          rows.push(restore(node[at], heldNode[index], `${path}.*`, `${concrete}.${index}`));
          at += 1;
        }
        return rows;
      }
      if (isRecordValue(node) && isRecordValue(heldNode)) {
        const under = this._recordPaths.has(path) || this._arrayPaths.has(path);
        const out: Record<string, unknown> = {};
        for (const [key, child] of Object.entries(node)) {
          out[key] = restore(
            child,
            heldNode[key],
            under ? `${path}.*` : path === "" ? key : `${path}.${key}`,
            concrete === "" ? key : `${concrete}.${key}`,
          );
        }
        return out;
      }
      return node;
    };
    return restore(submitted, held, "", "") as MdySubmittedValue<S>;
  }

  /**
   * What a row that sent nothing is, in the shape its own declaration has.
   *
   * A row is not always a record. A positional collection of leaves holds values, and an empty
   * object in one of them changes the *type* of the element: a list declared as words is sent with
   * an object in it, and a receiver validating a list of words rejects the whole payload rather than
   * the one position it cannot read. The shape is taken from the schema and not from the held value,
   * because an object-valued leaf — a range, a colour — is a single value and not a row of cells.
   */
  private _nothingLike(pattern: string, held: unknown): unknown {
    if (this._itemLeafPaths.has(pattern)) return undefined;
    if (this._arrayPaths.has(pattern) && Array.isArray(held)) {
      return held.map((row) => this._nothingLike(`${pattern}.*`, row));
    }
    return {};
  }

  /**
   * The callback receives {@link MdySubmittedValue}, not {@link MdyFormValue}, because a disabled
   * field is not submitted and any field may be disabled at runtime. Narrowing at the call site is
   * the honest cost of the type telling the truth.
   */
  async submit(
    action: (
      value: MdySubmittedValue<S>,
    ) => Promise<MdyFormError[] | void> | MdyFormError[] | void,
  ): Promise<void> {
    return this._adapter.submit((flat) =>
      action(this._flatToSubmitted(flat)),
    );
  }

  markAllTouched(): void {
    this._adapter.markAllTouched();
  }

  /** Named rather than reached through a handle: a caller holding the form has no handle to use. */
  reportEntry(name: string, problem: string | null): void {
    this._adapter.reportEntry(name, problem);
  }

  buildSubmitEvent(
    value: MdySubmittedValue<S>,
  ): MdyFormSubmitEvent<MdyFormValue<S>, MdySubmittedValue<S>> {
    return {
      value,
      valid: this.state.valid(),
      errors: [...this.state.lastSubmitErrors()],
    };
  }

  patchValue(partial: Partial<MdyFormValue<S>>): void {
    this._applyFlatWithArrays(this._flattenPatch(partial, "patchValue"));
  }

  /** Deeply-typed variant of {@link patchValue} for nested groups. */
  patch(partial: MdyFormPatch<S>): void {
    this._applyFlatWithArrays(this._flattenPatch(partial, "patch"));
  }

  setValue(value: MdyFormValue<S>): void {
    // The write with the widest reach in the surface, and the one most likely to be handed a server
    // response of the wrong shape. A value that is not the whole value is refused here: below, every
    // declared path reads `undefined` out of it, which the engine would take as "not named" and
    // answer by emptying the form the caller meant to fill.
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(
        "[modyra] setValue takes the whole form value as an object, received " +
        `${value === null ? "null" : Array.isArray(value) ? "an array" : `a ${typeof value}`}.`,
      );
    }
    // What the form declares at the top, against what the value names there. A whole-value write
    // that names *nothing* the form has is not the reset `setValue({})` spells: it is a response
    // whose fields were renamed, or a transposed letter, and answering it by returning every field
    // to its initial erases what the person typed while the form goes on reporting itself valid.
    // That silent erasure is the state this door exists to close, and an object was the one shape
    // that walked through it.
    const declared = new Set<string>();
    for (const path of [
      ...this._leafPaths,
      ...this._arrayPaths,
      ...this._recordPaths,
      ...this._groupPaths,
    ]) declared.add(path.split(".")[0]!);
    const given = Object.keys(value as Record<string, unknown>);
    const unknown = given.filter((key) => !declared.has(key));
    if (given.length > 0 && unknown.length === given.length) {
      throw new Error(
        `[modyra] setValue names none of this form's fields: ${unknown.map((key) => `"${key}"`).join(", ")}. ` +
        "Pass {} to return every field to its initial deliberately.",
      );
    }
    // Some named, some not: what matched is written, and the rest is said rather than dropped —
    // a server that renamed one field is the ordinary way this happens, and the field it renamed
    // goes back to its initial without a word otherwise.
    if (unknown.length > 0) {
      this._adapter.warnDev(
        `setValue ignored ${unknown.map((key) => `"${key}"`).join(", ")}: this form declares no such field.`,
      );
    }
    const flat: Record<string, unknown> = {};
    for (const path of this._leafPaths) {
      // `undefined` where the value does not name the path at all, which the engine reads as "not
      // named" and answers with the field's initial. Reading it out instead would say `null` for a
      // path that is absent and for one that is present and null alike.
      flat[path] = namesPath(value, path) ? this._pathGet(value, path) : undefined;
    }
    // The widest write there is, and one change: every step between the fields and the last
    // collection holds part of one value and part of another.
    this.mutate(() => {
      // Plain fields first — replace semantics null out stale array rows too,
      // which the array setAll below then rebuilds with the new values.
      this._adapter.setValue(flat);
      for (const [path, manager] of this._arrays) {
        const arr = this._pathGet(value, path);
        manager.setAll(Array.isArray(arr) ? arr : []);
      }
      for (const [path, manager] of this._records) {
        const rows = this._pathGet(value, path);
        manager.setAll(isRecordValue(rows) ? rows : {});
      }
    });
  }

  reset(): void {
    // One call, one change: the fields and every collection go back together. Undoing a reset used
    // to bring the rows back one press at a time, in the order they were declared reversed, and the
    // state the person was in was on none of those steps.
    this.mutate(() => {
      this._adapter.reset();
      for (const manager of this._arrays.values()) {
        manager.resetToInitial();
      }
      for (const manager of this._records.values()) {
        manager.resetToInitial();
      }
    });
  }

  // ── History and change tracking ─────────────────────────────────────────────

  /** True when {@link undo} has state to restore (requires `history` option). */
  get canUndo(): MdySignal<boolean> {
    return this._adapter.canUndo;
  }

  /** True when {@link redo} has state to restore. */
  get canRedo(): MdySignal<boolean> {
    return this._adapter.canRedo;
  }

  /** Restores the previous recorded form value. */
  undo(): void {
    this._adapter.undo();
  }

  /** Re-applies the value undone by the last {@link undo}. */
  redo(): void {
    this._adapter.redo();
  }

  /**
   * Groups every field write inside `fn` into exactly one history entry
   * (when history is enabled) — see {@link MdyFormEngine.mutate}.
   *
   * ```ts
   * form.mutate(() => {
   *   form.f.firstName.set("Lorenzo");
   *   form.f.lastName.set("Muscherà");
   * });
   * ```
   */
  mutate(fn: () => void): void {
    this._adapter.mutate(fn);
  }

  /** True while effect-dependent features are paused — see {@link activate}/{@link deactivate}. */
  get deactivated(): boolean {
    return this._adapter.deactivated;
  }

  /**
   * Starts (or resumes) draft persistence, history recording and async
   * validators — see {@link MdyFormEngine.activate}. Idempotent.
   */
  activate(): void {
    this._adapter.activate();
  }

  /**
   * Pauses draft persistence, history recording and async validators
   * without losing any state — see {@link MdyFormEngine.deactivate}.
   * Idempotent.
   */
  deactivate(): void {
    this._adapter.deactivate();
  }

  /**
   * Minimal nested patch: only the fields whose value differs from the
   * schema's initial values — ready for an API PATCH request.
   */
  getChanges(): MdyFormPatch<S> {
    return this._flatToPatch(this._wholeArraysIn(this._adapter.getChanges()));
  }

  /**
   * A positional collection that changed is carried whole.
   *
   * A change set is documented as ready for a PATCH, and for a keyed collection it composes into
   * something a server can act on: `{ rows: { c: … } }` names the row. A positional one was a
   * *compacted* list of the rows that changed, with nothing saying where they were — editing index
   * 0, 1 or 2 produced the same body, and editing 0 and 2 read as 0 and 1. A server applying it by
   * position wrote the wrong row in two cases out of three.
   *
   * An index *is* the identity of a positional row, so a partial list is not a partial PATCH — it is
   * an ambiguous one. The whole list is the only answer that means something, and it is the shape
   * `MdyFormPatch` already declares for an array: whole-item, where a record's branch is
   * deep-partial.
   *
   * The comparison is untouched and stays right: a row is compared against its own initial, not
   * against whatever now sits at its index, so removing a row does not report every row after it as
   * changed. What is added here is the rows that did *not* change, which is what makes the position
   * of the ones that did readable.
   */
  private _wholeArraysIn(changed: Record<string, unknown>): Record<string, unknown> {
    const keys = Object.keys(changed);
    if (keys.length === 0) return changed;
    const carried = new Set<string>();
    for (const key of keys) {
      // The pattern is built alongside the concrete path: a collection's *next* segment is a row
      // key, whatever it spells, so it becomes `*`. Reading it off the segment would miss
      // `orders.a.lines` — `a` is a key that does not look like one — and would misread a group
      // whose name happens to be a number.
      let pattern = "";
      let concrete = "";
      for (const segment of key.split(".")) {
        const rowKey = this._arrayPaths.has(pattern) || this._recordPaths.has(pattern);
        pattern = pattern === "" ? segment : `${pattern}.${rowKey ? "*" : segment}`;
        concrete = concrete === "" ? segment : `${concrete}.${segment}`;
        if (this._arrayPaths.has(pattern)) carried.add(concrete);
      }
    }
    if (carried.size === 0) return changed;
    const whole: Record<string, unknown> = { ...changed };
    for (const [path, held] of Object.entries(this._adapter.getValue())) {
      // Under the collection, never the collection itself: a collection registers a field at its own
      // path so its errors have somewhere to surface, and that field holds `null`. Carrying it would
      // put a scalar where the rows go.
      for (const prefix of carried) {
        if (path.startsWith(`${prefix}.`)) whole[path] = held;
      }
    }
    return whole;
  }

  /** Reactive flat field paths (dotted for groups) — devtools/inspection. */
  get fieldNames(): MdySignal<readonly string[]> {
    return this._adapter.fieldNames;
  }

  /** The reactive implementation this form runs on (adapters, devtools). */
  get reactivity() {
    return this._adapter.reactivity;
  }

  /** True when a stored draft was restored (requires the `draft` option). */
  get hasDraft(): MdySignal<boolean> {
    return this._adapter.hasDraft;
  }

  /** Removes the stored draft (also happens after an error-free submit). */
  clearDraft(): void {
    this._adapter.clearDraft();
  }

  /** True once {@link destroy} has run. */
  get destroyed(): boolean {
    return this._adapter.destroyed;
  }

  /**
   * Releases every resource the form owns (async runners, draft/history
   * effects, timers, field records). Idempotent — call it when the owning
   * scope goes away (unmount, dispose, disconnect).
   */
  /**
   * Runs `teardown` when this form is destroyed, and hands back a way to stop that.
   *
   * A binding made from one of this form's handles — a store a component subscribes to, a watcher an
   * adapter opens — outlives the form whenever the two teardowns race, and a component does not
   * always get to run its cleanup first. The consumer cannot order that; the form can, because it
   * knows what was made from it.
   *
   * Registering on a form that is already destroyed runs `teardown` at once: a binding built from a
   * handle of a dead form is dead too, and making the caller check first is a race of its own.
   */
  onDestroy(teardown: () => void): () => void {
    if (this.destroyed) {
      teardown();
      return () => undefined;
    }
    this._teardowns.add(teardown);
    return () => {
      this._teardowns.delete(teardown);
    };
  }

  destroy(): void {
    if (this._valueAtDestroy === null) {
      try {
        this._valueAtDestroy = this.getValue();
        this._submitValueAtDestroy = this.submitValue();
      } catch {
        // A form that could not state its value while it was alive cannot state it afterwards; the
        // read then fails as it did before, which is the honest answer.
      }
    }
    // What was made from this form goes first: a binding that keeps notifying after the engine has
    // gone re-renders a consumer against a form that has ended. Each is isolated, so one that throws
    // does not keep the rest from running or stop the engine being torn down.
    for (const teardown of [...this._teardowns]) {
      try {
        teardown();
      } catch (error) {
        this._adapter.warnDev(`a teardown registered with onDestroy threw: ${String(error)}`);
      }
    }
    this._teardowns.clear();
    for (const manager of this._arrays.values()) manager.destroy();
    for (const manager of this._records.values()) manager.destroy();
    this._adapter.destroy();
  }

  // ── MdyFormRegistry (bindings speaking the flat path protocol) ──────────────

  /**
   * Refuses a path this schema does not describe.
   *
   * A typed form knows what it declares, and a rule attached to a name it does not — one transposed
   * letter — registers a field nothing renders a control for. The rule can then never be satisfied:
   * `valid()` goes false, `canSubmit()` goes false, `submit()` never calls its action, and the error
   * sits on a path nothing is bound to. A filled-in form with a Submit that does nothing and no
   * message anywhere.
   *
   * Refused rather than ignored, because the way out is `removeField` on the ghost path — which
   * requires knowing the ghost is there, and being told is the one thing that did not happen.
   *
   * This is the typed form's check and not the engine's: the engine has no schema, and a field
   * coming into being because something asked for it is how a declarative adapter builds a form.
   */
  private _assertDeclares(name: string, method: string): void {
    if (this._describes(name)) return;
    throw new Error(
      `[modyra] ${method} names "${name}", which this form does not declare. ` +
      "A rule on a path no control renders can never be satisfied, and the form could not be submitted.",
    );
  }

  addValidators<T>(
    name: string,
    validators: ReadonlyArray<ValidatorFn<T>>,
    isRequired?: boolean,
  ): void {
    this._assertDeclares(name, "addValidators");
    this._adapter.addValidators(name, validators, isRequired);
  }

  upsertValidators<T>(
    name: string,
    key: string,
    validators: ReadonlyArray<ValidatorFn<T>>,
    marksRequired?: boolean,
  ): void {
    this._assertDeclares(name, "upsertValidators");
    this._adapter.upsertValidators(name, key, validators, marksRequired);
  }

  removeValidators(name: string, key: string): void {
    this._adapter.removeValidators(name, key);
  }

  upsertAsyncValidators<T>(
    name: string,
    key: string,
    validators: ReadonlyArray<MdyAsyncValidatorFn<T>>,
    options?: MdyAsyncValidatorOptions,
  ): void {
    this._assertDeclares(name, "upsertAsyncValidators");
    this._adapter.upsertAsyncValidators(name, key, validators, options);
  }

  setInitialValue(name: string, value: unknown): void {
    // The same door, and the consequence arrives even later: an initial planted on a path the schema
    // does not have is a baseline `reset()` never returns to, discovered as a form that resets to
    // the wrong thing, arbitrarily far from the line that caused it.
    this._assertDeclares(name, "setInitialValue");
    this._adapter.setInitialValue(name, value);
    // Declaring what a path started as says the path was there to start with.
    this._adapter.noteBaseline?.(name);
  }

  /**
   * Makes the value the form holds now the one it started from.
   *
   * `setInitialValue` names one leaf, which answers for a form whose paths were all known when the
   * code was written. A collection's keys are data: a row the user added has a path nobody could
   * have written down, so its cells never stopped being reported as changes however deliberately the
   * consumer had saved them.
   *
   * This is the same act `clearDraft()` performs, on the surface a consumer actually holds — a
   * consumer who saves by another route wants it too, which is what the release note claimed and the
   * engine's own method could not deliver: the engine behind a form is not theirs to reach.
   */
  rebaselineToCurrentValue(): void {
    this._adapter.rebaselineToCurrentValue();
  }

  /**
   * The paths this form's schema declared as secrets.
   *
   * The devtools panel reads it, and so can anything else that copies values out — a logger, a
   * telemetry payload, a bug report. The declaration is on the field because that is where an
   * author knows it; asking every consumer to keep a second list is how the two come to disagree.
   */
  sensitivePaths(): readonly string[] {
    return this._adapter.sensitivePaths?.() ?? [];
  }

  setSanitizer(name: string, sanitizer: MdySanitizer): void {
    this._adapter.setSanitizer(name, sanitizer);
  }

  setDisabled(name: string, disabled: TBooleanSignal): void {
    this._adapter.setDisabled(name, disabled);
  }

  setInactive(name: string, inactive: TBooleanSignal): void {
    this._adapter.setInactive(name, inactive);
  }

  setReadonly(name: string, readonly: TBooleanSignal): void {
    this._adapter.setReadonly(name, readonly);
  }

  claimField(name: string): void {
    this._adapter.claimField(name);
  }

  removeField(name: string): void {
    this._adapter.removeField(name);
  }

  // ── Protected helpers ───────────────────────────────────────────────────────

  protected _registerSchema(nodes: MdyFormSchema): void {
    /**
     * The condition of every section, by its path.
     *
     * A group is visited before the fields under it, so by the time a leaf is registered every
     * section enclosing it is already here — and a leaf is in play only while its own condition and
     * all of those agree.
     */
    const sectionConditions = new Map<
      string,
      (value: unknown, enclosing: Record<string, unknown>) => boolean
    >();

    walkSchema(nodes, "", (path, node) => {
      if (node.sanitize !== null) {
        this._adapter.setSanitizer(path, node.sanitize);
      }
      // A statement about the value, made where the field is declared and read wherever the value
      // would otherwise be copied out of the form.
      if (node.sensitive) this._adapter.markSensitive?.(path);
      if (node.shape !== null) this._adapter.declareShape?.(path, node.shape);
      if (node.options !== null) this._adapter.declareOptions?.(path, node.options);
      this._adapter.setInitialValue(path, node.initial);
      this._adapter.getField(path);
      // The schema declared it, so a control that unmounts releases its claim and nothing more.
      this._adapter.ownField(path);
      const marksRequired = node.validators.some((fn) => hasRequiredMarker(fn));
      this._adapter.upsertValidators(
        path,
        SCHEMA_KEY,
        node.validators,
        marksRequired,
      );
      // Every condition with a say over this field: its own, and each section above it. They are
      // composed once, by `conditions.ts`, so this is a list rather than a rule.
      const conditions: MdyCondition[] = [];
      for (const [sectionPath, condition] of sectionConditions) {
        if (path.startsWith(`${sectionPath}.`)) {
          conditions.push({
            holds: condition,
            read: () => {
              const formValue = this.getValue() as Record<string, unknown>;
              return { value: valueAt(formValue, sectionPath), enclosing: formValue, root: formValue };
            },
          });
        }
      }
      if (node.when !== null) {
        const when = node.when;
        conditions.push({
          holds: when,
          read: () => ({
            value: this._adapter.getField(path)?.().value(),
            enclosing: this.getValue() as Record<string, unknown>,
            root: this.getValue() as Record<string, unknown>,
          }),
        });
      }

      if (conditions.length > 0) {
        // Inactive is what a disabled field already is here — not validated, not submitted, value
        // kept — registered as its own input to `interactivity` so a control's own `[disabled]`
        // binding and these rules cannot overwrite each other.
        this._adapter.setInactive(
          path,
          composeConditions(this._adapter.reactivity, conditions, (message) =>
            this._adapter.warnDev(`"${path}": ${message}`),
          ),
        );
      }
      if (node.asyncValidators.length > 0) {
        this._adapter.upsertAsyncValidators(
          path,
          SCHEMA_KEY,
          node.asyncValidators,
          {
            debounceMs: node.asyncDebounceMs,
            dependsOn: node.asyncDependsOn,
            timeoutMs: node.asyncTimeoutMs,
            when: node.asyncWhen ?? undefined,
          },
        );
      }
    },
    (groupPath, groupNode) => {
      if (groupNode.when !== null) sectionConditions.set(groupPath, groupNode.when);
    });
  }

  protected _buildHandleTree(
    nodes: MdyFormSchema,
    prefix: string,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, node] of Object.entries(nodes)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (node.kind === "field") {
        out[key] = this._buildHandle(path);
      } else if (node.kind === "array") {
        out[key] = this._buildArrayHandle(path, node);
      } else if (node.kind === "record") {
        out[key] = this._buildRecordHandle(path, node);
      } else {
        out[key] = this._buildHandleTree(node.children, path);
      }
    }
    if (isFieldHandleTree(out, nodes)) {
      return this._own(out);
    }
    throw new Error("[modyra] Failed to build typed handle tree");
  }

  /**
   * Marks something the form hands out as belonging to this form and its runtime.
   *
   * `observerFor` falls back to a fresh vanilla runtime for anything it does not recognise, and a
   * fresh runtime observes nothing anyone else can see — silently. Every shape a consumer can hold
   * is registered, not only the field handles: a collection handle's `keys`, `length` and `rows` are
   * signals, and a row's tree is what a template walks to reach them.
   */
  protected _own<T extends object>(handle: T): T {
    registerHandleOwner(handle, this._adapter.reactivity);
    registerHandleForm(handle, this);
    return handle;
  }

  protected abstract _buildHandle(path: string): THandle;

  private _buildArrayHandle(
    path: string,
    node: MdyAnyArrayDescriptor,
  ): MdyArrayHandle<unknown, unknown> {
    const manager = this._arrays.get(path);
    if (!manager) {
      throw new Error(`[modyra] Array "${path}" was not registered`);
    }
    const rx = this._adapter.reactivity;
    // Built the way a keyed collection's cells are: resolving the field by path on every read.
    //
    // A structural change destroys every row's fields and registers them again, and `rows` is
    // recomputed from the row count — so an operation that keeps the count, `move` above all, used
    // to hand back the *same* handles pointing at records the engine had already destroyed. They
    // reported the value the row held before the reorder and wrote into nothing: what a person
    // typed after dragging a row went nowhere, in the arrangement the guide shows.
    const rows = rx.computed(() =>
      Array.from({ length: manager.rowCount() }, (_, i) => this._rowHandle(node.item, `${path}.${i}`)),
    );
    const errors = this._adapter.errorsFor(path);
    return this._own({
      path,
      length: manager.rowCount,
      rows,
      errors,
      valid: rx.computed(() => errors().length === 0),
      push: (value: unknown) => manager.push(value),
      insert: (index: number, value: unknown) => manager.insert(index, value),
      remove: (index: number) => manager.remove(index),
      move: (from: number, to: number) => manager.move(from, to),
      setAll: (values: ReadonlyArray<unknown>) => manager.setAll(values),
      at: (index: number) => rows()[index] ?? null,
    });
  }

  private _buildRecordHandle(
    path: string,
    node: MdyAnyRecordDescriptor,
  ): MdyRecordHandle<unknown, unknown> {
    const manager = this._records.get(path);
    if (!manager) {
      throw new Error(`[modyra] Record "${path}" was not registered`);
    }
    const rx = this._adapter.reactivity;
    const errors = this._adapter.errorsFor(path);
    const row = (key: string): unknown => this._rowHandle(node.item, `${path}.${key}`);
    return this._own({
      path,
      keys: manager.keys,
      value: rx.computed(() => {
        // Read through the engine's value so the signal recomputes when a cell changes, not only
        // when the key set does.
        this._adapter.value();
        return manager.getValues();
      }),
      errors,
      valid: rx.computed(() => errors().length === 0),
      has: (key: string) => manager.has(key),
      row,
      cell: (<TCell,>(key: string, leaf?: string): MdyFieldHandle<TCell> => {
        // Checked against the row's schema, which is static: a mistyped part addresses nothing and
        // would otherwise render a control that stays empty for ever without saying why. The key is
        // not checked here — a row that does not exist yet is the ordinary case.
        // Reported once per wrong part, not once per call: a template asks for its cells on every
        // render, so a mistyped part would otherwise turn one mistake into a stream. The part is
        // what identifies the mistake — the key is not, since every row repeats the same one.
        if (MDY_DEV && !manager.addresses(leaf) && !this._reportedCellParts.has(`${path}\u0000${leaf}`)) {
          this._reportedCellParts.add(`${path}\u0000${leaf}`);
          const offered = manager.rowLeaves().map((l) => (l === "" ? "(no path — rows are leaves)" : l));
          this._adapter.warnDev(
            `cell(${JSON.stringify(key)}, ${JSON.stringify(leaf)}) on "${path}" addresses nothing. ` +
            `This row offers: ${offered.join(", ")}.`,
          );
        }
        return this.cellHandle(
          leaf === undefined ? `${path}.${key}` : `${path}.${key}.${leaf}`,
        ) as MdyFieldHandle<TCell>;
      }) as MdyRecordHandle<unknown, unknown>["cell"],
      upsert: (key: string, value?: unknown) => manager.upsert(key, value),
      remove: (key: string) => manager.remove(key),
      setAll: (values: Readonly<Record<string, unknown>>) => manager.setAll(values),
      patch: (values: Readonly<Record<string, unknown>>) => manager.patch(values),
      rename: (from: string, to: string) => manager.rename(from, to),
      validOf: (key: string) => manager.validOf(key),
    });
  }

  /**
   * The handle tree for one row, built from cell handles — and from the collections the row itself
   * declared, which are handles of their own rather than cells.
   *
   * A collection inside a row has no manager until the row is declared, so the handle resolves it
   * on each read: a tree built once would hand back a handle onto a manager the row has since
   * replaced, which is the defect the array's row handles were already fixed for.
   */
  /**
   * A row's handle, whatever the row's shape is.
   *
   * A row is usually a group of cells, but a schema may make the row itself a leaf or a whole
   * collection — `record(array(field()))` is a keyed list of lists, and the row is the list.
   */
  private _rowHandle(item: MdyFormSchema[string], path: string): unknown {
    // Under the form's ownership: a row handle is built inside the collection's `rows` computation,
    // and a runtime that owns computations disposes it the next time that computation runs.
    return this._adapter.runOwned(() => {
      if (item.kind === "field") return this.cellHandle(path);
      if (item.kind === "record" || item.kind === "array") return this._buildNestedCollectionHandle(path, item);
      return this._buildCellTree(item.children, path);
    });
  }

  private _buildCellTree(nodes: MdyFormSchema, prefix: string): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(nodes)) {
      const path = `${prefix}.${key}`;
      if (child.kind === "group") {
        out[key] = this._buildCellTree(child.children, path);
      } else if (child.kind === "record" || child.kind === "array") {
        out[key] = this._buildNestedCollectionHandle(path, child);
      } else {
        out[key] = this.cellHandle(path);
      }
    }
    return this._own(out);
  }

  /**
   * A handle onto a collection a row declared, resolved through the collection that owns it.
   *
   * The manager exists only while the row does. Every call goes through `_collectionAt` rather than
   * closing over one, so a row removed and declared again is answered by the manager it has now.
   */
  private _buildNestedCollectionHandle(path: string, node: MdyAnyRecordDescriptor | MdyAnyArrayDescriptor): unknown {
    const rx = this._adapter.reactivity;
    if (node.kind === "array") {
      const manager = (): MdyArrayManager => {
        const found = this._collectionAt(path);
        if (!(found instanceof MdyArrayManager)) {
          throw new Error(`[modyra] Collection "${path}" is not declared — its row is not either`);
        }
        return found;
      };
      const arrayAt = (): MdyArrayManager | undefined => {
        const found = this._collectionAt(path);
        return found instanceof MdyArrayManager ? found : undefined;
      };
      const rows = rx.computed(() => {
        this._adapter.value();
        const found = arrayAt();
        const count = found ? found.rowCount() : 0;
        // Through `_rowHandle`, so a row that is itself a collection answers as one. Reading the
        // item's `children` directly assumed every row was a group, and a row that is a list has
        // none — the read then threw where a nested list should have answered.
        return Array.from({ length: count }, (_, i) => this._rowHandle(node.item, `${path}.${i}`));
      });
      const errors = this._adapter.errorsFor(path);
      return this._own({
        path,
        length: rx.computed(() => arrayAt()?.rowCount() ?? 0),
        rows,
        errors,
        valid: rx.computed(() => errors().length === 0),
        push: (value: unknown) => manager().push(value),
        insert: (index: number, value: unknown) => manager().insert(index, value),
        remove: (index: number) => manager().remove(index),
        move: (from: number, to: number) => manager().move(from, to),
        setAll: (values: ReadonlyArray<unknown>) => manager().setAll(values),
        at: (index: number) => (rows() as unknown[])[index] ?? null,
      });
    }
    const manager = (): MdyRecordManager => {
      const found = this._collectionAt(path);
      if (!(found instanceof MdyRecordManager)) {
        throw new Error(`[modyra] Collection "${path}" is not declared — its row is not either`);
      }
      return found;
    };
    const recordAt = (): MdyRecordManager | undefined => {
      const found = this._collectionAt(path);
      return found instanceof MdyRecordManager ? found : undefined;
    };
    // Through `_rowHandle` for the same reason as the positional branch above: a row may be a
    // collection, and a collection has no `children` to walk.
    const rowTree = (key: string): unknown => this._rowHandle(node.item, `${path}.${key}`);
    return {
      path,
      // The value is read first so a structural change invalidates this: a move rebuilds the row's
      // manager, and a computed tracking only the old manager's key signal would answer for a
      // collection that no longer exists.
      keys: rx.computed(() => { this._adapter.value(); return recordAt()?.keys() ?? []; }),
      value: rx.computed(() => {
        this._adapter.value();
        const found = recordAt();
        if (!found) return {};
        return Object.fromEntries(found.keys().map((key) => [key, this._pathGet(this.getValue() as Record<string, unknown>, `${path}.${key}`)]));
      }),
      errors: this._adapter.errorsFor(path),
      valid: rx.computed(() => recordAt()?.keys().every((key) => manager().validOf(key)) ?? true),
      has: (key: string) => recordAt()?.has(key) ?? false,
      row: rowTree,
      cell: <T,>(key: string, leaf?: string) =>
        this.cellHandle(leaf === undefined ? `${path}.${key}` : `${path}.${key}.${leaf}`) as MdyFieldHandle<T>,
      upsert: (key: string, value?: unknown) => manager().upsert(key, value),
      remove: (key: string) => manager().remove(key),
      setAll: (values: Readonly<Record<string, unknown>>) => manager().setAll(values),
      patch: (values: Readonly<Record<string, unknown>>) => manager().patch(values),
      rename: (from: string, to: string) => manager().rename(from, to),
      validOf: (key: string) => manager().validOf(key),
    };
  }

  /** The manager for a collection at `path`, declared by the form or by a row below it. */
  private _collectionAt(path: string): MdyNestedCollection | undefined {
    const own = this._records.get(path);
    if (own) return own;
    for (const [at, manager] of this._records) {
      if (path.startsWith(`${at}.`)) {
        const found = manager.nested(path);
        if (found) return found;
      }
    }
    // An array's rows may own a record too: its rows are positional, so the manager is asked by
    // path like any other — the index is part of the path, not a separate lookup.
    for (const [at, manager] of this._arrays) {
      if (path.startsWith(`${at}.`)) {
        const found = manager.nested(path);
        if (found) return found;
      }
    }
    return undefined;
  }

  /**
   * A handle for a path that may not exist yet.
   *
   * Every signal reads the field through the engine on each evaluation rather than closing over a
   * record, so one handle serves the row before it is declared, while it lives, and again after it is
   * declared a second time. That indirection is the whole point: a renderer holds the handle across
   * every structural change, and a control never re-binds because the row was rebuilt.
   *
   * While the path has no field the handle reads empty and writes nowhere — the row does not exist,
   * and a control must not be the thing that brings it into being.
   */
  protected cellHandle(path: string): MdyFieldHandle<unknown> {
    const existing = this._cellHandles.get(path)?.deref();
    if (existing) return existing;
    // The handle is cached and handed back for the life of the form, so it cannot belong to the
    // computation that happened to ask for it first.
    return this._adapter.runOwned(() => this._buildCellHandle(path));
  }

  private _buildCellHandle(path: string): MdyFieldHandle<unknown> {
    const rx = this._adapter.reactivity;
    const state = (): MdyFieldState<unknown> | null => {
      // Depends on *which* fields exist, not only on their values: the row this cell belongs to may
      // be declared long after the handle was handed out, and a lookup in a plain map would never
      // tell the computed that its answer changed.
      this._adapter.fieldNames();
      const ref = this._adapter.peekField(path);
      return ref ? ref() : null;
    };
    const handle: MdyFieldHandle<unknown> = {
      path,
      value: rx.computed(() => state()?.value() ?? null),
      errors: rx.computed(() => state()?.errors() ?? []),
      touched: rx.computed(() => state()?.touched() ?? false),
      dirty: rx.computed(() => state()?.dirty() ?? false),
      valid: rx.computed(() => state()?.valid() ?? true),
      pending: rx.computed(() => state()?.pending() ?? false),
      required: rx.computed(() => state()?.required() ?? false),
      constraints: rx.computed(() => state()?.constraints() ?? NO_CONSTRAINTS),
      interactivity: rx.computed(() => state()?.interactivity() ?? "enabled"),
      disabled: rx.computed(() => state()?.disabled() ?? false),
      readonly: rx.computed(() => state()?.readonly() ?? false),
      set: (value: unknown) => state()?.value.set(value),
      markAsTouched: () => state()?.touched.set(true),
      markAsDirty: () => state()?.dirty.set(true),
      reportEntry: (problem: string | null) => this._adapter.reportEntry(path, problem),
    };
    registerHandleOwner(handle, rx);
    registerHandleForm(handle, this);
    this._cellHandles.set(path, new WeakRef(handle));
    this._cellHandlesSweep.register(handle, path);
    return handle;
  }

  /** Rebuilds the nested value shape from the adapter's flat dotted paths. */
  protected _flatToValue(flat: Record<string, unknown>): MdyFormValue<S> {
    return numericKeysToArrays(
      unflatten(flat), this._arrayPaths, this._recordPaths,
    ) as MdyFormValue<S>;
  }

  protected _flatToPatch(flat: Record<string, unknown>): MdyFormPatch<S> {
    return numericKeysToArrays(
      unflatten(flat), this._arrayPaths, this._recordPaths,
    ) as MdyFormPatch<S>;
  }

  /**
   * Which flat paths this schema can describe: a declared leaf, a collection, or something inside
   * one.
   *
   * A field can exist that the schema never declared — a restored draft carries a key nobody wrote
   * down, a patch arrives from a server response with a member the form does not have. The engine
   * accepts such a field on purpose: used directly, without a schema, that is how a draft creates
   * one. A *typed* form is a narrower promise, and `getValue()` states it in its type.
   */
  protected _describes(path: string): boolean {
    if (this._leafPathSet.has(path)) return true;
    if (this._recordPaths.has(path) || this._arrayPaths.has(path)) return true;
    for (const prefix of this._recordPaths) if (path.startsWith(`${prefix}.`)) return true;
    for (const prefix of this._arrayPaths) if (path.startsWith(`${prefix}.`)) return true;
    // A group is declared too, and the refusal that did not know it sent a reader looking for a typo
    // in a name they had spelled correctly. What a caller may *do* with a group differs per method;
    // that it exists is this question, and the answer is yes.
    if (this._groupPaths.has(path)) return true;
    for (const prefix of this._groupPaths) if (path.startsWith(`${prefix}.`)) return true;
    return false;
  }

  /**
   * The flat entries this schema describes.
   *
   * Read on the way out rather than refused on the way in: the field is the engine's to hold, and
   * whoever put it there may have had a reason the form cannot see. What a typed read answers is
   * the shape the schema declares — including when the answer would otherwise be a throw, which is
   * what an undeclared key used to produce on the next `submitValue()`.
   */
  protected _described(flat: Record<string, unknown>): Record<string, unknown> {
    const kept: Record<string, unknown> = {};
    for (const [path, value] of Object.entries(flat)) {
      if (this._describes(path)) kept[path] = value;
    }
    return kept;
  }

  /**
   * Flattens a (possibly nested) patch object into dotted adapter paths.
   *
   * A member the schema does not describe is dropped rather than written: `patch` takes whatever a
   * consumer received — a server response, a stored payload — and a key from there must not become
   * a field. `setValue` has always ignored one; this is the same answer for the other door.
   */
  protected _flattenPatch(
    partial: Partial<MdyFormValue<S>> | MdyFormPatch<S>,
    /** The door the caller used, so what is reported names the call they wrote. */
    door?: string,
  ): Record<string, unknown> {
    const flat = flattenPatch(
      partial as Record<string, unknown>,
      this._groupPaths,
      this._arrayPaths,
      this._recordPaths,
    );
    const kept = this._described(flat);
    // Dropped, and said. The doors that matter here are the ones where the keys come from data — a
    // document, a server response, a saved project — and a typo there is indistinguishable from an
    // applied write: the form shows what it already held either way.
    if (MDY_DEV && door !== undefined) {
      const dropped = Object.keys(flat).filter((path) => !(path in kept));
      if (dropped.length > 0) {
        this._adapter.warnDev(
          `${door} ignored ${dropped.map((path) => `"${path}"`).join(", ")}: this form declares no such field.`,
        );
      }
    }
    return kept;
  }

  /** Routes array- and record-path entries to their manager, the rest to the flat adapter. */
  protected _applyFlatWithArrays(flat: Record<string, unknown>): void {
    const plain: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(flat)) {
      const array = this._arrays.get(key);
      const record = this._records.get(key);
      if (array) {
        // A value that is not an array says nothing about rows — it is not an instruction to delete
        // them. `patch({ items: response.items })` where the response omitted the list is the
        // ordinary way that value arrives, and emptying the collection over it is silent data loss.
        //
        // An empty array *is* an instruction, and it is the one place the two kinds of collection
        // read the same sentence differently: `{}` names no key and merges nothing, while `[]` is a
        // list of no rows and an index is a row's identity — a partial list would be an ambiguous
        // PATCH rather than a partial one. Both readings are their kind's, and a consumer who learns
        // one from a map and writes it for a list deletes their rows, so the destructive one says so
        // out loud while it is still recoverable.
        if (MDY_DEV && Array.isArray(v) && v.length === 0) {
          const held = this._adapter.reactivity.untracked(() => array.rowCount());
          if (held > 0) {
            this._adapter.warnDev(
              `patch({ ${key}: [] }) empties "${key}" — ${held} row(s). An array in a patch is the ` +
              "whole list, because an index is a row's identity; a keyed collection merges by key, " +
              "so `{}` there changes nothing. To leave the list alone, omit it.",
            );
          }
        }
        array.setAllFrom(v);
      } else if (record) {
        // A patch names the rows it touches and leaves the others alone; replacing the collection is
        // what `setValue` means, and it goes through `setAll` below. The manager is handed the value
        // as it came, so a shape it cannot use is reported rather than quietly read as "no rows".
        record.patch(v as Readonly<Record<string, unknown>>);
      } else {
        plain[key] = v;
      }
    }
    if (Object.keys(plain).length > 0) {
      this._adapter.patchValue(plain);
    }
  }

  /**
   * Wraps each collection node's own validators as form-level validators (A.6) — at every depth.
   *
   * A collection inside another collection's row has no static path: `orders.<key>.lines` exists
   * once per row. So a nested collection's validators are compiled against *instances*, resolved
   * from the current value at run time — every row of every ancestor — and each instance's errors
   * carry that instance's concrete path. A top-level collection is the base case: one instance, at
   * the schema's own path, which is exactly what this compiled before it recursed.
   */
  private _buildArrayValidators(
    schema: MdyFormSchema,
  ): ReadonlyArray<MdyFormValidatorFn<Record<string, unknown>>> {
    const out: Array<MdyFormValidatorFn<Record<string, unknown>>> = [];
    interface CollectionNode {
      readonly kind: "array" | "record";
      readonly item: unknown;
      readonly validators: ReadonlyArray<ValidatorFn<never>>;
    }
    interface Instance { readonly path: string; readonly value: unknown }

    /** The collections directly inside a row's item, with their sub-path through any groups. */
    const nestedIn = (item: unknown, prefix: string): Array<{ sub: string; node: CollectionNode }> => {
      const found: Array<{ sub: string; node: CollectionNode }> = [];
      const pending: Array<{ item: unknown; prefix: string }> = [{ item, prefix }];
      while (pending.length > 0) {
        const current = pending.pop()!;
        if (current.item === null || typeof current.item !== "object") continue;
        const node = current.item as { kind?: string; children?: Record<string, unknown> };
        if (node.kind === "group" && node.children) {
          const entries = Object.entries(node.children);
          for (let index = entries.length - 1; index >= 0; index -= 1) {
            const [key, child] = entries[index]!;
            pending.push({
              item: child,
              prefix: current.prefix.length > 0 ? `${current.prefix}.${key}` : key,
            });
          }
          continue;
        }
        if (node.kind === "array" || node.kind === "record") {
          found.push({ sub: current.prefix, node: node as unknown as CollectionNode });
        }
      }
      return found;
    };

    const rowsOf = (node: CollectionNode, value: unknown): Array<[string, unknown]> =>
      node.kind === "array"
        ? (Array.isArray(value) ? value.map((row, index) => [String(index), row] as [string, unknown]) : [])
        : (isRecordValue(value) ? Object.entries(value) : []);

    /**
     * Registers a collection's validators and those of every collection below it.
     *
     * Over a queue rather than by recursion: nesting has no cap, and a document deep enough to
     * exhaust the stack here would fail while the form is being built, with an error naming neither
     * the document nor the path.
     */
    const register = (root: CollectionNode, rootInstances: (nested: unknown) => Instance[]): void => {
      const pending: Array<{ node: CollectionNode; instances: (nested: unknown) => Instance[] }> = [
        { node: root, instances: rootInstances },
      ];
      while (pending.length > 0) {
        const { node, instances } = pending.pop()!;
        registerOne(node, instances, pending);
      }
    };

    const registerOne = (
      node: CollectionNode,
      instances: (nested: unknown) => Instance[],
      pending: Array<{ node: CollectionNode; instances: (nested: unknown) => Instance[] }>,
    ): void => {
      if (node.validators.length > 0) {
        out.push((flat) => {
          const nested = numericKeysToArrays(unflatten(flat), this._arrayPaths, this._recordPaths);
          return instances(nested).flatMap(({ path, value }) => {
            // Cast at the storage boundary, like upsertValidators does for fields: the validators
            // are erased to ValidatorFn<never> in the schema union, but the runtime value always
            // matches the collection's shape.
            const coerced = node.kind === "array"
              ? (Array.isArray(value) ? value : [])
              : (isRecordValue(value) ? value : {});
            return node.validators.flatMap((fn) =>
              (fn as ValidatorFn<unknown>)(coerced).map((message) => ({ path, kind: node.kind, message })),
            );
          });
        });
      }
      for (const { sub, node: child } of nestedIn(node.item, "")) {
        pending.push({
          node: child,
          instances: (nested) =>
            instances(nested).flatMap(({ path, value }) =>
              rowsOf(node, value).map(([key, row]) => ({
                path: `${path}.${key}.${sub}`,
                value: this._pathGet(row, sub),
              })),
            ),
        });
      }
    };

    const registerRoot = (path: string, node: unknown): void =>
      register(node as CollectionNode, (nested) => [{ path, value: this._pathGet(nested, path) }]);

    walkSchema(
      schema,
      "",
      () => { /* fields are not collection-level */ },
      undefined,
      registerRoot,
      registerRoot,
    );
    return out;
  }

  protected _pathGet(value: unknown, path: string): unknown {
    return pathGet(value, path);
  }
}

/**
 * Typed form model over the flat {@link MdyFormEngine}.
 *
 * Implements `MdyFormAdapter` (with the nested, inferred value type) and
 * `MdyFormRegistry`, so bindings that speak the flat path protocol keep
 * working next to the typed handle tree.
 */
export class MdyTypedForm<S extends MdyFormSchema>
  extends MdyTypedFormBase<S, MdyFieldHandle<unknown>>
  implements MdyFormAdapter<MdyFormValue<S>, MdySubmittedValue<S>>, MdyFormRegistry {
  readonly state: MdyFormState;
  readonly f: MdyFieldHandleTree<S>;
  readonly value: MdySignal<MdyFormValue<S>>;

  constructor(schema: S, options?: MdyCoreFormOptions<MdyFormValue<S>>) {
    const rx = options?.reactivity ?? vanillaReactivity();
    const engine = new MdyFormEngine(
      rx,
      () => undefined,
      () => options?.submitMode ?? "valid-only",
      {
        security: options?.security,
        autoActivate: options?.autoActivate,
        devWarnings: options?.devWarnings,
        diagnostics: options?.diagnostics,
      },
    );
    super(schema, engine, options);
    this.state = engine.state;
    // Through `getValue`, so a read after destroy answers rather than throwing — the signal is what
    // a template holds, and a template is read once more on the way out.
    this.value = rx.computed(() => this.getValue());
    // `this._schema`, not the argument: the base normalizes a key that spells a path into the
    // structure it describes, and the handle tree has to be the one the value has.
    this.f = this._buildHandleTree(this._schema, "") as MdyFieldHandleTree<S>;
  }

  protected _buildHandle(path: string): MdyFieldHandle<unknown> {
    const ref = this._adapter.getField(path);
    if (!ref) {
      throw new Error(`[modyra] Field "${path}" was not registered`);
    }
    const state = ref();
    const handle: MdyFieldHandle<unknown> = {
      path,
      value: state.value,
      errors: state.errors,
      touched: state.touched,
      dirty: state.dirty,
      valid: state.valid,
      pending: state.pending,
      required: state.required,
      constraints: state.constraints,
      interactivity: state.interactivity,
      disabled: state.disabled,
      readonly: state.readonly,
      set: (v: unknown): void => state.value.set(v),
      markAsTouched: (): void => state.touched.set(true),
      markAsDirty: (): void => state.dirty.set(true),
      reportEntry: (problem: string | null): void => this._adapter.reportEntry(path, problem),
    };
    registerHandleOwner(handle, this._adapter.reactivity);
    registerHandleForm(handle, this);
    return handle;
  }

  /** Core validates the unflattened value against the schema shape. */
  protected override _flatToValue(flat: Record<string, unknown>): MdyFormValue<S> {
    const nested = numericKeysToArrays(
      unflatten(this._described(flat)), this._arrayPaths, this._recordPaths,
    );
    if (isSchemaValue(nested, this._schema)) {
      return nested;
    }
    throw new Error("[modyra] Flat value does not match schema shape");
  }

  /** Core validates the unflattened patch against the schema shape. */
  protected override _flatToPatch(flat: Record<string, unknown>): MdyFormPatch<S> {
    const nested = numericKeysToArrays(
      unflatten(this._described(flat)), this._arrayPaths, this._recordPaths,
    );
    if (isSchemaPatch(nested, this._schema)) {
      return nested;
    }
    throw new Error("[modyra] Flat patch does not match schema shape");
  }
}
