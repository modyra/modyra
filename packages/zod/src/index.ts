/**
 * @modyra/zod — framework-agnostic Zod adapter for the Modyra form engine.
 *
 * One source of truth for TypeScript types, validators, messages and
 * required flags: nested `z.object()`s become groups, defaults/optionals
 * seed initial values, pieces that reject empty values drive `required`,
 * and object-level `refine()`/`superRefine()` issues surface as cross-field
 * errors. Framework packages reuse {@link buildZodTree} and
 * {@link buildZodRefinementValidator} to offer the same API on their own
 * reactivity; {@link createZodForm} runs it anywhere (Node included).
 */
import {
  array,
  createForm,
  field,
  group,
  MdyAnyArrayDescriptor,
  MdyAnyFieldDescriptor,
  MdyAnyGroupDescriptor,
  MdyAnyRecordDescriptor,
  MdyArrayDescriptor,
  MdyCoreFormOptions,
  MdyFieldDescriptor,
  MdyFormError,
  MdyFormSchema,
  MdyFormValidatorFn,
  MdyFormValue,
  MdyGroupDescriptor,
  MdyRecordDescriptor,
  MdyTypedForm,
  record,
  withFacts,
  type MdyValidatorFacts,
  ValidatorFn,
} from "@modyra/core";
import { z } from "zod";

/**
 * Maps the schema of a collection's element — an array's item, a record's value — to a row
 * descriptor.
 *
 * A row is whatever a schema key is: an object is a group, a collection is a collection of its own,
 * and everything else is a leaf. `z.record(z.array(z.object()))` describes rows that hold rows, and
 * mapping the inner collection to a leaf would hand the consumer one opaque value where the schema
 * declared a list.
 */
export type MdyZodItemDescriptor<Elem extends z.ZodType> =
  Elem extends z.ZodObject<infer Inner>
    ? MdyGroupDescriptor<MdyZodSchemaTree<Inner>>
    : Elem extends z.ZodArray<infer Item extends z.ZodType>
    ? MdyArrayDescriptor<MdyZodItemDescriptor<Item>>
    : Elem extends z.ZodRecord<infer _K, infer Value extends z.ZodType>
    ? MdyRecordDescriptor<MdyZodItemDescriptor<Value>>
    : MdyFieldDescriptor<z.input<Elem> | null>;

/**
 * Maps a Zod object shape to a Modyra schema tree at the type level:
 * nested `z.object()`s become groups, `z.array()`s become typed field
 * arrays, `z.record()`s become keyed collections, every other schema
 * becomes a leaf field typed `z.input<Piece> | null` (`null` = not filled in
 * yet — the Zod validators reject it at submit time when the piece is required).
 *
 * **Input, not output.** A form holds what a person typed and what a server sent, and it validates
 * that against the schema; it does not run the schema's transformations — `.trim()`,
 * `.toLowerCase()`, `.transform()`, `z.coerce.*`. Typed as `z.output` the leaf promised the value
 * *after* a transformation nobody applied, so `z.coerce.number()` declared `number | null` over a
 * field holding `"42"`, and the type was wrong in the direction a consumer would trust.
 *
 * Transforming on the way in was the alternative and it costs more than it buys: `.trim()` applied
 * to every keystroke takes the space out of "a b" while it is being typed.
 */
export type MdyZodSchemaTree<Shape extends z.ZodRawShape> = {
  [K in keyof Shape]: Shape[K] extends z.ZodObject<infer Inner>
    ? MdyGroupDescriptor<MdyZodSchemaTree<Inner>>
    : Shape[K] extends z.ZodArray<infer Elem extends z.ZodType>
    ? MdyArrayDescriptor<MdyZodItemDescriptor<Elem>>
    : Shape[K] extends z.ZodRecord<infer _Key, infer Value extends z.ZodType>
    ? MdyRecordDescriptor<MdyZodItemDescriptor<Value>>
    : MdyFieldDescriptor<z.input<Shape[K]> | null>;
};

export interface MdyZodFormOptions<
  TValue extends Record<string, unknown> = Record<string, unknown>,
> extends Omit<MdyCoreFormOptions<TValue>, "validators"> {
  /** Extra form-level validators, merged after the schema's refinements. */
  readonly validators?: ReadonlyArray<MdyFormValidatorFn<TValue>>;
}

/**
 * Builds a typed form from a `z.object()` schema, on any reactivity
 * (default: the core's vanilla graph).
 *
 * ```ts
 * const form = createZodForm(z.object({
 *   email: z.string().email(),
 *   address: z.object({ city: z.string().min(1) }),
 * }));
 * form.f.address.city.errors(); // messages come from the Zod schema
 * ```
 */
