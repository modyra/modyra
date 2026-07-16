/*
 * Public API Surface of @modyra/forms/zod
 *
 * Optional Zod adapter: derive a fully typed MdyTypedForm from a z.object()
 * schema — types, validators, required flags and cross-field refinements
 * from a single source of truth. Requires the `zod` peer (>= 3.25).
 */

export { mdyFormFromSchema } from "./mdy-form-from-schema";
export type { MdyZodFormOptions, MdyZodSchemaTree } from "./mdy-form-from-schema";
