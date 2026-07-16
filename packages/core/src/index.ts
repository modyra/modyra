/**
 * @modyra/core — the framework-agnostic form engine.
 *
 * Typed field trees, sync/async/cross-field validation, dirty/touched
 * tracking, drafts, undo/redo and change tracking, all written against a
 * minimal reactive contract ({@link MdyReactivity}). Framework packages
 * (e.g. `@modyra/forms` for Angular) bind that contract to their native
 * signals; `vanillaReactivity()` runs the same engine in Node, CLIs and
 * plain unit tests.
 */
export {
  vanillaReactivity,
} from "./reactivity.js";
export type {
  MdyEffectRef,
  MdyOnCleanup,
  MdyReactivity,
  MdySignal,
  MdyWritableSignal,
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
  required,
} from "./validators.js";

export { MdyFormEngine } from "./form-engine.js";
export type {
  MdyDraftOptions,
  MdyDraftStorage,
  MdyFormEngineOptions,
  MdyFormRegistry,
} from "./form-engine.js";

export { createForm, field, group, MdyTypedForm } from "./typed-form.js";
export type {
  MdyAnyFieldDescriptor,
  MdyAnyGroupDescriptor,
  MdyCoreFormOptions,
  MdyFieldDescriptor,
  MdyFieldHandle,
  MdyFieldHandleTree,
  MdyFieldOptions,
  MdyFormPatch,
  MdyFormSchema,
  MdyFormValue,
  MdyGroupDescriptor,
  MdyWiden,
} from "./typed-form.js";

// ─── Shared headless logic (also available as subpath imports) ───────────────
export * from "./date-utils.js";
export * from "./time-utils.js";
export * from "./overlay-position.js";
export * from "./options-utils.js";
export * from "./serialize.js";
export * from "./dynamic-config.js";
export * from "./i18n.js";
