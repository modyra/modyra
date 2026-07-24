/**
 * Vanilla (no framework) Studio canvas shell — palette, tree, inspector,
 * pointer drag + keyboard-equivalent reordering, undo/redo. Consumes
 * @modyra/studio-model (project/indexes) and @modyra/studio-editor
 * (commands/history) only; owns no model logic itself (R4).
 */
import {
  buildIndexes,
  compatibleValidatorKinds,
  createBlankProject,
  createId,
  getFieldValidatorRegistryEntry,
  isDuplicateKindAllowed,
  type FieldNode,
  type GroupNode,
  type MdyStudioProject,
  type StudioDiagnostic,
  type StudioExpression,
  type StudioExpressionOp,
  type StudioFormValidator,
  type StudioIndexes,
  type StudioSchemaNode,
  type StudioValidatorKind,
} from "@modyra/studio-model";
import {
  CommandHistory,
  CommandRejectedError,
  createAddFormValidatorCommand,
  createAddImplementationCommand,
  createAddValidatorCommand,
  createDeleteCommand,
  createDuplicateCommand,
  createInsertCommand,
  createMoveCommand,
  createRemoveFormValidatorCommand,
  createRemoveValidatorCommand,
  createSetFieldOptionsCommand,
  createSetServerValidatorCommand,
  createUpdateBehaviorCommand,
  createUpdateFormValidatorCommand,
  createUpdateNodeCommand,
  createUpdateValidatorCommand,
  inspectDelete,
  type Command,
  type Placement,
} from "@modyra/studio-editor";
import { compileToContract } from "@modyra/studio-contract";
import { TargetRegistry, type Artifact } from "@modyra/studio-codegen";
import { jsonTargetManifest } from "@modyra/studio-target-json";
import { coreTargetManifest } from "@modyra/studio-target-core";
import { angularTargetManifest } from "@modyra/studio-target-angular";
import { reactTargetManifest } from "@modyra/studio-target-react";
import { buildLiveForm, createMockSubmitAction, vanillaReactivity, type MdyTypedForm, type MockServerConfig } from "@modyra/studio-preview";
import "./studio.css";

type Drag = { nodeId: string } | { template: string };

/** Lazy target registry (ADR-0004) — registering costs nothing, load() only runs on first Generate. */
const targetRegistry = new TargetRegistry();
targetRegistry.register(jsonTargetManifest);
targetRegistry.register(coreTargetManifest);
targetRegistry.register(angularTargetManifest);
targetRegistry.register(reactTargetManifest);

const TEMPLATES = [
  "text",
  "textarea",
  "email",
  "number",
  "checkbox",
  "select",
  "multiselect",
  "date",
  "group",
  "array",
] as const;

function createNodeFromTemplate(template: string): StudioSchemaNode {
  const id = createId("nd");
  const suffix = id.slice(-5);

  if (template === "group") {
    return { node: "group", id, name: `group${suffix}`, label: "New group", children: [] };
  }
  if (template === "array") {
    return {
      node: "array",
      id,
      name: `items${suffix}`,
      label: "New array",
      item: { node: "group", id: createId("nd"), name: "item", children: [] },
      initialRows: [],
      validators: [],
    };
  }

  const valueType =
    template === "number" ? "number"
    : template === "checkbox" ? "boolean"
    : template === "multiselect" ? "string[]"
    : template === "date" ? "date"
    : "string";
  const initialValue =
    valueType === "number" ? 0
    : valueType === "boolean" ? false
    : valueType === "string[]" ? []
    : "";

  return {
    node: "field",
    id,
    name: `${template}${suffix}`,
    label: `New ${template}`,
    fieldKind: template as never,
    valueType,
    initialValue,
    validators: [],
    ...(template === "select" || template === "multiselect"
      ? { options: [{ value: "option", label: "Option" }] }
      : {}),
  };
}

