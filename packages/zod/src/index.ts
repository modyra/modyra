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
  MdyArrayDescriptor,
  MdyCoreFormOptions,
  MdyFieldDescriptor,
  MdyFormSchema,
  MdyFormValidatorFn,
  MdyFormValue,
  MdyGroupDescriptor,
  MdyTypedForm,
  MDY_MARKS_REQUIRED,
  ValidatorFn,
} from "@modyra/core";
import { z } from "zod";

/** Maps a Zod array's element schema to a Modyra array item descriptor. */
export type MdyZodItemDescriptor<Elem extends z.ZodType> =
  Elem extends z.ZodObject<infer Inner>
    ? MdyGroupDescriptor<MdyZodSchemaTree<Inner>>
    : MdyFieldDescriptor<z.output<Elem> | null>;

/**
 * Maps a Zod object shape to a Modyra schema tree at the type level:
 * nested `z.object()`s become groups, `z.array()`s become typed field
 * arrays, every other schema becomes a leaf field typed
 * `z.output<Piece> | null` (`null` = not filled in yet — the Zod
 * validators reject it at submit time when the piece is required).
 */
export type MdyZodSchemaTree<Shape extends z.ZodRawShape> = {
  [K in keyof Shape]: Shape[K] extends z.ZodObject<infer Inner>
    ? MdyGroupDescriptor<MdyZodSchemaTree<Inner>>
    : Shape[K] extends z.ZodArray<infer Elem extends z.ZodType>
    ? MdyArrayDescriptor<MdyZodItemDescriptor<Elem>>
    : MdyFieldDescriptor<z.output<Shape[K]> | null>;
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

/** Zod object → Modyra schema tree (fields with Zod-backed validators). */
export function buildZodTree(objectSchema: z.ZodObject): MdyFormSchema {
  const out: Record<
    string,
    MdyAnyFieldDescriptor | MdyAnyGroupDescriptor | MdyAnyArrayDescriptor
  > = {};
  for (const [key, piece] of Object.entries<z.ZodType>(objectSchema.shape)) {
    out[key] = buildZodNode(piece);
  }
  return out as MdyFormSchema;
}

function buildZodNode(
  piece: z.ZodType,
): MdyAnyFieldDescriptor | MdyAnyGroupDescriptor | MdyAnyArrayDescriptor {
  if (piece instanceof z.ZodObject) {
    return group(buildZodTree(piece));
  }
  if (piece instanceof z.ZodArray) {
    const element = piece.element as z.ZodType;
    const item =
      element instanceof z.ZodObject
        ? group(buildZodTree(element))
        : field<unknown>(initialFor(element), [pieceValidator(element)]);
    // pieceValidator's ValidatorFn<unknown> accepts any value, including
    // the array itself — safe to reuse as the array-level validator.
    return array(item, {
      initial: initialForArray(piece),
      validators: [pieceValidator(piece)],
    });
  }
  return field<unknown>(initialFor(piece), [pieceValidator(piece)]);
}

/** Initial value: what the piece parses `undefined` into (default/optional), else null. */
function initialFor(piece: z.ZodType): unknown {
  const parsed = piece.safeParse(undefined);
  return parsed.success ? (parsed.data ?? null) : null;
}

/** Array initial value: what the piece parses `undefined` into (default/optional), else []. */
function initialForArray(piece: z.ZodType): ReadonlyArray<unknown> {
  const parsed = piece.safeParse(undefined);
  return parsed.success && Array.isArray(parsed.data) ? parsed.data : [];
}

/**
 * Wraps a Zod piece as a field validator. When the piece rejects both
 * `undefined` and `null` it is semantically required, so the validator is
 * tagged with MDY_MARKS_REQUIRED and the field drives aria-required.
 */
function pieceValidator(piece: z.ZodType): ValidatorFn<unknown> {
  // The form's "empty" sentinel is null, but z.string().optional() only
  // accepts undefined — treat null as undefined for such pieces.
  const acceptsUndefined = piece.safeParse(undefined).success;
  const fn: ValidatorFn<unknown> = (value) => {
    const result = piece.safeParse(normalizeLeaf(value, acceptsUndefined));
    return result.success ? [] : result.error.issues.map((i) => i.message);
  };
  const requiredPiece =
    !acceptsUndefined && !piece.safeParse(null).success;
  return requiredPiece
    ? Object.assign(fn, { [MDY_MARKS_REQUIRED]: true })
    : fn;
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
