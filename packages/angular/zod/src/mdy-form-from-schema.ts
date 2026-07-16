import { Injector } from "@angular/core";
import {
  mdyForm,
  MdyFormValidatorFn,
  MdyFormValue,
  MdyTypedForm,
} from "@modyra/angular";
import {
  buildZodRefinementValidator,
  buildZodTree,
  MdyZodSchemaTree,
} from "@modyra/zod";
import { z } from "zod";

// The Zod introspection (tree building, piece validators, required
// detection, refinement → cross-field mapping) is framework-agnostic and
// lives in @modyra/zod; this entry point binds it to the Angular typed
// form so the result runs on Angular signals.
export type { MdyZodSchemaTree } from "@modyra/zod";

export interface MdyZodFormOptions<
  TValue extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly submitMode?: "valid-only" | "always" | "manual";
  readonly injector?: Injector;
  /** Extra form-level validators, merged after the schema's refinements. */
  readonly validators?: ReadonlyArray<MdyFormValidatorFn<TValue>>;
}

/**
 * Builds an Angular typed form from a `z.object()` schema — one source of
 * truth for TypeScript types, validators, messages and required flags.
 * See `@modyra/zod` for the shared semantics; bind the result with
 * `[form]` and `[field]` exactly like `mdyForm()`.
 */
export function mdyFormFromSchema<T extends z.ZodObject>(
  schema: T,
  options?: MdyZodFormOptions<MdyFormValue<MdyZodSchemaTree<T["shape"]>>>,
): MdyTypedForm<MdyZodSchemaTree<T["shape"]>> {
  const tree = buildZodTree(schema) as MdyZodSchemaTree<T["shape"]>;
  const refinementValidator = buildZodRefinementValidator<
    MdyFormValue<MdyZodSchemaTree<T["shape"]>>
  >(schema);
  return mdyForm(tree, {
    ...(options?.submitMode !== undefined && { submitMode: options.submitMode }),
    ...(options?.injector !== undefined && { injector: options.injector }),
    validators: [refinementValidator, ...(options?.validators ?? [])],
  });
}
