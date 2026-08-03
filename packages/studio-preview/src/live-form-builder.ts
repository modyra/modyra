/**
 * A real, running `@modyra/core` form, built from the contract a project compiles to.
 *
 * Actual `field()`/`group()`/`array()`/`createForm()` calls against actual imported validator
 * functions — never a reimplementation, and never text generation, which is a different output for
 * a different purpose.
 *
 * There is deliberately **one** way to get here. Building from the project model as well would give
 * the preview a second, privileged path, and the two would drift: the preview would show forms the
 * export cannot express.
 */
import {
  array,
  buildDynamicFormSchema,
  buildDynamicValidations,
  createForm,
  evaluateExpression,
  field,
  group,
  parseDynamicForm,
  serverValidator,
  type MdyDraftStorage,
  type MdyFormSchema,
  type MdyReactivity,
  type MdyTypedForm,
  type ValidatorFn,
} from "@modyra/core";
import {
  buildIndexes,
  type FieldNode,
  type MdyStudioProject,
  type StudioDiagnostic,
  type StudioIndexes,
  type StudioSchemaNode,
} from "@modyra/studio-model";
import { compileToContract, toContractExpression } from "@modyra/studio-contract";
import { createMockAsyncValidator, type MockServerConfig } from "./mock-server.js";

export interface LiveFormResult {
  form: MdyTypedForm<MdyFormSchema> | null;
  diagnostics: StudioDiagnostic[];
}

export interface BuildLiveFormOptions {
  /** Server mock config per StudioImplementationRef id; a serverValidator with no entry gets defaults (300ms delay, always valid). */
  readonly mockConfigByImplId?: Record<string, MockServerConfig>;
  /** Overrides draft persistence (default: real localStorage, inert in Node). Inject an in-memory store for tests, or an IndexedDB-backed one for the real app. */
  readonly draftStorage?: MdyDraftStorage;
  /** The reactivity graph the form runs on. Pass the same instance a caller already owns (e.g. studio-ui's own effect()/observe() loop) so its signals are observable from outside — a fresh vanillaReactivity() per call cannot be. Defaults to a new vanillaReactivity() (createForm's own fallback). */
  readonly reactivity?: MdyReactivity;
}

/**
 * Every field node in the project, by the path it occupies in the form value.
 *
 * Used to find the nodes the *contract* cannot describe — a server validator is a target-generation
 * concern, so the compiled contract has no place to put one — and reattach them to the form the
 * contract built.
 */
function fieldNodesByPath(node: StudioSchemaNode, idx: StudioIndexes, into: Map<string, FieldNode>): void {
  if (node.node === "field") {
    const path = idx.pathByNode.get(node.id);
    if (path !== undefined) into.set(path, node);
    return;
  }
  if (node.node === "group") {
    for (const child of node.children) fieldNodesByPath(child, idx, into);
    return;
  }
  fieldNodesByPath(node.item, idx, into);
}

/**
 * Puts the preview's mock server validators back onto the schema the contract produced.
 *
 * This is the one thing the preview adds that the contract does not carry, and it is deliberate: a
 * real exported form receives a real server validator from its host, so there is nothing for the
 * schema to hold. Standing in for that host is the preview presenting its own dynamics — a builder
 * affordance — rather than the preview inventing form semantics.
 */