export function createZodForm<T extends z.ZodObject>(
  schema: T,
  options?: MdyZodFormOptions<MdyFormValue<MdyZodSchemaTree<T["shape"]>>>,
): MdyTypedForm<MdyZodSchemaTree<T["shape"]>> {
  assertObjectSchema(schema, "createZodForm");
  const tree = buildZodTree(schema) as MdyZodSchemaTree<T["shape"]>;
  const refinementValidator = buildZodRefinementValidator<
    MdyFormValue<MdyZodSchemaTree<T["shape"]>>
  >(schema);
  return createForm(tree, {
    ...options,
    validators: [refinementValidator, ...(options?.validators ?? [])],
  });
}

// ─── Runtime tree construction ───────────────────────────────────────────────

/**
 * A schema that is not an object has no names to give a form.
 *
 * `z.array(...)`, `z.string()` and `z.tuple([...])` are legitimate Zod schemas and none of them
 * describes a form: a form has fields, and a field has a name. Refusing them is right — what arrived
 * instead was `TypeError: Cannot convert undefined or null to object`, from reading `.shape` off
 * something that has none. It named neither the schema nor the call, and three different mistakes
 * produced one message indistinguishable from a defect in this bridge.
 */
function assertObjectSchema(schema: z.ZodType, method: string): asserts schema is z.ZodObject {
  const shape = (schema as Partial<z.ZodObject>).shape;
  if (shape !== null && typeof shape === "object") return;
  const named = (schema as { readonly _def?: { readonly typeName?: unknown } })._def?.typeName;
  throw new Error(
    `[modyra] ${method} takes a Zod object schema${typeof named === "string" ? `, received ${named}` : ""}. ` +
    "A form has named fields, so the schema it is built from has to name them: wrap the shape in z.object({ … }).",
  );
}

/** Zod object → Modyra schema tree (fields with Zod-backed validators). */
export function buildZodTree(objectSchema: z.ZodObject): MdyFormSchema {
  assertObjectSchema(objectSchema, "buildZodTree");
  const out: Record<
    string,
    | MdyAnyFieldDescriptor
    | MdyAnyGroupDescriptor
    | MdyAnyArrayDescriptor
    | MdyAnyRecordDescriptor
  > = {};
  for (const [key, piece] of Object.entries<z.ZodType>(objectSchema.shape)) {
    out[key] = buildZodNode(piece);
  }
  return out as MdyFormSchema;
}

function buildZodNode(
  piece: z.ZodType,
):
  | MdyAnyFieldDescriptor
  | MdyAnyGroupDescriptor
  | MdyAnyArrayDescriptor
  | MdyAnyRecordDescriptor {
  if (piece instanceof z.ZodObject) {
    return group(buildZodTree(piece));
  }
  if (piece instanceof z.ZodArray) {
    // pieceValidator's ValidatorFn<unknown> accepts any value, including
    // the collection itself — safe to reuse as the collection-level validator.
    const initial = initialForArray(piece);
    return array(rowDescriptor(piece.element as z.ZodType), {
      initial,
      validators: [pieceValidator(piece, initial)],
    });
  }
  if (piece instanceof z.ZodRecord) {
    // A record's rows are keyed by data, and the engine has held that since keyed collections
    // existed. Leaving it a leaf made the value a single opaque object no renderer could draw and
    // no row could be added to — and, since a record rejects `null`, a form invalid from its first
    // moment. The keys the schema constrains stay the schema's business: the whole-piece validator
    // is on the collection, so a key it refuses is refused there.
    const initial = initialForRecord(piece);
    return record(rowDescriptor(piece.valueType as z.ZodType), {
      initial,
      validators: [pieceValidator(piece, initial)],
    });
  }
  const empty = initialFor(piece);
  return field<unknown>(empty, [pieceValidator(piece, empty)]);
}

/** A collection's row is read exactly like a schema key: the row of a row is a row too. */
function rowDescriptor(element: z.ZodType):
  | MdyAnyFieldDescriptor
  | MdyAnyGroupDescriptor
  | MdyAnyArrayDescriptor
  | MdyAnyRecordDescriptor {
  return buildZodNode(element);
}

/**
 * Initial value: what a field of this piece holds before anybody fills it.
 *
 * A form needs a representation for "not filled in yet", and the honest one is the one the piece
 * itself accepts. `null` cannot be it for every piece: `z.string()` refuses `null` and accepts `""`,
 * so seeding `null` makes a form invalid on arrival in the schema's own vocabulary — and then valid
 * two keystrokes later, when the user clears the field back to `""`. One emptiness, two answers,
 * and the permissive one is the state a person reaches by using the form.
 *
 * The order below is the order of the value contracts: absence first, because a piece that takes
 * `null` says that absence is one of its values; then the empty a text-shaped piece holds; then the
 * empty a boolean holds. A piece that accepts none of them has no representation for empty — a
 * number, an enum — and keeps `null`, which it refuses at the start and refuses again when the
 * control is cleared. The same answer both times is the property this is for.
 */