function escapeHtml(value: unknown): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(value ?? "").replace(/[&<>"']/g, (char) => entities[char]!);
}

/** Native, stateless disclosure — `open` reflects tracked state so it survives the next full re-render. */
function accordionMarkup(id: string, title: string, badge: string, expanded: boolean, bodyHtml: string): string {
  return `
    <details class="accordion" data-section="${id}" ${expanded ? "open" : ""}>
      <summary>${escapeHtml(title)}${badge ? ` <span class="badge">${escapeHtml(badge)}</span>` : ""}</summary>
      <div class="accordion-body">${bodyHtml}</div>
    </details>`;
}

/** P5: "Validation" section body — add/edit/remove, only ever offering registry-compatible kinds. */
function validatorsMarkup(node: FieldNode): string {
  const used = new Set(node.validators.map((v) => v.kind));
  const available = compatibleValidatorKinds(node.valueType).filter((kind) => !used.has(kind) || isDuplicateKindAllowed(kind));

  const rows = node.validators
    .map((v) => {
      const displayName = getFieldValidatorRegistryEntry(v.kind)?.displayName ?? v.kind;
      const configInput =
        v.kind === "pattern"
          ? `<input data-validator-pattern="${v.id}" placeholder="regex" value="${escapeHtml(v.pattern ?? "")}">
             <input data-validator-message="${v.id}" placeholder="message" value="${escapeHtml(v.message ?? "")}">`
          : v.kind === "min" || v.kind === "max" || v.kind === "minLength" || v.kind === "maxLength"
            ? `<input type="number" data-validator-value="${v.id}" value="${escapeHtml(String(v.value ?? 0))}">`
            : "";
      return `
        <li class="validator-row">
          <span>${escapeHtml(displayName)}</span>
          ${configInput}
          <button data-remove-validator="${v.id}" aria-label="Remove ${escapeHtml(displayName)} validator">×</button>
        </li>`;
    })
    .join("");

  const options = available
    .map((kind) => `<option value="${kind}">${escapeHtml(getFieldValidatorRegistryEntry(kind)?.displayName ?? kind)}</option>`)
    .join("");

  return `
    <ul class="validator-list">${rows}</ul>
    ${available.length ? `<select data-add-validator aria-label="Add validator"><option value="">+ Add validator</option>${options}</select>` : ""}`;
}

/** P5: "Options" section body, select/multiselect only (plan section 8 "properties options"). */
function optionsMarkup(node: FieldNode): string {
  const rows = (node.options ?? [])
    .map(
      (opt, index) => `
        <li class="option-row">
          <input data-option-value="${index}" placeholder="value" value="${escapeHtml(opt.value)}">
          <input data-option-label="${index}" placeholder="label" value="${escapeHtml(opt.label)}">
          <button data-remove-option="${index}" aria-label="Remove option ${escapeHtml(opt.label || opt.value)}">×</button>
        </li>`,
    )
    .join("");
  return `
    <ul class="option-list">${rows}</ul>
    <button data-add-option>+ Add option</button>`;
}

/** All nodes by derived path, for a <select> — the only way any ref is ever picked (no path typing, R3/P5 gate). */
function nodeRefOptionsMarkup(idx: StudioIndexes, currentId: string): string {
  return [...idx.nodeById.keys()]
    .map((id) => ({ id, path: idx.pathByNode.get(id) || "root" }))
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((e) => `<option value="${e.id}" ${e.id === currentId ? "selected" : ""}>${escapeHtml(e.path)}</option>`)
    .join("");
}

/** P5b2: "Server validation" inspector section — dependencies, debounce/timeout, skip-when-empty, stub creation. */
export function serverValidatorMarkup(project: MdyStudioProject, idx: StudioIndexes, node: FieldNode): string {
  const sv = node.serverValidator;
  if (!sv) {
    return `<button data-enable-server-validator>+ Enable server validation</button>`;
  }

  const implOptions = Object.values(project.implementations)
    .filter((impl) => impl.role === "serverValidator")
    .map((impl) => `<option value="${impl.id}" ${sv.implementationRef === impl.id ? "selected" : ""}>${escapeHtml(impl.displayName)}</option>`)
    .join("");
  const skipsWhenEmpty = sv.skipWhen?.op === "isEmpty" && (sv.skipWhen.operand as { nodeId?: string } | undefined)?.nodeId === node.id;
  const depIds = new Set(sv.dependencies.map((d) => d.nodeId));
  const depRows = [...idx.nodeById.keys()]
    .filter((id) => id !== node.id)
    .map((id) => ({ id, path: idx.pathByNode.get(id) || "root" }))
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(
      (e) =>
        `<label class="dep-row"><input type="checkbox" data-server-dependency="${e.id}" ${depIds.has(e.id) ? "checked" : ""}> ${escapeHtml(e.path)}</label>`,
    )
    .join("");

  return `
    <label>Implementation
      <select data-server-impl>
        <option value="">— none —</option>
        ${implOptions}
      </select>
    </label>
    <button data-new-server-impl>+ New stub</button>
    <label>Debounce (ms)<input type="number" data-server-debounce value="${sv.debounceMs ?? 0}"></label>
    <label>Timeout (ms)<input type="number" data-server-timeout value="${sv.timeoutMs ?? 0}"></label>
    <label class="dep-row"><input type="checkbox" data-server-skip-empty ${skipsWhenEmpty ? "checked" : ""}> Skip when this field is empty</label>
    <label>Error message<input data-server-message value="${escapeHtml(sv.errorMessage ?? "")}"></label>
    <fieldset class="server-deps">
      <legend>Depends on</legend>
      ${depRows}
    </fieldset>
    <button data-remove-server-validator>Remove server validation</button>`;
}

/** Draft state for the "add a form validator" mini-form — templates, not a general recursive expression tree
    (see .modyra/framework/STATUS.md P5 batch 2 note: and/or/not composition is a deferred gap). */
/** One leaf condition: a field, a comparison op, and (if the op needs one) a literal. */
interface ConditionDraft {
  refNodeId: string;
  op: StudioExpressionOp;
  literal: string;
}

interface FormValidatorDraft {
  kind: "form" | "crossField";
  refNodeId: string;
  op: StudioExpressionOp;
  literal: string;
  /** Used when `op` is "and"/"or" (both entries) or "not" (first entry only). */
  subConditions: [ConditionDraft, ConditionDraft];
  errorTargetId: string;
  message: string;
}

/** `composite`: 0 = leaf (single field+op+literal), 1 = unary ("not" wraps one sub-condition),
    2 = binary ("and"/"or" combine two). This is the P5 gap this batch closes — and/or/not
    composition, one level deep (a sub-condition is always a leaf, never itself composite;
    a fully general recursive tree editor is a further-out gap, see STATUS.md). */
interface ConditionTemplate {
  op: StudioExpressionOp;
  label: string;
  needsLiteral: boolean;
  literalKind: "text" | "number";
  composite: 0 | 1 | 2;
}

const CONDITION_TEMPLATES: ConditionTemplate[] = [
  { op: "isEmpty", label: "is empty", needsLiteral: false, literalKind: "text", composite: 0 },
  { op: "isNotEmpty", label: "is not empty", needsLiteral: false, literalKind: "text", composite: 0 },
  { op: "equals", label: "equals", needsLiteral: true, literalKind: "text", composite: 0 },
  { op: "notEquals", label: "does not equal", needsLiteral: true, literalKind: "text", composite: 0 },
  { op: "greaterThan", label: "is greater than", needsLiteral: true, literalKind: "number", composite: 0 },
  { op: "lessThan", label: "is less than", needsLiteral: true, literalKind: "number", composite: 0 },
  { op: "matches", label: "matches pattern", needsLiteral: true, literalKind: "text", composite: 0 },
  { op: "lengthAtLeast", label: "has length at least", needsLiteral: true, literalKind: "number", composite: 0 },
  { op: "lengthAtMost", label: "has length at most", needsLiteral: true, literalKind: "number", composite: 0 },
  { op: "and", label: "All of (AND)", needsLiteral: false, literalKind: "text", composite: 2 },
  { op: "or", label: "Any of (OR)", needsLiteral: false, literalKind: "text", composite: 2 },
  { op: "not", label: "Not (negate)", needsLiteral: false, literalKind: "text", composite: 1 },
];
const LEAF_CONDITION_TEMPLATES = CONDITION_TEMPLATES.filter((t) => t.composite === 0);

function buildLeafExpression(sub: ConditionDraft): StudioExpression {
  const template = LEAF_CONDITION_TEMPLATES.find((t) => t.op === sub.op)!;
  const ref = { nodeId: sub.refNodeId };
  const literalValue: string | number = template.literalKind === "number" ? Number(sub.literal || "0") : sub.literal;
  return template.needsLiteral ? { op: sub.op, operands: [ref, literalValue] } : { op: sub.op, operand: ref };
}

function buildFormValidatorFromDraft(draft: FormValidatorDraft): StudioFormValidator {
  const template = CONDITION_TEMPLATES.find((t) => t.op === draft.op)!;
  let condition: StudioExpression;
  let dependencyIds: string[];

  if (template.composite === 2) {
    const [a, b] = draft.subConditions;
    condition = { op: draft.op, operands: [buildLeafExpression(a), buildLeafExpression(b)] };
    dependencyIds = [a.refNodeId, b.refNodeId];
  } else if (template.composite === 1) {
    const [a] = draft.subConditions;
    condition = { op: draft.op, operand: buildLeafExpression(a) };
    dependencyIds = [a.refNodeId];
  } else {
    condition = buildLeafExpression({ refNodeId: draft.refNodeId, op: draft.op, literal: draft.literal });
    dependencyIds = [draft.refNodeId];
  }

  return {
    id: createId("val"),
    kind: draft.kind,
    dependencies: [...new Set(dependencyIds)].map((nodeId) => ({ nodeId })),
    condition,
    message: draft.message || "Invalid value",
    errorTarget: draft.errorTargetId ? { nodeId: draft.errorTargetId } : null,
  };
}

function subConditionMarkup(idx: StudioIndexes, sub: ConditionDraft, index: number): string {
  const template = LEAF_CONDITION_TEMPLATES.find((t) => t.op === sub.op)!;
  const opOptions = LEAF_CONDITION_TEMPLATES.map(
    (t) => `<option value="${t.op}" ${t.op === sub.op ? "selected" : ""}>${escapeHtml(t.label)}</option>`,
  ).join("");
  return `
    <div class="fv-subcondition">
      <label>Field<select data-fv-sub-ref="${index}">${nodeRefOptionsMarkup(idx, sub.refNodeId)}</select></label>
      <label>Condition<select data-fv-sub-op="${index}">${opOptions}</select></label>
      ${template.needsLiteral ? `<label>Value<input data-fv-sub-literal="${index}" value="${escapeHtml(sub.literal)}"></label>` : ""}
    </div>`;
}

/** P5 gap closed: submit-action stub UI, mirroring the server-validator implementation picker. */
function submitActionMarkup(project: MdyStudioProject): string {
  const submitRef = project.behaviors.submit?.implementationRef;
  const implOptions = Object.values(project.implementations)
    .filter((impl) => impl.role === "submitAction")
    .map((impl) => `<option value="${impl.id}" ${submitRef === impl.id ? "selected" : ""}>${escapeHtml(impl.displayName)}</option>`)
    .join("");
  return `
    <div class="submit-action">
      <h3>Submit action</h3>
      <label>Implementation
        <select data-submit-impl>
          <option value="">— none —</option>
          ${implOptions}
        </select>
      </label>
      <button data-new-submit-impl>+ New stub</button>
      ${submitRef ? `<button data-remove-submit-action>Remove</button>` : ""}
    </div>`;
}

/** P5b2: project-level "Form validators" section — always visible (not tied to node selection). */
export function formValidatorsMarkup(project: MdyStudioProject, idx: StudioIndexes, draft: FormValidatorDraft): string {
  const rows = project.formValidators
    .map((v) => {
      // Root's derived path is "" by design (P1) — `|| "(none)"` on the joined string would wrongly
      // read a real root-only dependency as "no dependencies" (empty-string path -> falsy join result).
      // Show "root" explicitly instead, and gate the empty-state on array length, not string truthiness.
      const pathOrRoot = (nodeId: string) => idx.pathByNode.get(nodeId) || "root";
      const depsPaths = v.dependencies.length ? v.dependencies.map((d) => pathOrRoot(d.nodeId)).join(", ") : "(none)";
      const targetPath = v.errorTarget ? pathOrRoot(v.errorTarget.nodeId) : "(none)";
      return `
        <li class="form-validator-row">
          <div class="fv-summary">
            <strong>${escapeHtml(v.kind)}</strong>
            <input data-form-validator-message="${v.id}" value="${escapeHtml(v.message)}">
            <span class="fv-meta">depends on: ${escapeHtml(depsPaths)} · error target: ${escapeHtml(targetPath)}</span>
          </div>
          <button data-remove-form-validator="${v.id}" aria-label="Remove form validator ${escapeHtml(v.id)}">×</button>
        </li>`;
    })
    .join("");

  const template = CONDITION_TEMPLATES.find((t) => t.op === draft.op)!;
  const opOptions = CONDITION_TEMPLATES.map(
    (t) => `<option value="${t.op}" ${t.op === draft.op ? "selected" : ""}>${escapeHtml(t.label)}</option>`,
  ).join("");
  const targetOptions = `<option value="">— none —</option>${nodeRefOptionsMarkup(idx, draft.errorTargetId)}`;

  const conditionFields =
    template.composite > 0
      ? Array.from({ length: template.composite }, (_, i) => subConditionMarkup(idx, draft.subConditions[i]!, i)).join("")
      : `
        <label>Field<select data-fv-ref>${nodeRefOptionsMarkup(idx, draft.refNodeId)}</select></label>
        ${template.needsLiteral ? `<label>Value<input data-fv-literal value="${escapeHtml(draft.literal)}"></label>` : ""}`;

  return `
    <div class="form-validators">
      ${submitActionMarkup(project)}
      <p class="tab-hint">Rules that apply to the whole form, not a single field — e.g. "at least one item", cross-field checks.</p>
      <ul class="form-validator-list">${rows}</ul>
      <div class="fv-draft">
        <label>Condition<select data-fv-op>${opOptions}</select></label>
        ${conditionFields}
        <label>Error target<select data-fv-target>${targetOptions}</select></label>
        <label>Message<input data-fv-message value="${escapeHtml(draft.message)}"></label>
        <button data-add-form-validator>+ Add form validator</button>
      </div>
    </div>`;
}

/**
 * Walks a live form's `.f` tree by dotted path segments — the live counterpart of `idx.pathByNode`.
 * A group's segment is a plain property (`.f.shipping.city`), but an array row's numeric segment is
 * not (`.f.items` is an `MdyArrayHandle`, not indexable by a `"0"` property) — it needs `.at(0)`.
 * Pure/exported so it (and everything below) is unit-testable the same way as
 * `serverValidatorMarkup`/`formValidatorsMarkup`, without needing a DOM.
 */
export function getPreviewHandle(form: MdyTypedForm<never> | null, path: string): Record<string, unknown> | null {
  if (!form) return null;
  let current: unknown = form.f;
  for (const seg of path.split(".")) {
    if (current === null || current === undefined) return null;
    const obj = current as Record<string, unknown>;
    current = /^\d+$/.test(seg) && typeof obj.at === "function" ? (obj.at as (i: number) => unknown)(Number(seg)) : obj[seg];
  }
  return (current ?? null) as Record<string, unknown> | null;
}

/** Initial value for a newly-pushed array row, built from the item schema's own field defaults (nested arrays inside an array item are not supported — a documented P11 limitation, not silently wrong). */
export function defaultRowValue(item: FieldNode | GroupNode): unknown {
  if (item.node === "field") return item.initialValue;
  const row: Record<string, unknown> = {};
  for (const child of item.children) if (child.node !== "array") row[child.name] = defaultRowValue(child as FieldNode | GroupNode);
  return row;
}

/** P11: one live field, bound to the real form handle at `path` — never a static description of one (R5/R12). */
export function previewFieldMarkup(node: FieldNode, path: string, form: MdyTypedForm<never> | null, mockConfig: Record<string, MockServerConfig>): string {
  const handle = getPreviewHandle(form, path);
  if (!handle) return "";
  const value = (handle.value as () => unknown)();
  const errors = (handle.errors as () => ReadonlyArray<{ message: string }>)();
  const pending = (handle.pending as () => boolean)();
  const label = escapeHtml(node.label || node.name);

  let control: string;
  if (node.fieldKind === "textarea") {
    control = `<textarea data-preview-field="${path}">${escapeHtml(String(value ?? ""))}</textarea>`;
  } else if (node.fieldKind === "number") {
    control = `<input type="number" data-preview-field="${path}" value="${escapeHtml(String(value ?? ""))}">`;
  } else if (node.fieldKind === "checkbox") {
    control = `<input type="checkbox" data-preview-field="${path}" data-preview-checkbox ${value ? "checked" : ""}>`;
  } else if (node.fieldKind === "select") {
    const options = (node.options ?? [])
      .map((o) => `<option value="${escapeHtml(o.value)}" ${o.value === value ? "selected" : ""}>${escapeHtml(o.label)}</option>`)
      .join("");
    control = `<select data-preview-field="${path}"><option value="">— choose —</option>${options}</select>`;
  } else if (node.fieldKind === "multiselect") {
    const selectedValues = Array.isArray(value) ? (value as unknown[]) : [];
    const options = (node.options ?? [])
      .map((o) => `<option value="${escapeHtml(o.value)}" ${selectedValues.includes(o.value) ? "selected" : ""}>${escapeHtml(o.label)}</option>`)
      .join("");
    control = `<select multiple data-preview-field="${path}">${options}</select>`;
  } else if (node.fieldKind === "date") {
    control = `<input type="date" data-preview-field="${path}" value="${escapeHtml(String(value ?? ""))}">`;
  } else {
    control = `<input type="${node.fieldKind === "email" ? "email" : "text"}" data-preview-field="${path}" value="${escapeHtml(String(value ?? ""))}">`;
  }

  const serverMock = node.serverValidator
    ? (() => {
        const cfg = mockConfig[node.serverValidator!.implementationRef];
        const mode = cfg?.forceNetworkFailure ? "network" : cfg?.forceError ? "error" : "success";
        return `
      <label class="preview-mock-mode">Server mock
        <select data-preview-mock-mode="${node.serverValidator!.implementationRef}">
          <option value="success" ${mode === "success" ? "selected" : ""}>Succeeds</option>
          <option value="error" ${mode === "error" ? "selected" : ""}>Fails</option>
          <option value="network" ${mode === "network" ? "selected" : ""}>Network failure</option>
        </select>
      </label>`;
      })()
    : "";

  return `
    <label class="preview-field">
      <span>${label}${pending ? ' <span class="preview-pending">checking…</span>' : ""}</span>
      ${control}
      ${errors.length ? `<span class="preview-errors">${errors.map((e) => escapeHtml(e.message)).join(", ")}</span>` : ""}
    </label>
    ${serverMock}`;
}

/** P11: a field, group, or array node — recurses, always reading the real live handle at each computed path. */
export function previewNodeMarkup(node: StudioSchemaNode, path: string, form: MdyTypedForm<never> | null, mockConfig: Record<string, MockServerConfig>): string {
  if (node.node === "field") return previewFieldMarkup(node, path, form, mockConfig);
  if (node.node === "group") {
    return `
      <fieldset class="preview-group">
        <legend>${escapeHtml(node.label || node.name)}</legend>
        ${node.children.map((c) => previewNodeMarkup(c, `${path}.${c.name}`, form, mockConfig)).join("")}
      </fieldset>`;
  }
  const handle = getPreviewHandle(form, path) as { length?: () => number } | null;
  const length = handle?.length?.() ?? 0;
  const rows = Array.from({ length }, (_, i) => {
    const rowPath = `${path}.${i}`;
    const rowFields =
      node.item.node === "group"
        ? node.item.children.map((c) => previewNodeMarkup(c, `${rowPath}.${c.name}`, form, mockConfig)).join("")
        : previewNodeMarkup(node.item, rowPath, form, mockConfig);
    return `<div class="preview-array-row">${rowFields}<button type="button" data-preview-array-remove="${path}" data-preview-array-index="${i}">Remove</button></div>`;
  }).join("");
  return `
    <div class="preview-array">
      <div class="preview-array-label">${escapeHtml(node.label || node.name)} (${length})</div>
      ${rows}
      <button type="button" data-preview-array-push="${path}">+ Add row</button>
    </div>`;
}

/** P11 gate ("Preview reads model/Contract, not generated source"): status badges, every field live-bound, Submit. Diagnostics are appended by the caller (mountStudio already has a diagnosticsMarkup() it reuses everywhere else). */
export function previewBodyMarkup(project: MdyStudioProject, form: MdyTypedForm<never> | null, mockConfig: Record<string, MockServerConfig>): string {
  if (!form) {
    return `<p class="tab-hint">Preview needs a group at the schema root.</p>`;
  }
  const rootChildren = project.schema.node === "group" ? project.schema.children : [];
  const fields = rootChildren.map((c) => previewNodeMarkup(c, c.name, form, mockConfig)).join("");
  const state = form.state;
  const submitErrors = state.lastSubmitErrors();
  const submitRef = project.behaviors.submit?.implementationRef;

  return `
    <p class="tab-hint">A real, running form built directly from this project — never generated source (R5/R12). Server validators run against a configurable mock, never a real network call.</p>
    <div class="preview-status">
      <span class="preview-status-badge ${state.valid() ? "valid" : "invalid"}">${state.valid() ? "Valid" : "Invalid"}</span>
      ${state.pending() ? '<span class="preview-status-badge pending">Pending</span>' : ""}
    </div>
    <div class="preview-fields">${fields}</div>
    <button type="button" data-preview-submit ${state.canSubmit() && !state.submitting() ? "" : "disabled"}>
      ${state.submitting() ? "Submitting…" : "Submit"}
    </button>
    ${
      state.submitCount()
        ? submitErrors.length
          ? `<p class="export-error" role="alert">Submit failed: ${escapeHtml(submitErrors.map((e: { message: string }) => e.message).join(", "))}</p>`
          : `<p class="tab-hint">Submitted successfully (mock).</p>`
        : ""
    }
    ${!submitRef ? `<p class="tab-hint">No submit action configured (see Form rules).</p>` : ""}`;
}

/** Mounts the Studio editor into `host`. Returns a disposer that clears the host. */
export function mountStudio(host: HTMLElement, initial?: MdyStudioProject): () => void {
  let project = initial ? structuredClone(initial) : createBlankProject();
  let selected = project.schema.id;
  let drag: Drag | null = null;
  let picked: string | null = null;
  let status = "Blank project ready";
  /** CSS selector re-focused after the next render — every action must set this, win or lose (R9/plan §7 "Restore focus after command"). */
  let focusSelector: string | null = null;
  let formValidatorDraft: FormValidatorDraft = {
    kind: "form",
    refNodeId: project.schema.id,
    op: "isNotEmpty",
    literal: "",
    subConditions: [
      { refNodeId: project.schema.id, op: "isNotEmpty", literal: "" },
      { refNodeId: project.schema.id, op: "isNotEmpty", literal: "" },
    ],
    errorTargetId: "",
    message: "",
  };
  let inspectorTab: "node" | "form" | "diagnostics" | "export" | "preview" = "node";
  /** Export tab state — `generation` guards against a stale async generate() clobbering a newer one
      (plan §14 P7 gate "stale ignored"); errors never touch `project`/`history` (gate "failure cannot corrupt editor"). */
  let exportState: { targetId: string; artifact: Artifact | null; generating: boolean; error: string | null; generation: number } = {
    targetId: targetRegistry.list()[0]?.id ?? "",
    artifact: null,
    generating: false,
    error: null,
    generation: 0,
  };
  /** Preview tab state (plan §11: "Preview reads model/Contract, not generated source"). `previewReactivity`
      is a single, long-lived graph so the effect below can observe the live form's own signals — a fresh
      vanillaReactivity() per rebuild could not (see studio-preview's own test for why). Rebuilt only when
      `project` changes identity (a fresh edit) or the mock config changes, never on every render(). */
  const previewReactivity = vanillaReactivity();
  let previewForm: MdyTypedForm<never> | null = null;
  let previewForProject: MdyStudioProject | null = null;
  let previewDiagnostics: StudioDiagnostic[] = [];
  let previewMockConfig: Record<string, MockServerConfig> = {};
  let previewEffect: { destroy(): void } | null = null;
  /** Which accordion sections are open — Validation starts open, everything else starts collapsed
      (the whole point of this structure: show little by default, let the user open what they need). */
  const expandedSections = new Set<string>(["validation"]);
  /** Node IDs referenced by the current diagnostics — recomputed at the top of every render(),
      read by nodeIndicatorsMarkup() so the tree shows an at-a-glance error marker too. */
  let diagnosticNodeIds = new Set<string>();
  const history = new CommandHistory();

  function commit(command: Command, focusTarget: string = selected): void {
    try {
      project = history.apply(project, command);
      status = command.description;
    } catch (error) {
      status = error instanceof CommandRejectedError
        ? error.diagnostics.map((d) => d.message).join(". ")
        : String(error);
    }
    // Restore focus regardless of success/failure — a rejected command must not strand the keyboard user.
    focusSelector = `[data-node="${focusTarget}"]`;
    render();
  }

  function drop(placement: Placement): void {
    if (!drag) return;
    if ("template" in drag) {
      const created = createNodeFromTemplate(drag.template);
      selected = created.id;
      commit(createInsertCommand(created, placement));
    } else {
      commit(createMoveCommand(drag.nodeId, placement));
    }
    drag = null;
  }

  function remove(id: string): void {
    const info = inspectDelete(project, id);
    if (
      info.requiresConfirmation &&
      !confirm(`Delete this node? ${info.descendantIds.length} descendants, ${info.referencedBy.length} references.`)
    ) {
      return;
    }
    selected = project.schema.id;
    commit(createDeleteCommand(id, true));
  }

  async function runExport(): Promise<void> {
    const targetId = exportState.targetId;
    if (!targetId) return;
    const myGeneration = ++exportState.generation;
    exportState = { ...exportState, generating: true, error: null };
    render();
    try {
      const target = await targetRegistry.load(targetId);
      const artifact = await target.generate(project, target.defaults());
      if (myGeneration !== exportState.generation) return; // a newer Generate started meanwhile — discard
      exportState = { ...exportState, artifact, generating: false };
    } catch (error) {
      if (myGeneration !== exportState.generation) return;
      exportState = { ...exportState, error: error instanceof Error ? error.message : String(error), generating: false };
    }
    render();
  }

  /** (Re)builds the live preview form only when `project` or the mock config actually changed — never on every render(). */
  function ensurePreviewForm(): void {
    if (previewForm && previewForProject === project) return;
    previewEffect?.destroy();
    const result = buildLiveForm(project, { reactivity: previewReactivity, mockConfigByImplId: previewMockConfig });
    previewForm = result.form as MdyTypedForm<never> | null;
    previewDiagnostics = result.diagnostics;
    previewForProject = project;
    const form = previewForm;
    if (form) {
      // Reading these signals subscribes them — any write (a preview field change, an async
      // validator settling, a submit) re-runs this and triggers a normal render(), the same
      // full-rebuild pattern every other state change in this file already uses.
      previewEffect = previewReactivity.effect(() => {
        form.value();
        form.state.pending();
        form.state.valid();
        form.state.canSubmit();
        form.state.submitting();
        form.state.lastSubmitErrors();
        render();
      });
    }
  }

  function getSelectedField(): FieldNode | null {
    const node = buildIndexes(project).nodeById.get(selected);
    return node && node.node === "field" ? node : null;
  }

  /** At-a-glance indicators — validators/server-validation don't require opening the inspector to spot. */
  function nodeIndicatorsMarkup(n: StudioSchemaNode): string {
    const badges: string[] = [];
    if (diagnosticNodeIds.has(n.id)) {
      badges.push(`<span class="indicator issue" title="Has a diagnostic — see the Diagnostics tab">!</span>`);
    }
    if (n.node === "field" || n.node === "array") {
      if (n.validators.some((v) => v.kind === "required")) {
        badges.push(`<span class="indicator required" title="Required">*</span>`);
      }
      const otherCount = n.validators.filter((v) => v.kind !== "required").length;
      if (otherCount) {
        badges.push(`<span class="indicator count" title="${otherCount} validator${otherCount > 1 ? "s" : ""}">${otherCount}</span>`);
      }
      if (n.node === "field" && n.serverValidator) {
        badges.push(`<span class="indicator server" title="Server validation enabled">⇄</span>`);
      }
    }
    return badges.length ? `<span class="node-indicators">${badges.join("")}</span>` : "";
  }

  /** One-click fix for a diagnostic — dispatches an existing command, never a bespoke mutation (plan §9 "Fixes use normal commands"). */
  function quickFixMarkup(d: StudioDiagnostic): string {
    if (d.code === "BAD_PATTERN" && d.nodeId && d.validatorId) {
      return `<button data-fix-clear-pattern="${d.validatorId}" data-fix-node="${d.nodeId}">Clear pattern</button>`;
    }
    if (d.code === "SELECT_WITHOUT_OPTIONS" && d.nodeId) {
      return `<button data-fix-add-option="${d.nodeId}">Add a default option</button>`;
    }
    if (d.code === "SENSITIVE_FIELD_IN_DRAFT" && d.nodeId) {
      return `<button data-fix-exclude-draft="${d.nodeId}">Exclude from draft</button>`;
    }
    return "";
  }

  function diagnosticsMarkup(diagnostics: StudioDiagnostic[]): string {
    if (!diagnostics.length) {
      return `<p class="tab-hint">No issues found — checkout strict-valid.</p>`;
    }
    const rows = diagnostics
      .map((d) => {
        const goto = d.nodeId ? `<button data-goto-node="${d.nodeId}">Go to</button>` : "";
        const fix = quickFixMarkup(d);
        return `
          <li class="diagnostic-row severity-${d.severity}">
            <span class="diag-severity">${escapeHtml(d.severity)}</span>
            <span class="diag-message">${escapeHtml(d.message)}</span>
            <span class="diag-actions">${goto}${fix}</span>
          </li>`;
      })
      .join("");
    return `
      <p class="tab-hint">Model checks and Contract v2 export checks, together — errors block export, warnings just mean something was omitted.</p>
      <ul class="diagnostic-list">${rows}</ul>`;
  }

  function exportMarkup(): string {
    const targets = targetRegistry.list();
    const targetOptions = targets
      .map((t) => `<option value="${escapeHtml(t.id)}" ${t.id === exportState.targetId ? "selected" : ""}>${escapeHtml(t.displayName)}</option>`)
      .join("");
    const artifact = exportState.artifact;
    const files = artifact
      ? `<ul class="export-files">
           ${artifact.files
             .map(
               (f) => `
             <li class="export-file">
               <div class="export-file-header">
                 <span class="export-file-path">${escapeHtml(f.path)}${f.path === artifact.entryFile ? " <b>(entry)</b>" : ""}</span>
                 <button data-export-copy="${escapeHtml(f.path)}">Copy</button>
                 <button data-export-download="${escapeHtml(f.path)}">Download</button>
               </div>
               <details class="accordion" data-section="export:${escapeHtml(f.path)}" ${expandedSections.has(`export:${f.path}`) ? "open" : ""}>
                 <summary>Preview</summary>
                 <pre class="export-file-code accordion-body"><code>${escapeHtml(f.content)}</code></pre>
               </details>
             </li>`,
             )
             .join("")}
         </ul>
         ${diagnosticsMarkup([...artifact.diagnostics])}`
      : "";
    return `
      <p class="tab-hint">Generates files from the current project via a target plugin — never edits the canvas (R5/R12).</p>
      <label>Target
        <select data-export-target>${targetOptions}</select>
      </label>
      <button data-export-generate ${exportState.generating || !exportState.targetId ? "disabled" : ""}>
        ${exportState.generating ? "Generating…" : "Generate"}
      </button>
      ${exportState.error ? `<p class="export-error" role="alert">${escapeHtml(exportState.error)}</p>` : ""}
      ${files}`;
  }

  function previewMarkup(): string {
    ensurePreviewForm();
    return previewBodyMarkup(project, previewForm, previewMockConfig) + diagnosticsMarkup(previewDiagnostics);
  }

  function markup(n: StudioSchemaNode): string {
    const isRoot = n.id === project.schema.id;
    const label = escapeHtml(n.label || n.name);
    const actions = isRoot
      ? ""
      : `<button data-duplicate="${n.id}" aria-label="Duplicate ${escapeHtml(n.name)}">⧉</button>
         <button data-delete="${n.id}" aria-label="Delete ${escapeHtml(n.name)}">×</button>`;
    const children =
      n.node === "group"
        ? `<div class="drop-zone inside" data-inside="${n.id}" data-index="${n.children.length}">
             ${n.children.length ? "Drop inside" : "Drop first element"}
           </div>
           <ul>${n.children.map(markup).join("")}</ul>`
        : "";
    const arrayItem =
      n.node === "array" ? `<section class="array-item"><b>Item schema</b>${markup(n.item)}</section>` : "";

    return `
      <li class="tree-node ${selected === n.id ? "selected" : ""}">
        <div class="drop-zone" data-before="${n.id}">Before</div>
        <div class="node" draggable="${!isRoot}" tabindex="0" data-node="${n.id}">
          <button class="select" data-select="${n.id}">
            <span class="node-label">${label}${nodeIndicatorsMarkup(n)}</span>
            <small>${n.node}</small>
          </button>
          ${actions}
        </div>
        ${children}
        ${arrayItem}
        <div class="drop-zone" data-after="${n.id}">After</div>
      </li>`;
  }

  function render(): void {
    const idx = buildIndexes(project);
    const current = idx.nodeById.get(selected) ?? project.schema;
    selected = current.id;
    const rootChildren = project.schema.node === "group" ? project.schema.children : [];
    const { diagnostics } = compileToContract(project);
    diagnosticNodeIds = new Set(diagnostics.filter((d) => d.nodeId).map((d) => d.nodeId!));
    const errorCount = diagnostics.filter((d) => d.severity === "error").length;

    host.innerHTML = `
      <div class="studio">
        <header>
          <div><strong>Modyra Studio</strong><span>Vanilla local-first editor</span></div>
          <nav>
            <button data-undo ${history.canUndo() ? "" : "disabled"}>Undo</button>
            <button data-redo ${history.canRedo() ? "" : "disabled"}>Redo</button>
            <button data-new>New blank</button>
          </nav>
        </header>
        <main>
          <aside class="palette">
            <h2>Elements</h2>
            ${TEMPLATES.map((t) => `<button draggable="true" data-template="${t}">＋ ${t}</button>`).join("")}
          </aside>
          <section class="canvas" tabindex="-1">
            <div class="title">
              <h1>${escapeHtml(project.name)}</h1>
              <span>${idx.nodeById.size - 1} nodes</span>
            </div>
            ${
              rootChildren.length
                ? `<ul class="tree">${rootChildren.map(markup).join("")}</ul>`
                : `<div class="empty">
                     <h2>Start with a blank form</h2>
                     <p>Drag an element here or click one in the palette.</p>
                     <div class="drop-zone inside" data-inside="${project.schema.id}" data-index="0">Drop first element</div>
                   </div>`
            }
          </section>
          <aside class="inspector">
            <div class="inspector-tabs" role="tablist">
              <button type="button" role="tab" data-inspector-tab="node" aria-selected="${inspectorTab === "node"}">
                ${current.node === "field" ? "Field" : current.node === "group" ? "Group" : "Array"}
              </button>
              <button type="button" role="tab" data-inspector-tab="form" aria-selected="${inspectorTab === "form"}">
                Form rules${project.formValidators.length ? ` <span class="badge">${project.formValidators.length}</span>` : ""}
              </button>
              <button type="button" role="tab" data-inspector-tab="diagnostics" aria-selected="${inspectorTab === "diagnostics"}">
                Diagnostics${diagnostics.length ? ` <span class="badge ${errorCount ? "badge-error" : ""}">${diagnostics.length}</span>` : ""}
              </button>
              <button type="button" role="tab" data-inspector-tab="export" aria-selected="${inspectorTab === "export"}">
                Export
              </button>
              <button type="button" role="tab" data-inspector-tab="preview" aria-selected="${inspectorTab === "preview"}">
                Preview
              </button>
            </div>
            <div class="inspector-body">
              ${
                inspectorTab === "diagnostics"
                  ? diagnosticsMarkup(diagnostics)
                  : inspectorTab === "export"
                    ? exportMarkup()
                    : inspectorTab === "preview"
                      ? previewMarkup()
                      : inspectorTab === "form"
                        ? formValidatorsMarkup(project, idx, formValidatorDraft)
                        : `
                    <label>Name<input data-name value="${escapeHtml(current.name)}"></label>
                    <label>Label<input data-label value="${escapeHtml(current.label ?? "")}"></label>
                    <label>Description<textarea data-description>${escapeHtml(current.description ?? "")}</textarea></label>
                    ${
                      current.node === "field"
                        ? accordionMarkup(
                            "validation",
                            "Validation",
                            String(current.validators.length || ""),
                            expandedSections.has("validation"),
                            validatorsMarkup(current),
                          )
                        : ""
                    }
                    ${
                      current.node === "field" && (current.fieldKind === "select" || current.fieldKind === "multiselect")
                        ? accordionMarkup(
                            "options",
                            "Options",
                            String((current.options ?? []).length || ""),
                            expandedSections.has("options"),
                            optionsMarkup(current),
                          )
                        : ""
                    }
                    ${
                      current.node === "field"
                        ? accordionMarkup(
                            "server",
                            "Server validation",
                            current.serverValidator ? "on" : "",
                            expandedSections.has("server"),
                            serverValidatorMarkup(project, idx, current),
                          )
                        : ""
                    }
                    ${accordionMarkup(
                      "details",
                      "Details",
                      "",
                      expandedSections.has("details"),
                      `<dl><dt>Path</dt><dd>${escapeHtml(idx.pathByNode.get(current.id) || "root")}</dd><dt>Stable ID</dt><dd>${escapeHtml(current.id)}</dd></dl>`,
                    )}
                  `
              }
            </div>
          </aside>
        </main>
        <footer role="status" aria-live="polite">
          ${escapeHtml(status)}${picked ? ". Arrows reorder or enter and leave containers. Enter drops. Escape cancels." : ""}
        </footer>
      </div>`;

    bind();
    // Fall back to the canvas region (tabindex=-1, programmatic-only) when the requested target
    // no longer exists — e.g. deleting the tree's last node leaves no [data-node] to focus.
    // Focus must never silently fall through to <body>.
    const primaryTarget = focusSelector ? host.querySelector<HTMLElement>(focusSelector) : null;
    const focusTarget = primaryTarget ?? host.querySelector<HTMLElement>(".canvas");
    focusTarget?.focus();
    focusSelector = null;
  }

  function bind(): void {
    host.querySelectorAll<HTMLElement>("[draggable=true]").forEach((el) => {
      el.addEventListener("dragstart", () => {
        drag = el.dataset.template ? { template: el.dataset.template } : { nodeId: el.dataset.node! };
      });
    });

    host.querySelectorAll<HTMLElement>(".drop-zone").forEach((el) => {
      el.addEventListener("dragover", (e) => e.preventDefault());
      el.addEventListener("drop", () => {
        if (el.dataset.before) drop({ kind: "before", targetId: el.dataset.before });
        else if (el.dataset.after) drop({ kind: "after", targetId: el.dataset.after });
        else drop({ kind: "inside", parentId: el.dataset.inside!, index: Number(el.dataset.index) });
      });
    });

    host.querySelectorAll<HTMLElement>("[data-select]").forEach((el) =>
      el.addEventListener("click", () => {
        selected = el.dataset.select!;
        render();
      }),
    );
    host.querySelectorAll<HTMLElement>("[data-delete]").forEach((el) =>
      el.addEventListener("click", () => remove(el.dataset.delete!)),
    );
    host.querySelectorAll<HTMLElement>("[data-duplicate]").forEach((el) =>
      el.addEventListener("click", () => commit(createDuplicateCommand(el.dataset.duplicate!))),
    );
    host.querySelectorAll<HTMLElement>("[data-template]").forEach((el) =>
      el.addEventListener("click", () => {
        const created = createNodeFromTemplate(el.dataset.template!);
        const index = project.schema.node === "group" ? project.schema.children.length : 0;
        selected = created.id;
        commit(createInsertCommand(created, { kind: "inside", parentId: project.schema.id, index }));
      }),
    );

    host.querySelector<HTMLElement>("[data-undo]")?.addEventListener("click", () => {
      project = history.undo(project);
      status = "Undo";
      // Undo may just have run out (button about to go `disabled`, which refuses focus) —
      // Redo is always enabled right after a successful undo, so it's a safe fallback target.
      focusSelector = history.canUndo() ? "[data-undo]" : "[data-redo]";
      render();
    });
    host.querySelector<HTMLElement>("[data-redo]")?.addEventListener("click", () => {
      project = history.redo(project);
      status = "Redo";
      focusSelector = history.canRedo() ? "[data-redo]" : "[data-undo]";
      render();
    });
    host.querySelector<HTMLElement>("[data-new]")?.addEventListener("click", () => {
      project = createBlankProject();
      selected = project.schema.id;
      status = "New blank project";
      focusSelector = "[data-new]";
      render();
    });

    host.querySelector<HTMLInputElement>("[data-name]")?.addEventListener("change", (e) =>
      commit(createUpdateNodeCommand(selected, { name: (e.target as HTMLInputElement).value })),
    );
    host.querySelector<HTMLInputElement>("[data-label]")?.addEventListener("change", (e) =>
      commit(createUpdateNodeCommand(selected, { label: (e.target as HTMLInputElement).value })),
    );
    host.querySelector<HTMLTextAreaElement>("[data-description]")?.addEventListener("change", (e) =>
      commit(createUpdateNodeCommand(selected, { description: (e.target as HTMLTextAreaElement).value })),
    );

    host.querySelector<HTMLSelectElement>("[data-add-validator]")?.addEventListener("change", (e) => {
      const kind = (e.target as HTMLSelectElement).value as StudioValidatorKind | "";
      if (!kind) return;
      const entry = getFieldValidatorRegistryEntry(kind);
      commit(createAddValidatorCommand(selected, { id: createId("val"), kind, ...entry?.defaultConfig() }));
    });
    host.querySelectorAll<HTMLElement>("[data-remove-validator]").forEach((el) =>
      el.addEventListener("click", () => commit(createRemoveValidatorCommand(selected, el.dataset.removeValidator!))),
    );
    host.querySelectorAll<HTMLInputElement>("[data-validator-pattern]").forEach((el) =>
      el.addEventListener("change", () =>
        commit(createUpdateValidatorCommand(selected, el.dataset.validatorPattern!, { pattern: el.value })),
      ),
    );
    host.querySelectorAll<HTMLInputElement>("[data-validator-message]").forEach((el) =>
      el.addEventListener("change", () =>
        commit(createUpdateValidatorCommand(selected, el.dataset.validatorMessage!, { message: el.value })),
      ),
    );
    host.querySelectorAll<HTMLInputElement>("[data-validator-value]").forEach((el) =>
      el.addEventListener("change", () =>
        commit(createUpdateValidatorCommand(selected, el.dataset.validatorValue!, { value: Number(el.value) })),
      ),
    );

    host.querySelectorAll<HTMLInputElement>("[data-option-value]").forEach((el) =>
      el.addEventListener("change", () => {
        const field = getSelectedField();
        if (!field) return;
        const options = [...(field.options ?? [])];
        const index = Number(el.dataset.optionValue);
        options[index] = { ...options[index]!, value: el.value };
        commit(createSetFieldOptionsCommand(selected, options));
      }),
    );
    host.querySelectorAll<HTMLInputElement>("[data-option-label]").forEach((el) =>
      el.addEventListener("change", () => {
        const field = getSelectedField();
        if (!field) return;
        const options = [...(field.options ?? [])];
        const index = Number(el.dataset.optionLabel);
        options[index] = { ...options[index]!, label: el.value };
        commit(createSetFieldOptionsCommand(selected, options));
      }),
    );
    host.querySelectorAll<HTMLElement>("[data-remove-option]").forEach((el) =>
      el.addEventListener("click", () => {
        const field = getSelectedField();
        if (!field) return;
        const index = Number(el.dataset.removeOption);
        commit(createSetFieldOptionsCommand(selected, (field.options ?? []).filter((_, i) => i !== index)));
      }),
    );
    host.querySelector<HTMLElement>("[data-add-option]")?.addEventListener("click", () => {
      const field = getSelectedField();
      if (!field) return;
      commit(createSetFieldOptionsCommand(selected, [...(field.options ?? []), { value: "", label: "" }]));
    });

    host.querySelectorAll<HTMLElement>("[data-inspector-tab]").forEach((el) =>
      el.addEventListener("click", () => {
        const tab = el.dataset.inspectorTab as "node" | "form" | "diagnostics" | "export" | "preview";
        inspectorTab = tab;
        focusSelector = `[data-inspector-tab="${tab}"]`;
        render();
      }),
    );
    // Native <details> already toggled itself in the DOM by the time this fires — just keep our
    // tracked state in sync so it survives the *next* full re-render (innerHTML replace forgets it).
    host.querySelectorAll<HTMLDetailsElement>("details.accordion").forEach((el) =>
      el.addEventListener("toggle", () => {
        const id = el.dataset.section!;
        if (el.open) expandedSections.add(id);
        else expandedSections.delete(id);
      }),
    );

    host.querySelectorAll<HTMLElement>("[data-goto-node]").forEach((el) =>
      el.addEventListener("click", () => {
        const nodeId = el.dataset.gotoNode!;
        selected = nodeId;
        inspectorTab = "node";
        focusSelector = `[data-node="${nodeId}"]`;
        render();
      }),
    );
    host.querySelectorAll<HTMLElement>("[data-fix-clear-pattern]").forEach((el) =>
      el.addEventListener("click", () =>
        commit(createUpdateValidatorCommand(el.dataset.fixNode!, el.dataset.fixClearPattern!, { pattern: "" })),
      ),
    );
    host.querySelectorAll<HTMLElement>("[data-fix-add-option]").forEach((el) =>
      el.addEventListener("click", () =>
        commit(createSetFieldOptionsCommand(el.dataset.fixAddOption!, [{ value: "option", label: "Option" }])),
      ),
    );
    host.querySelectorAll<HTMLElement>("[data-fix-exclude-draft]").forEach((el) =>
      el.addEventListener("click", () => {
        const nodeId = el.dataset.fixExcludeDraft!;
        const currentDraft = project.behaviors.draft;
        const exclude = [...(currentDraft?.exclude ?? []), { nodeId }];
        commit(createUpdateBehaviorCommand({ draft: { key: currentDraft?.key ?? "draft", exclude } }));
      }),
    );

    host.querySelector<HTMLElement>("[data-enable-server-validator]")?.addEventListener("click", () => {
      commit(
        createSetServerValidatorCommand(selected, {
          id: createId("val"),
          kind: "server",
          implementationRef: "",
          dependencies: [],
          debounceMs: 400,
          timeoutMs: 5000,
        }),
      );
    });
    host.querySelector<HTMLElement>("[data-remove-server-validator]")?.addEventListener("click", () => {
      commit(createSetServerValidatorCommand(selected, null));
    });
    host.querySelector<HTMLSelectElement>("[data-server-impl]")?.addEventListener("change", (e) => {
      const field = getSelectedField();
      if (!field?.serverValidator) return;
      commit(createSetServerValidatorCommand(selected, { ...field.serverValidator, implementationRef: (e.target as HTMLSelectElement).value }));
    });
    host.querySelector<HTMLElement>("[data-new-server-impl]")?.addEventListener("click", () => {
      const field = getSelectedField();
      if (!field?.serverValidator) return;
      const ref = {
        id: createId("impl"),
        role: "serverValidator" as const,
        displayName: `validate${field.name.charAt(0).toUpperCase()}${field.name.slice(1)}`,
        mode: "stub" as const,
      };
      commit(createAddImplementationCommand(ref));
      commit(createSetServerValidatorCommand(selected, { ...field.serverValidator, implementationRef: ref.id }));
    });
    host.querySelector<HTMLInputElement>("[data-server-debounce]")?.addEventListener("change", (e) => {
      const field = getSelectedField();
      if (!field?.serverValidator) return;
      commit(createSetServerValidatorCommand(selected, { ...field.serverValidator, debounceMs: Number((e.target as HTMLInputElement).value) }));
    });
    host.querySelector<HTMLInputElement>("[data-server-timeout]")?.addEventListener("change", (e) => {
      const field = getSelectedField();
      if (!field?.serverValidator) return;
      commit(createSetServerValidatorCommand(selected, { ...field.serverValidator, timeoutMs: Number((e.target as HTMLInputElement).value) }));
    });
    host.querySelector<HTMLInputElement>("[data-server-skip-empty]")?.addEventListener("change", (e) => {
      const field = getSelectedField();
      if (!field?.serverValidator) return;
      const next = { ...field.serverValidator };
      if ((e.target as HTMLInputElement).checked) next.skipWhen = { op: "isEmpty", operand: { nodeId: selected } };
      else delete next.skipWhen;
      commit(createSetServerValidatorCommand(selected, next));
    });
    host.querySelector<HTMLInputElement>("[data-server-message]")?.addEventListener("change", (e) => {
      const field = getSelectedField();
      if (!field?.serverValidator) return;
      commit(createSetServerValidatorCommand(selected, { ...field.serverValidator, errorMessage: (e.target as HTMLInputElement).value }));
    });
    host.querySelectorAll<HTMLInputElement>("[data-server-dependency]").forEach((el) =>
      el.addEventListener("change", () => {
        const field = getSelectedField();
        if (!field?.serverValidator) return;
        const checkedIds = Array.from(host.querySelectorAll<HTMLInputElement>("[data-server-dependency]"))
          .filter((c) => c.checked)
          .map((c) => c.dataset.serverDependency!);
        commit(createSetServerValidatorCommand(selected, { ...field.serverValidator, dependencies: checkedIds.map((nodeId) => ({ nodeId })) }));
      }),
    );

    host.querySelector<HTMLSelectElement>("[data-fv-ref]")?.addEventListener("change", (e) => {
      formValidatorDraft = { ...formValidatorDraft, refNodeId: (e.target as HTMLSelectElement).value };
      render();
    });
    host.querySelector<HTMLSelectElement>("[data-fv-op]")?.addEventListener("change", (e) => {
      formValidatorDraft = { ...formValidatorDraft, op: (e.target as HTMLSelectElement).value as StudioExpressionOp };
      render();
    });
    host.querySelector<HTMLInputElement>("[data-fv-literal]")?.addEventListener("change", (e) => {
      formValidatorDraft = { ...formValidatorDraft, literal: (e.target as HTMLInputElement).value };
    });
    host.querySelectorAll<HTMLSelectElement>("[data-fv-sub-ref]").forEach((el) =>
      el.addEventListener("change", () => {
        const index = Number(el.dataset.fvSubRef) as 0 | 1;
        const subConditions: [ConditionDraft, ConditionDraft] = [...formValidatorDraft.subConditions];
        subConditions[index] = { ...subConditions[index], refNodeId: el.value };
        formValidatorDraft = { ...formValidatorDraft, subConditions };
      }),
    );
    host.querySelectorAll<HTMLSelectElement>("[data-fv-sub-op]").forEach((el) =>
      el.addEventListener("change", () => {
        const index = Number(el.dataset.fvSubOp) as 0 | 1;
        const subConditions: [ConditionDraft, ConditionDraft] = [...formValidatorDraft.subConditions];
        subConditions[index] = { ...subConditions[index], op: el.value as StudioExpressionOp };
        formValidatorDraft = { ...formValidatorDraft, subConditions };
        render();
      }),
    );
    host.querySelectorAll<HTMLInputElement>("[data-fv-sub-literal]").forEach((el) =>
      el.addEventListener("change", () => {
        const index = Number(el.dataset.fvSubLiteral) as 0 | 1;
        const subConditions: [ConditionDraft, ConditionDraft] = [...formValidatorDraft.subConditions];
        subConditions[index] = { ...subConditions[index], literal: el.value };
        formValidatorDraft = { ...formValidatorDraft, subConditions };
      }),
    );
    host.querySelector<HTMLSelectElement>("[data-fv-target]")?.addEventListener("change", (e) => {
      formValidatorDraft = { ...formValidatorDraft, errorTargetId: (e.target as HTMLSelectElement).value };
    });
    host.querySelector<HTMLInputElement>("[data-fv-message]")?.addEventListener("change", (e) => {
      formValidatorDraft = { ...formValidatorDraft, message: (e.target as HTMLInputElement).value };
    });
    host.querySelector<HTMLElement>("[data-add-form-validator]")?.addEventListener("click", () => {
      commit(createAddFormValidatorCommand(buildFormValidatorFromDraft(formValidatorDraft)));
      formValidatorDraft = { ...formValidatorDraft, literal: "", message: "" };
    });
    host.querySelectorAll<HTMLElement>("[data-remove-form-validator]").forEach((el) =>
      el.addEventListener("click", () => commit(createRemoveFormValidatorCommand(el.dataset.removeFormValidator!))),
    );
    host.querySelectorAll<HTMLInputElement>("[data-form-validator-message]").forEach((el) =>
      el.addEventListener("change", () =>
        commit(createUpdateFormValidatorCommand(el.dataset.formValidatorMessage!, { message: el.value })),
      ),
    );

    host.querySelector<HTMLSelectElement>("[data-submit-impl]")?.addEventListener("change", (e) => {
      const value = (e.target as HTMLSelectElement).value;
      commit(createUpdateBehaviorCommand({ submit: value ? { implementationRef: value } : undefined }));
    });
    host.querySelector<HTMLElement>("[data-new-submit-impl]")?.addEventListener("click", () => {
      const id = createId("impl");
      const ref = { id, role: "submitAction" as const, displayName: `submitForm${id.slice(-5)}`, mode: "stub" as const };
      commit(createAddImplementationCommand(ref));
      commit(createUpdateBehaviorCommand({ submit: { implementationRef: ref.id } }));
    });
    host.querySelector<HTMLElement>("[data-remove-submit-action]")?.addEventListener("click", () => {
      commit(createUpdateBehaviorCommand({ submit: undefined }));
    });

    host.querySelector<HTMLSelectElement>("[data-export-target]")?.addEventListener("change", (e) => {
      exportState = { ...exportState, targetId: (e.target as HTMLSelectElement).value, artifact: null, error: null };
      render();
    });
    host.querySelector<HTMLElement>("[data-export-generate]")?.addEventListener("click", () => {
      void runExport();
    });
    host.querySelectorAll<HTMLElement>("[data-export-download]").forEach((el) =>
      el.addEventListener("click", () => {
        const path = el.dataset.exportDownload!;
        const file = exportState.artifact?.files.find((f) => f.path === path);
        if (!file) return;
        const blob = new Blob([file.content], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = path.split("/").pop() ?? path;
        a.click();
        URL.revokeObjectURL(url);
      }),
    );
    host.querySelectorAll<HTMLButtonElement>("[data-export-copy]").forEach((el) =>
      el.addEventListener("click", () => {
        const path = el.dataset.exportCopy!;
        const file = exportState.artifact?.files.find((f) => f.path === path);
        if (!file) return;
        const original = el.textContent;
        navigator.clipboard
          .writeText(file.content)
          .then(() => {
            el.textContent = "Copied!";
            setTimeout(() => {
              el.textContent = original;
            }, 1500);
          })
          .catch(() => {
            el.textContent = "Copy failed";
            setTimeout(() => {
              el.textContent = original;
            }, 1500);
          });
      }),
    );

    host.querySelectorAll<HTMLElement>("[data-preview-field]").forEach((el) =>
      el.addEventListener("change", () => {
        const path = el.dataset.previewField!;
        const handle = getPreviewHandle(previewForm, path);
        const valueSignal = handle?.value as { set(v: unknown): void } | undefined;
        if (!valueSignal) return;
        if (el instanceof HTMLInputElement && el.type === "checkbox") valueSignal.set(el.checked);
        else if (el instanceof HTMLInputElement && el.type === "number") valueSignal.set(el.value === "" ? null : Number(el.value));
        else if (el instanceof HTMLSelectElement && el.multiple) valueSignal.set(Array.from(el.selectedOptions).map((o) => o.value));
        else valueSignal.set((el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value);
      }),
    );
    host.querySelectorAll<HTMLElement>("[data-preview-array-push]").forEach((el) =>
      el.addEventListener("click", () => {
        const path = el.dataset.previewArrayPush!;
        const handle = getPreviewHandle(previewForm, path) as { push?(v: unknown): void } | null;
        const idx = buildIndexes(project);
        const nodeId = idx.nodeByPath.get(path);
        const node = nodeId ? idx.nodeById.get(nodeId) : null;
        if (handle?.push && node?.node === "array") handle.push(defaultRowValue(node.item));
      }),
    );
    host.querySelectorAll<HTMLElement>("[data-preview-array-remove]").forEach((el) =>
      el.addEventListener("click", () => {
        const path = el.dataset.previewArrayRemove!;
        const index = Number(el.dataset.previewArrayIndex);
        const handle = getPreviewHandle(previewForm, path) as { remove?(i: number): void } | null;
        handle?.remove?.(index);
      }),
    );
    host.querySelectorAll<HTMLSelectElement>("[data-preview-mock-mode]").forEach((el) =>
      el.addEventListener("change", () => {
        const implId = el.dataset.previewMockMode!;
        const mode = el.value;
        previewMockConfig = {
          ...previewMockConfig,
          [implId]: mode === "error" ? { forceError: "Simulated server error" } : mode === "network" ? { forceNetworkFailure: true } : {},
        };
        previewForProject = null; // force ensurePreviewForm() to rebuild with the new mock config
        render();
      }),
    );
    host.querySelector<HTMLElement>("[data-preview-submit]")?.addEventListener("click", () => {
      if (!previewForm) return;
      const submitRef = project.behaviors.submit?.implementationRef;
      const mockCfg = submitRef ? previewMockConfig[submitRef] : undefined;
      void previewForm.submit(createMockSubmitAction(mockCfg ?? {}));
    });

    host.querySelectorAll<HTMLElement>("[data-node]").forEach((el) =>
      el.addEventListener("keydown", (e) => keyboard(e, el.dataset.node!)),
    );

    const canvas = host.querySelector<HTMLElement>(".canvas");
    canvas?.addEventListener("dragover", (e) => {
      const rect = canvas.getBoundingClientRect();
      if (e.clientY - rect.top < 50) canvas.scrollTop -= 12;
      if (rect.bottom - e.clientY < 50) canvas.scrollTop += 12;
    });
  }

  function keyboard(event: KeyboardEvent, id: string): void {
    const idx = buildIndexes(project);

    if (event.key === " " && !picked) {
      event.preventDefault();
      picked = id;
      status = `Picked up ${idx.nodeById.get(id)?.label ?? id}`;
      focusSelector = `[data-node="${id}"]`;
      render();
      return;
    }
    if (event.key === "Escape" && picked) {
      status = "Move cancelled";
      focusSelector = `[data-node="${picked}"]`;
      picked = null;
      render();
      return;
    }
    if (!picked) return;

    const parent = idx.parentById.get(picked);
    const siblings = parent ? (idx.childrenByParent.get(parent) ?? []) : [];
    const position = siblings.indexOf(picked);

    if ((event.key === "ArrowUp" || event.key === "ArrowDown") && position >= 0) {
      event.preventDefault();
      const target = siblings[position + (event.key === "ArrowUp" ? -1 : 1)];
      if (target) {
        commit(createMoveCommand(picked, { kind: event.key === "ArrowUp" ? "before" : "after", targetId: target }), picked);
      }
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      const previousSibling = siblings[position - 1];
      const container = previousSibling ? idx.nodeById.get(previousSibling) : null;
      if (container?.node === "group") {
        commit(createMoveCommand(picked, { kind: "inside", parentId: container.id, index: container.children.length }), picked);
      }
    } else if (event.key === "ArrowLeft" && parent) {
      const grandparent = idx.parentById.get(parent);
      if (grandparent) {
        event.preventDefault();
        commit(createMoveCommand(picked, { kind: "after", targetId: parent }), picked);
      }
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      status = "Drop completed";
      focusSelector = `[data-node="${picked}"]`;
      picked = null;
      render();
    }
  }

  render();
  return () => {
    previewEffect?.destroy();
    host.replaceChildren();
  };
}
