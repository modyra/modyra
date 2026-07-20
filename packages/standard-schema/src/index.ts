/**
 * @modyra/standard-schema — framework-agnostic Standard Schema adapter for
 * the Modyra form engine. One adapter for every Standard Schema v1 library
 * (Zod ≥3.24, Valibot, ArkType, …): https://standardschema.dev
 *
 * The spec standardizes validation only — there is no introspection API —
 * so this adapter follows the TanStack Form model:
 *
 * - the **user declares the field tree** with `field()`/`group()`/`array()`
 *   (initial values, sync validators, `required` flags);
 * - the **schema validates the whole form value** through a form-level
 *   validator, with issues attributed to their dotted field paths;
 * - when `validate({})` succeeds, its output seeds the matching field
 *   initials (schema-level defaults).
 *
 * Async schemas (any `validate` returning a Promise) are rejected up front:
 * form-level validation in the engine is synchronous — move async rules to
 * field-level `asyncValidators` or `serverValidator()`.
 *
 * For compile-time agreement between the schema and the declared tree,
 * annotate the fields with {@link MdyStandardSchemaTree}.
 */
import {
  createForm,
  MdyAnyArrayDescriptor,
  MdyAnyFieldDescriptor,
  MdyAnyGroupDescriptor,
  MdyArrayDescriptor,
  MdyCoreFormOptions,
  MdyFieldDescriptor,
  MdyFormSchema,
  MdyFormValidatorFn,
  MdyFormValue,
  MdyGroupDescriptor,
  MdyTypedForm,
} from "@modyra/core";

// ─── Standard Schema v1 (structural copy — zero dependencies) ────────────────

export interface MdyStandardPathSegment {
  readonly key: PropertyKey;
}

export interface MdyStandardIssue {
  readonly message: string;
  readonly path?:
    | ReadonlyArray<PropertyKey | MdyStandardPathSegment>
    | undefined;
}

export interface MdyStandardSuccess<Output> {
  readonly value: Output;
  readonly issues?: undefined;
}

export interface MdyStandardFailure {
  readonly issues: ReadonlyArray<MdyStandardIssue>;
}

export type MdyStandardResult<Output> =
  | MdyStandardSuccess<Output>
  | MdyStandardFailure;

/** Structurally compatible with every Standard Schema v1 implementation. */
export interface MdyStandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) => MdyStandardResult<Output> | Promise<MdyStandardResult<Output>>;
    readonly types?:
      | { readonly input: Input; readonly output: Output }
      | undefined;
  };
}

/** Inferred input type of a Standard Schema. */
export type MdyStandardInput<TSchema extends MdyStandardSchemaV1> = NonNullable<
  TSchema["~standard"]["types"]
>["input"];

/** Inferred output type of a Standard Schema. */
export type MdyStandardOutput<TSchema extends MdyStandardSchemaV1> =
  NonNullable<TSchema["~standard"]["types"]>["output"];

// ─── Type-level tree (opt-in compile-time agreement) ─────────────────────────

/**
 * Maps a Standard Schema's output type to the Modyra descriptor tree that
 * mirrors it: records become groups, arrays become typed field arrays,
 * everything else becomes a leaf field. Use it to annotate the declared
 * fields so a drift between schema and tree does not compile:
 *
 * ```ts
 * const fields: MdyStandardSchemaTree<typeof userSchema> = {
 *   email: field<string | null>(null),
 *   address: group({ city: field<string | null>(null) }),
 * };
 * ```
 */
export type MdyStandardSchemaTree<TSchema extends MdyStandardSchemaV1> = {
  [K in keyof MdyStandardOutput<TSchema>]: MdyStandardNode<
    MdyStandardOutput<TSchema>[K]
  >;
};

type MdyStandardNode<TValue> = TValue extends ReadonlyArray<infer Item>
  ? MdyArrayDescriptor<MdyStandardItemNode<Item>>
  : TValue extends Record<string, unknown>
    ? MdyGroupDescriptor<{ [K in keyof TValue]: MdyStandardNode<TValue[K]> }>
    : MdyFieldDescriptor<TValue | null>;

type MdyStandardItemNode<Item> = Item extends Record<string, unknown>
  ? MdyGroupDescriptor<{ [K in keyof Item]: MdyStandardNode<Item[K]> }>
  : MdyFieldDescriptor<Item | null>;

// ─── Public API ──────────────────────────────────────────────────────────────

export interface MdyStandardFormOptions<
  TValue extends Record<string, unknown> = Record<string, unknown>,
> extends Omit<MdyCoreFormOptions<TValue>, "validators"> {
  /** Extra form-level validators, merged after the schema validator. */
  readonly validators?: ReadonlyArray<MdyFormValidatorFn<TValue>>;
}