function initialFor(piece: z.ZodType): unknown {
  const parsed = piece.safeParse(undefined);
  // A default: the piece turns absence into a value, and that value is the seed.
  if (parsed.success && parsed.data !== undefined) return parsed.data;
  if (piece.safeParse(null).success) return null;
  if (holdsEmpty(piece, "")) return "";
  if (holdsEmpty(piece, false)) return false;
  // An optional accepts absence and nothing else here: it parses `undefined` into `undefined`, with
  // no `data` at all. Read as a default, that answered `null` — a value the piece refuses — so a
  // form of optional fields called itself valid while holding four values its own schema rejects,
  // and the last thing a consumer does before sending is parse what the form holds.
  if (parsed.success) return undefined;
  return null;
}

/**
 * Whether a value is the piece's own empty — the value the control hands back when a person clears
 * the field, rather than a value of some other type.
 *
 * Accepted is the plain case. Refused *for a reason other than its type* is the one that matters:
 * `z.string().min(1)` refuses `""` because it is too short, not because it is not a string, so `""`
 * is still what the field holds when nobody has typed — and seeding it makes the form say the same
 * thing at the start as it says after the user empties the box. A refusal naming the type means the
 * piece holds something else entirely, and the field's empty is absence.
 */
function holdsEmpty(piece: z.ZodType, candidate: "" | false): boolean {
  const result = piece.safeParse(candidate);
  if (result.success) return true;
  // Refused for what the value *is*, not for what type it is. `too_small` and `too_big` are the
  // library's own length checks; `custom` is a `.refine()`, which is what an author reaches for
  // whenever the rule is not one of the built-ins — a consent to tick, a code with a checksum, a
  // list that must contain a member. Reading only the first two made the seed depend on **how** a
  // rule was written rather than on what it says: the same field with `.min(2)` started at `""` and
  // with `.refine()` at `null`, where the author's own message never appeared either, because a
  // value of the wrong type never reaches the predicate carrying it.
  return result.error.issues.every(
    (issue) => issue.code === "too_small" || issue.code === "too_big" || issue.code === "custom",
  );
}

/** Array initial value: what the piece parses `undefined` into (default/optional), else []. */
function initialForArray(piece: z.ZodType): ReadonlyArray<unknown> {
  const parsed = piece.safeParse(undefined);
  return parsed.success && Array.isArray(parsed.data) ? parsed.data : [];
}

/** Record initial value: the same rule one collection over — a default if the piece has one, else no rows. */
function initialForRecord(piece: z.ZodType): Readonly<Record<string, unknown>> {
  const parsed = piece.safeParse(undefined);
  return parsed.success && parsed.data !== null && typeof parsed.data === "object" && !Array.isArray(parsed.data)
    ? (parsed.data as Record<string, unknown>)
    : {};
}

/**
 * Wraps a Zod piece as a field validator.
 *
 * `required` is the statement that leaving the field alone is not an answer, and what the field
 * holds when it is left alone is `empty` — so that, and not the form's `null` sentinel, is what
 * decides it. A piece accepting its own empty asks for nothing: `z.string()` takes `""`, and a
 * field marked required while `""` passes its own validator says two things at once to the same
 * reader, one through `aria-required` and one through `valid`.
 */
function pieceValidator(piece: z.ZodType, empty: unknown): ValidatorFn<unknown> {
  // The form's "empty" sentinel is null, but z.string().optional() only
  // accepts undefined — treat null as undefined for such pieces.
  const acceptsUndefined = piece.safeParse(undefined).success;
  const fn: ValidatorFn<unknown> = (value) => {
    const result = piece.safeParse(normalizeLeaf(value, acceptsUndefined));
    return result.success ? [] : result.error.issues.map((i) => i.message);
  };
  const requiredPiece = !piece.safeParse(normalizeLeaf(empty, acceptsUndefined)).success;
  return withFacts(fn, {
    ...(requiredPiece ? { required: true } : {}),
    ...factsOfPiece(piece),
  });
}

/**
 * What a Zod piece states that an input can carry.
 *
 * Read from the piece's own checks rather than re-declared: a schema that already says
 * `.min(3).max(8)` should reach the keyboard, and asking the author to write the same numbers again
 * on the control is how the two come to disagree.
 *
 * Only the checks with a native counterpart are read. Everything else — refinements, transforms,
 * formats a browser has no attribute for — stays what it already was: a rule that runs.
 */
