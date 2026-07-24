/**
 * Plan section 11 "Preview reads model/Contract, not generated source" —
 * builds a REAL, running @modyra/core form directly from a Studio project:
 * actual `field()`/`group()`/`array()`/`createForm()` calls against actual
 * imported validator functions, never a reimplementation and never text
 * generation (that is studio-codegen's job, for a different output).
 */
import {
  array,
  createForm,
  crossField,
  email,
  eachOneOf,
  field,
  group,
  max,
  maxLength,
  min,
  minLength,
  oneOf,
  pattern,
  required,
  serverValidator,
  type MdyDraftStorage,
  type MdyFormSchema,
  type MdyReactivity,
  type MdyTypedForm,
  type ValidatorFn,
} from "@modyra/core";
import {
  buildIndexes,
  type ArrayNode,
  type FieldNode,
  type GroupNode,
  type MdyStudioProject,
  type StudioArrayValidator,
  type StudioDiagnostic,
  type StudioFieldValidator,
  type StudioIndexes,
  type StudioSchemaNode,
} from "@modyra/studio-model";
import { evaluateExpression } from "./expression-evaluator.js";
import { createMockAsyncValidator, type MockServerConfig } from "./mock-server.js";

export interface LiveFormResult {
  form: MdyTypedForm<MdyFormSchema> | null;
  diagnostics: StudioDiagnostic[];
}

function mapFieldValidator(v: StudioFieldValidator, node: FieldNode, diagnostics: StudioDiagnostic[]): ValidatorFn<never> | null {
  switch (v.kind) {
    case "required":
      return required(v.message) as ValidatorFn<never>;
    case "email":
      return email(v.message) as ValidatorFn<never>;
    case "min":
      return typeof v.value === "number" ? (min(v.value, v.message) as ValidatorFn<never>) : null;
    case "max":
      return typeof v.value === "number" ? (max(v.value, v.message) as ValidatorFn<never>) : null;
    case "minLength":
      return typeof v.value === "number" ? (minLength(v.value, v.message) as ValidatorFn<never>) : null;
    case "maxLength":
      return typeof v.value === "number" ? (maxLength(v.value, v.message) as ValidatorFn<never>) : null;
    case "pattern":
      return typeof v.pattern === "string" ? (pattern(new RegExp(v.pattern), v.message) as ValidatorFn<never>) : null;
    case "oneOf":
      return Array.isArray(v.value) ? (oneOf(v.value, v.message) as ValidatorFn<never>) : null;
    case "eachOneOf":
      return Array.isArray(v.value) ? (eachOneOf(v.value, v.message) as ValidatorFn<never>) : null;
    case "customRef":
      diagnostics.push({
        code: "PREVIEW_CUSTOM_VALIDATOR_STUB",
        severity: "info",
        message: `Custom validator on "${node.name}" has no live implementation in preview — treated as always-valid`,
        nodeId: node.id,
        validatorId: v.id,
      });
      return null;
    default:
      diagnostics.push({ code: "UNSUPPORTED_VALIDATOR", severity: "warning", message: `Validator kind "${v.kind}" is not supported by preview and was omitted`, nodeId: node.id, validatorId: v.id });
      return null;
  }
}

function mapArrayValidator(v: StudioArrayValidator, node: ArrayNode, diagnostics: StudioDiagnostic[]): ValidatorFn<never> | null {
  if (v.kind === "min" && typeof v.value === "number") return minLength(v.value, v.message) as ValidatorFn<never>;
  if (v.kind === "max" && typeof v.value === "number") return maxLength(v.value, v.message) as ValidatorFn<never>;
  diagnostics.push({ code: "UNSUPPORTED_VALIDATOR", severity: "warning", message: `Array validator kind "${v.kind}" is not supported by preview and was omitted`, nodeId: node.id, validatorId: v.id });
  return null;
}

