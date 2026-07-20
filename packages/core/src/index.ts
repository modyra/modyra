/**
 * @modyra/core — the framework-agnostic form engine.
 *
 * Typed field trees, sync/async/cross-field validation, dirty/touched
 * tracking, drafts, undo/redo and change tracking, all written against a
 * minimal reactive contract ({@link MdyReactivity}). Framework packages
 * (e.g. `@modyra/angular` for Angular) bind that contract to their native
 * signals; `vanillaReactivity()` runs the same engine in Node, CLIs and
 * plain unit tests.
 */
export {
  vanillaReactivity
} from "./reactivity.js";
export type {
  MdyEffectRef,
  MdyOnCleanup,
  MdyReactivity,
  MdySignal,
  MdyWritableSignal
} from "./reactivity.js";

export * from "./types.js";

export {
  compose,
  composeFirst,
  crossField,
  email,
  max,
  maxLength,
  MDY_MARKS_REQUIRED,
  min,
  minLength,
  pattern,
  required
} from "./validators.js";

export { serverValidator } from "./server-validator.js";
export type { MdyServerValidatorOptions } from "./server-validator.js";

export { isSafeFieldPath } from "./path-utils.js";
export { MdyFormEngine } from "./form-engine.js";
export type {
  MdyDraftOptions,
  MdyDraftStorage,
  MdyFormEngineOptions,
  MdyFormRegistry
} from "./form-engine.js";

export {
  array,
  createForm,
  field,
  group,
  MdyTypedForm,
  MdyTypedFormBase,
} from "./typed-form.js";
export type {
  MdyAnyArrayDescriptor,
  MdyAnyFieldDescriptor,
  MdyAnyGroupDescriptor,
  MdyArrayDescriptor,
  MdyArrayHandle,
  MdyArrayItemValue,
  MdyCoreFormOptions,
  MdyFieldDescriptor,
  MdyFieldHandle,
  MdyFieldHandleTree,
  MdyFieldOptions,
  MdyFormPatch,
  MdyFormSchema,
  MdyFormValue,
  MdyGroupDescriptor,
  MdyItemHandleTree,
  MdyTypedFormBaseOptions,
  MdyWiden
} from "./typed-form.js";

// ─── Shared headless logic (also available as subpath imports) ───────────────
export * from "./date-locale.js";
export * from "./date-utils.js";
export * from "./dynamic-config.js";
export * from "./i18n.js";
export * from "./options-utils.js";
export * from "./overlay-position.js";
export * from "./serialize.js";
export * from "./time-utils.js";

// ─── Keyboard interaction logic ───────────────────────────────────────────────
export * from "./keyboard.js";

// ─── Framework-agnostic devtools ─────────────────────────────────────────────
export * from "./devtools.js";

// ─── Shared SVG icon library ─────────────────────────────────────────────────
export * from "./icons.js";