function factsOfPiece(piece: z.ZodType): MdyValidatorFacts {
  const definition = (piece as unknown as { def?: { checks?: readonly unknown[] } }).def;
  const checks = definition?.checks ?? [];
  const facts: Record<string, unknown> = {};

  for (const raw of checks) {
    const check = ((raw as { _zod?: { def?: Record<string, unknown> } })._zod?.def ??
      raw) as Record<string, unknown>;
    switch (check["check"]) {
      case "min_length":
        facts["minLength"] = check["minimum"];
        break;
      case "max_length":
        facts["maxLength"] = check["maximum"];
        break;
      case "greater_than":
        // Zod's exclusive bound has no native counterpart: `min` on an input is inclusive, and
        // offering it would admit the one value the schema refuses.
        if (check["inclusive"] === true) facts["min"] = check["value"];
        break;
      case "less_than":
        if (check["inclusive"] === true) facts["max"] = check["value"];
        break;
      case "number_format":
        if (check["format"] === "safeint" || check["format"] === "int") facts["step"] = 1;
        break;
      case "string_format":
        if (check["format"] === "regex") {
          const expression = check["pattern"];
          if (expression instanceof RegExp && expression.flags === "") {
            facts["pattern"] = expression.source;
          }
        }
        break;
      default:
        break;
    }
  }

  return facts as MdyValidatorFacts;
}

function normalizeLeaf(value: unknown, acceptsUndefined: boolean): unknown {
  return value === null && acceptsUndefined ? undefined : value;
}

/**
 * Recursively replaces null with undefined on leaves whose piece accepts
 * undefined, so whole-schema parsing (refinements) sees the same values the
 * per-field validators accepted.
 */
function normalizeForParse(
  objectSchema: z.ZodObject,
  value: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, piece] of Object.entries<z.ZodType>(objectSchema.shape)) {
    const v = value[key];
    if (piece instanceof z.ZodObject) {
      out[key] =
        v !== null && typeof v === "object"
          ? normalizeForParse(piece, v as Record<string, unknown>)
          : v;
    } else {
      out[key] = normalizeLeaf(v, piece.safeParse(undefined).success);
    }
  }
  return out;
}

// ─── Object-level refinements → cross-field errors ───────────────────────────

/** Object-level `refine`/`superRefine` issues as a form-level validator. */
export function buildZodRefinementValidator<
  TValue extends Record<string, unknown>,
>(schema: z.ZodObject): MdyFormValidatorFn<TValue> {
  return (value) => {
    const normalized = normalizeForParse(schema, value);
    const result = schema.safeParse(normalized);
    if (result.success) return [];
    return result.error.issues
      .filter((issue) => issue.code === "custom")
      .filter((issue) => !isCoveredByPiece(schema, normalized, issue))
      .map((issue) => ({
        path: issue.path.length > 0 ? issue.path.join(".") : null,
        kind: "schema",
        message: issue.message,
      }));
  };
}

/**
 * A custom issue whose path points at a leaf already re-reported by that
 * leaf's own piece validator (e.g. `z.string().refine(...)`) must not be
 * duplicated at form level.
 */
function isCoveredByPiece(
  schema: z.ZodObject,
  value: Record<string, unknown>,
  issue: { readonly path: ReadonlyArray<PropertyKey>; readonly message: string },
): boolean {
  if (issue.path.length === 0) return false;
  let piece: z.ZodType = schema;
  for (const segment of issue.path) {
    if (!(piece instanceof z.ZodObject)) return false;
    const next = (piece.shape as Record<string, z.ZodType | undefined>)[
      String(segment)
    ];
    if (!next) return false;
    piece = next;
  }
  if (piece instanceof z.ZodObject) return false;
  const leafValue = issue.path.reduce<unknown>(
    (acc, segment) =>
      acc !== null && typeof acc === "object"
        ? (acc as Record<string, unknown>)[String(segment)]
        : undefined,
    value,
  );
  const parsed = piece.safeParse(leafValue);
  return (
    !parsed.success &&
    parsed.error.issues.some((i) => i.message === issue.message)
  );
}

// ─── Server-side validation ───────────────────────────────────────────────────

/**
 * Validates a raw payload (e.g. a parsed request body) against the same
 * schema used on the client. Errors are shaped exactly like the ones a
 * `form.submit()` action returns, so one handler feeds both the client
 * form's error display and a direct/forged API request's rejection.
 */
export function serverValidate(
  schema: z.ZodObject,
  payload: unknown,
): ReadonlyArray<MdyFormError> {
  const result = schema.safeParse(payload);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : null,
    kind: "schema",
    message: issue.message,
  }));
}