function mapField(node: FieldNode, idx: StudioIndexes, diagnostics: StudioDiagnostic[], mockConfigByImplId: Record<string, MockServerConfig>) {
  const validators = node.validators
    .map((v) => mapFieldValidator(v, node, diagnostics))
    .filter((v): v is ValidatorFn<never> => v !== null);

  if (!node.serverValidator) return field(node.initialValue as never, validators);

  const sv = node.serverValidator;
  const dependsOn = sv.dependencies.map((d) => idx.pathByNode.get(d.nodeId) ?? d.nodeId);
  const when = sv.skipWhen
    ? (value: unknown) => !evaluateExpression(sv.skipWhen!, value, (id) => (id === node.id ? "" : id))
    : undefined;
  return field(
    node.initialValue as never,
    validators,
    serverValidator(createMockAsyncValidator(mockConfigByImplId[sv.implementationRef] ?? {}), {
      debounceMs: sv.debounceMs,
      timeoutMs: sv.timeoutMs,
      dependsOn,
      when,
    }) as never,
  );
}

function mapGroup(node: GroupNode, idx: StudioIndexes, diagnostics: StudioDiagnostic[], mockConfigByImplId: Record<string, MockServerConfig>) {
  const children: Record<string, unknown> = {};
  for (const child of node.children) children[child.name] = mapNode(child, idx, diagnostics, mockConfigByImplId);
  return group(children as MdyFormSchema);
}

function mapArray(node: ArrayNode, idx: StudioIndexes, diagnostics: StudioDiagnostic[], mockConfigByImplId: Record<string, MockServerConfig>) {
  const item = mapNode(node.item, idx, diagnostics, mockConfigByImplId);
  const validators = node.validators
    .map((v) => mapArrayValidator(v, node, diagnostics))
    .filter((v): v is ValidatorFn<never> => v !== null);
  return array(item as never, { initial: node.initialRows, validators: validators as ValidatorFn<readonly unknown[]>[] });
}

function mapNode(node: StudioSchemaNode, idx: StudioIndexes, diagnostics: StudioDiagnostic[], mockConfigByImplId: Record<string, MockServerConfig>): unknown {
  if (node.node === "field") return mapField(node, idx, diagnostics, mockConfigByImplId);
  if (node.node === "group") return mapGroup(node, idx, diagnostics, mockConfigByImplId);
  return mapArray(node, idx, diagnostics, mockConfigByImplId);
}

export interface BuildLiveFormOptions {
  /** Server mock config (plan §11: delay/valid-values/error/timeout/network-failure) per StudioImplementationRef id; a serverValidator with no entry gets defaults (300ms delay, always valid). */
  readonly mockConfigByImplId?: Record<string, MockServerConfig>;
  /** Overrides draft persistence (default: real localStorage, inert in Node). Inject an in-memory store for tests, or an IndexedDB-backed one for the real app. */
  readonly draftStorage?: MdyDraftStorage;
  /** The reactivity graph the form runs on. Pass the same instance a caller already owns (e.g. studio-ui's own effect()/observe() loop) so its signals are observable from outside — a fresh vanillaReactivity() per call cannot be. Defaults to a new vanillaReactivity() (createForm's own fallback). */
  readonly reactivity?: MdyReactivity;
}

/** Builds a real, running form from `project`. */
export function buildLiveForm(project: MdyStudioProject, options: BuildLiveFormOptions = {}): LiveFormResult {
  const { mockConfigByImplId = {}, draftStorage, reactivity } = options;
  const diagnostics: StudioDiagnostic[] = [];
  if (project.schema.node !== "group") {
    diagnostics.push({ code: "INVALID_ROOT", severity: "error", message: "Project schema root must be a group", nodeId: project.schema.id });
    return { form: null, diagnostics };
  }

  const idx = buildIndexes(project);
  const schema: Record<string, unknown> = {};
  for (const child of project.schema.children) schema[child.name] = mapNode(child, idx, diagnostics, mockConfigByImplId);

  const validators = project.formValidators.map((fv) => {
    const pathOf = (id: string): string => idx.pathByNode.get(id) ?? id;
    const targetRefs = fv.errorTarget ? [fv.errorTarget] : fv.dependencies;
    const paths = targetRefs.map((r) => pathOf(r.nodeId)).filter((p) => p !== "");
    return crossField(paths, (value) => (evaluateExpression(fv.condition, value, pathOf) ? null : fv.message));
  });

  const draft = project.behaviors.draft
    ? {
        key: project.behaviors.draft.key,
        exclude: (project.behaviors.draft.exclude ?? []).map((r) => idx.pathByNode.get(r.nodeId) ?? r.nodeId),
        storage: draftStorage,
      }
    : undefined;

  const form = createForm(schema as MdyFormSchema, { validators, draft, history: true, reactivity });
  return { form, diagnostics };
}