function withMockServerValidators(
  schema: Record<string, unknown>,
  path: string,
  nodesByPath: ReadonlyMap<string, FieldNode>,
  idx: StudioIndexes,
  mockConfigByImplId: Record<string, MockServerConfig>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(schema)) {
    const here = path ? `${path}.${key}` : key;
    const record = descriptor as { kind?: string; children?: Record<string, unknown>; initial?: unknown; validators?: unknown };

    if (record.kind === "group" && record.children) {
      out[key] = group(withMockServerValidators(record.children, here, nodesByPath, idx, mockConfigByImplId) as MdyFormSchema);
      continue;
    }
    // An array's rows are all built from its item descriptor, so the descriptor is where a row's
    // server validator has to go — patching a row would leave every later row without one.
    if (record.kind === "array") {
      const arrayDescriptor = descriptor as { item: unknown; initial?: ReadonlyArray<unknown>; validators?: ReadonlyArray<ValidatorFn<readonly unknown[]>> };
      const patched = withMockServerValidators({ item: arrayDescriptor.item }, here, nodesByPath, idx, mockConfigByImplId);
      out[key] = array(patched.item as never, {
        ...(arrayDescriptor.initial !== undefined ? { initial: arrayDescriptor.initial } : {}),
        ...(arrayDescriptor.validators ? { validators: arrayDescriptor.validators } : {}),
      });
      continue;
    }

    const node = nodesByPath.get(here);
    if (record.kind !== "field" || !node?.serverValidator) {
      out[key] = descriptor;
      continue;
    }

    const sv = node.serverValidator;
    // `skipWhen` is evaluated against the field's *own* value, so a reference to this node reads the
    // whole of it — path `""`. Any other reference is as meaningless here as it was before, and
    // resolves to undefined rather than throwing.
    const selfScoped = new Map(idx.pathByNode);
    selfScoped.set(node.id, "");
    const skipWhen = sv.skipWhen ? toContractExpression(sv.skipWhen, selfScoped) : undefined;

    out[key] = field(
      record.initial as never,
      (record.validators ?? []) as never,
      serverValidator(createMockAsyncValidator(mockConfigByImplId[sv.implementationRef] ?? {}), {
        debounceMs: sv.debounceMs,
        timeoutMs: sv.timeoutMs,
        dependsOn: sv.dependencies.map((d) => idx.pathByNode.get(d.nodeId) ?? d.nodeId),
        ...(skipWhen ? { when: (value: unknown) => !evaluateExpression(skipWhen, value) } : {}),
      }),
    );
  }
  return out;
}

/**
 * Builds a real, running form from `project`, **through the contract it would export**.
 *
 * The route is `project → compileToContract → parseDynamicForm → form`, and it is the point of this
 * function rather than an implementation detail. Reading the project model directly — which this did
 * — gave the preview a privileged path: it could build forms the export could not express, so a
 * designer could watch a rule work and then ship a contract without it.
 *
 * The consequence is deliberate: **a project that does not compile does not preview.** Previewing
 * work in progress is a legitimate thing to want, but not at the price of the preview and the export
 * disagreeing about what the form is; the compiler's diagnostics come back with the result so the
 * builder can say precisely what is blocking it.
 */
export function buildLiveForm(project: MdyStudioProject, options: BuildLiveFormOptions = {}): LiveFormResult {
  const { mockConfigByImplId = {}, draftStorage, reactivity } = options;

  const { contract, diagnostics } = compileToContract(project);
  if (!contract || !contract.schema) return { form: null, diagnostics };

  // The contract compiler already strict-parses what it returns, so this cannot normally fail. It is
  // read rather than assumed because `validations` has to come from somewhere, and taking it from
  // the parser is what keeps the preview's cross-field rules the exported ones.
  const parsed = parseDynamicForm(contract, { mode: "strict" });
  if (!parsed.ok) {
    for (const d of parsed.diagnostics) {
      diagnostics.push({ code: d.code, severity: d.severity, message: d.message, propertyPath: d.path });
    }
    return { form: null, diagnostics };
  }

  const idx = buildIndexes(project);
  const nodesByPath = new Map<string, FieldNode>();
  fieldNodesByPath(project.schema, idx, nodesByPath);

  const schema = withMockServerValidators(
    buildDynamicFormSchema(contract.schema) as Record<string, unknown>,
    "",
    nodesByPath,
    idx,
    mockConfigByImplId,
  );

  const draft = project.behaviors.draft
    ? {
        key: project.behaviors.draft.key,
        exclude: (project.behaviors.draft.exclude ?? []).map((r) => idx.pathByNode.get(r.nodeId) ?? r.nodeId),
        storage: draftStorage,
      }
    : undefined;

  const form = createForm(schema as MdyFormSchema, {
    validators: buildDynamicValidations(parsed.validations),
    draft,
    history: true,
    reactivity,
  });
  return { form, diagnostics };
}
