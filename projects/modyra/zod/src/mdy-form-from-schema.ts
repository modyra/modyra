import {
  field,
  group,
  mdyForm,
  MdyAnyFieldDescriptor,
  MdyAnyGroupDescriptor,
  MdyFieldDescriptor,
  MdyFormSchema,
  MdyFormValidatorFn,
  MdyFormValue,
  MdyGroupDescriptor,
  MdyTypedForm,
  MDY_MARKS_REQUIRED,
  ValidatorFn,
} from "@modyra/angular";
import { Injector } from "@angular/core";
import { z } from "zod";

/**
 * Maps a Zod object shape to an modyra schema tree at the type
 * level: nested `z.object()`s become groups, every other schema becomes a
 * leaf field typed `z.output<Piece> | null` (`null` = not filled in yet —
 * the Zod validators reject it at submit time when the piece is required).
 */
export type MdyZodSchemaTree<Shape extends z.ZodRawShape> = {
  [K in keyof Shape]: Shape[K] extends z.ZodObject<infer Inner>
    ? MdyGroupDescriptor<MdyZodSchemaTree<Inner>>
    : MdyFieldDescriptor<z.output<Shape[K]> | null>;
};

export interface MdyZodFormOptions<
  TValue extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly submitMode?: "valid-only" | "always" | "manual";
  readonly injector?: Injector;
  /** Extra form-level validators, merged after the schema's refinements. */
  readonly validators?: ReadonlyArray<MdyFormValidatorFn<TValue>>;
}

/**
 * Builds a typed form from a `z.object()` schema — one source of truth for
 * TypeScript types, validators, messages and required flags.
 *
 * ```ts
 * const form = mdyFormFromSchema(z.object({
 *   email: z.string().email(),
 *   age: z.number().min(18),
 *   address: z.object({ city: z.string(), zip: z.string() }),
 * }).refine(v => v.age > 20 || v.address.city !== "", {
 *   path: ["address", "city"],
 *   message: "City required under 21",
 * }));
 * ```
 *
 * - every leaf runs its own Zod piece as a field validator (messages from
 *   the schema); pieces that reject `undefined`/`null` mark the field
 *   required for aria
 * - defaults (`.default(...)`) and optionals seed the initial value
 * - object-level `.refine()`/`.superRefine()` issues become cross-field
 *   errors on the path they declare (or on the whole form without a path)
 */
export function mdyFormFromSchema<T extends z.ZodObject>(
  schema: T,
  options?: MdyZodFormOptions<MdyFormValue<MdyZodSchemaTree<T["shape"]>>>,
): MdyTypedForm<MdyZodSchemaTree<T["shape"]>> {
  const tree = buildTree(schema) as MdyZodSchemaTree<T["shape"]>;
  const refinementValidator = buildRefinementValidator<
    MdyFormValue<MdyZodSchemaTree<T["shape"]>>
  >(schema);
  return mdyForm(tree, {
    ...(options?.submitMode !== undefined && { submitMode: options.submitMode }),
    ...(options?.injector !== undefined && { injector: options.injector }),
    validators: [refinementValidator, ...(options?.validators ?? [])],
  });
}

// ─── Runtime tree construction ───────────────────────────────────────────────

function buildTree(objectSchema: z.ZodObject): MdyFormSchema {
  const out: Record<string, MdyAnyFieldDescriptor | MdyAnyGroupDescriptor> = {};
  for (const [key, piece] of Object.entries<z.ZodType>(objectSchema.shape)) {
    out[key] =
      piece instanceof z.ZodObject
        ? group(buildTree(piece))
        : field<unknown>(initialFor(piece), [pieceValidator(piece)]);
  }
  return out as MdyFormSchema;
}

/** Initial value: what the piece parses `undefined` into (default/optional), else null. */
function initialFor(piece: z.ZodType): unknown {
  const parsed = piece.safeParse(undefined);
  return parsed.success ? (parsed.data ?? null) : null;
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

function buildRefinementValidator<
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