/**
 * Builds a typed form from a user-declared field tree plus a Standard
 * Schema that validates the whole value:
 *
 * ```ts
 * const form = createStandardForm(userSchema, {
 *   email: field<string | null>(null),
 *   age: field<number>(18),
 * });
 * form.f.email.errors(); // schema issues surface on the matching field
 * ```
 */
export function createStandardForm<
  TSchema extends MdyStandardSchemaV1,
  S extends MdyFormSchema,
>(
  schema: TSchema,
  fields: S,
  options?: MdyStandardFormOptions<MdyFormValue<S>>,
): MdyTypedForm<S> {
  const tree = buildStandardTree(schema, fields);
  return createForm(tree, {
    ...options,
    validators: [buildStandardValidator(schema), ...(options?.validators ?? [])],
  });
}

/**
 * Returns the declared tree with leaf and array initials seeded from the
 * schema's defaults — whatever `~standard.validate({})` parses into
 * (object schemas never accept `undefined`, but an empty object lets
 * every default/optional piece fill itself in). Schemas with one
 * required top-level field reject `{}` wholesale and yield no defaults:
 * declare initials in `field()` as usual. Throws on async schemas
 * (fail fast, see header).
 */
export function buildStandardTree<S extends MdyFormSchema>(
  schema: MdyStandardSchemaV1,
  fields: S,
): S {
  const defaults = defaultsFromSchema(schema);
  return defaults === null ? fields : (patchInitials(fields, defaults) as S);
}

/**
 * Wraps the schema as a synchronous form-level validator: every issue
 * becomes a form error (`kind: "schema"`) attributed to its dotted field
 * path — visible via `form.errorsFor(path)`, the field's own error list
 * and `form.state.valid()`.
 *
 * Async schemas whose async branch is only reached for valid input slip
 * past the creation-time probe: when a run returns a Promise the form is
 * held invalid with a global error carrying the same clear message,
 * instead of throwing mid-keystroke.
 */
export function buildStandardValidator<
  TValue extends Record<string, unknown>,
>(schema: MdyStandardSchemaV1): MdyFormValidatorFn<TValue> {
  return (value) => {
    const result = schema["~standard"].validate(value);
    if (isPromise(result)) {
      return [{ path: null, kind: "schema", message: ASYNC_MESSAGE }];
    }
    if (result.issues) {
      return result.issues.map((issue) => ({
        path: issuePath(issue),
        kind: "schema",
        message: issue.message,
      }));
    }
    return [];
  };
}

// ─── Internals ───────────────────────────────────────────────────────────────

const ASYNC_MESSAGE =
  "@modyra/standard-schema: async schemas are not supported — " +
  "form-level validation is synchronous. Move async rules to field-level " +
  "asyncValidators or serverValidator().";

function asyncSchemaError(): Error {
  return new Error(ASYNC_MESSAGE);
}

function isPromise(value: unknown): value is Promise<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Whole-schema defaults: the output of validating `{}`, when the schema
 * accepts it (all fields optional/defaulted). Also the async probe:
 * an async `validate` always returns a Promise, even for `{}`.
 */
function defaultsFromSchema(
  schema: MdyStandardSchemaV1,
): Record<string, unknown> | null {
  let result: MdyStandardResult<unknown> | Promise<MdyStandardResult<unknown>>;
  try {
    result = schema["~standard"].validate({});
  } catch {
    return null;
  }
  if (isPromise(result)) throw asyncSchemaError();
  if (result.issues) return null;
  const value = (result as MdyStandardSuccess<unknown>).value;
  return isRecord(value) ? value : null;
}

/** Clones the tree, overriding initials with the schema defaults it finds. */
function patchInitials(
  fields: MdyFormSchema,
  defaults: Record<string, unknown>,
): MdyFormSchema {
  const out: Record<
    string,
    MdyAnyFieldDescriptor | MdyAnyGroupDescriptor | MdyAnyArrayDescriptor
  > = {};
  for (const [key, node] of Object.entries(fields)) {
    const fallback = defaults[key];
    if (node.kind === "group") {
      out[key] = {
        ...node,
        children: isRecord(fallback)
          ? patchInitials(node.children, fallback)
          : node.children,
      };
    } else if (node.kind === "array") {
      out[key] =
        fallback !== undefined && Array.isArray(fallback)
          ? { ...node, initial: fallback }
          : node;
    } else {
      out[key] = fallback !== undefined ? { ...node, initial: fallback } : node;
    }
  }
  return out as MdyFormSchema;
}

/** Issue path → dotted field path (`address.city`), null when global. */
function issuePath(issue: MdyStandardIssue): string | null {
  if (!issue.path || issue.path.length === 0) return null;
  return issue.path
    .map((segment) =>
      String(
        typeof segment === "object" && segment !== null && "key" in segment
          ? segment.key
          : segment,
      ),
    )
    .join(".");
}
