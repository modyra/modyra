/**
 * Vanilla (no framework) Studio canvas shell — palette, tree, inspector,
 * pointer drag + keyboard-equivalent reordering, undo/redo. Consumes
 * @modyra/studio-model (project/indexes) and @modyra/studio-editor
 * (commands/history) only; owns no model logic itself ().
 */
import {
  buildIndexes,
  compatibleValidatorKinds,
  createBlankProject,
  createId,
  getFieldValidatorRegistryEntry,
  isDuplicateKindAllowed,
  type ArrayNode,
  type FieldNode,
  type GroupNode,
  type MdyStudioProject,
  type StudioDiagnostic,
  type StudioExpression,
  type StudioExpressionOp,
  type StudioFormValidator,
  type StudioIndexes,
  type StudioLayoutChild,
  type StudioLayoutNode,
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
  createRenameProjectCommand,
  createUpdateLayoutCommand,
  createUpdateFormValidatorCommand,
  createUpdateNodeCommand,
  createUpdateValidatorCommand,
  inspectDelete,
  type Command,
  type Placement,
} from "@modyra/studio-editor";
import { mountMdyForm, type MdyPlainForm } from "@modyra/plain";
import { compileToContract, flattenContractFields } from "@modyra/studio-contract";
import {
  MDY_FIELD_SHELL_CLASSES,
  MDY_LAYOUT_CLASSES,
  MDY_WIDGET_CONTRACTS,
  type MdyWidgetKind,
} from "@modyra/widgets";
import { TargetRegistry, type Artifact } from "@modyra/studio-codegen";
import { jsonTargetManifest } from "@modyra/studio-target-json";
import { coreTargetManifest } from "@modyra/studio-target-core";
import { angularTargetManifest } from "@modyra/studio-target-angular";
import { reactTargetManifest } from "@modyra/studio-target-react";
import { buildLiveForm, createMockSubmitAction, vanillaReactivity, type MdyTypedForm, type MockServerConfig } from "@modyra/studio-preview";
import { StudioCanvasController, StudioRuntimeSession } from "./canvas-controller.js";
import { installColumns, type StudioColumns } from "./columns.js";
import { Region, ScrollMemory } from "./regions.js";
import { importProjectFromText, loadSession, saveSession } from "./storage.js";
import "./studio.css";

type Drag = { nodeId: string } | { template: string };

/** Lazy target registry (ADR-0004) — registering costs nothing, load() only runs on first Generate. */
const targetRegistry = new TargetRegistry();
targetRegistry.register(jsonTargetManifest);
targetRegistry.register(coreTargetManifest);
targetRegistry.register(angularTargetManifest);
targetRegistry.register(reactTargetManifest);

/**
 * The insertable catalog, in one place: the floating toolbar renders it, the
 * insert palette filters it, and `createNodeFromTemplate` builds from it. `terms`
 * are extra words the palette matches on, so "dropdown" finds `select` and
 * "phone"/"url" find `text` — the point of typing to insert is that you should
 * not have to know Modyra's own vocabulary.
 */
interface FieldTemplate {
  readonly id: string;
  readonly label: string;
  readonly group: "Fields" | "Choice" | "Structure";
  readonly terms: readonly string[];
}

const TEMPLATE_CATALOG: readonly FieldTemplate[] = [
  { id: "text", label: "Text", group: "Fields", terms: ["input", "string", "name", "phone", "url"] },
  { id: "textarea", label: "Long text", group: "Fields", terms: ["multiline", "paragraph", "notes", "message"] },
  { id: "email", label: "Email", group: "Fields", terms: ["mail", "address"] },
  { id: "password", label: "Password", group: "Fields", terms: ["secret", "secure"] },
  { id: "number", label: "Number", group: "Fields", terms: ["numeric", "amount", "quantity", "price"] },
  { id: "slider", label: "Slider", group: "Fields", terms: ["range", "scale"] },
  { id: "date", label: "Date", group: "Fields", terms: ["calendar", "day", "birthday"] },
  { id: "time", label: "Time", group: "Fields", terms: ["clock", "hour", "minute"] },
  { id: "checkbox", label: "Checkbox", group: "Choice", terms: ["boolean", "tick", "agree", "consent"] },
  { id: "toggle", label: "Toggle", group: "Choice", terms: ["switch", "boolean", "on off"] },
  { id: "select", label: "Dropdown", group: "Choice", terms: ["select", "combobox", "picker", "list"] },
  { id: "radio", label: "Radio group", group: "Choice", terms: ["option", "single choice", "one of"] },
  { id: "segmented", label: "Segmented", group: "Choice", terms: ["tabs", "buttons", "single choice"] },
  { id: "multiselect", label: "Multi-select", group: "Choice", terms: ["tags", "many", "multiple choice"] },
  { id: "group", label: "Group", group: "Structure", terms: ["object", "nested", "fieldset"] },
  { id: "array", label: "Repeater", group: "Structure", terms: ["list", "rows", "items", "repeat"] },
];

/** Kinds whose value comes from a declared option list — seeded with one option so they compile. */
const OPTION_TEMPLATES: ReadonlySet<string> = new Set(["select", "radio", "segmented", "multiselect"]);

const VALUE_TYPE_BY_TEMPLATE: Record<string, FieldNode["valueType"]> = {
  number: "number",
  slider: "number",
  checkbox: "boolean",
  toggle: "boolean",
  multiselect: "string[]",
  date: "date",
};

/** Ranks the catalog against a free-text query. Empty query keeps catalog order. */
function filterTemplates(query: string): readonly FieldTemplate[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return TEMPLATE_CATALOG;
  const scored = TEMPLATE_CATALOG.flatMap((template) => {
    const label = template.label.toLowerCase();
    // A label prefix is what the user almost always means ("da" -> Date, not "validate").
    if (label.startsWith(needle)) return [{ template, score: 0 }];
    if (label.includes(needle)) return [{ template, score: 1 }];
    if (template.id.includes(needle)) return [{ template, score: 2 }];
    if (template.terms.some((term) => term.includes(needle))) return [{ template, score: 3 }];
    return [];
  });
  return scored.sort((a, b) => a.score - b.score).map((entry) => entry.template);
}

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

  const valueType = VALUE_TYPE_BY_TEMPLATE[template] ?? "string";
  const initialValue =
    valueType === "number" ? 0
    : valueType === "boolean" ? false
    : valueType === "string[]" ? []
    : "";

  return {
    node: "field",
    id,
    name: `${template}${suffix}`,
    label: TEMPLATE_CATALOG.find((t) => t.id === template)?.label ?? `New ${template}`,
    fieldKind: template as never,
    valueType,
    initialValue,
    validators: [],
    ...(OPTION_TEMPLATES.has(template) ? { options: [{ value: "option", label: "Option" }] } : {}),
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

/** "Validation" section body — add/edit/remove, only ever offering registry-compatible kinds. */
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

/** "Options" section body, select/multiselect only ("properties options"). */
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

/** All nodes by derived path, for a <select> — the only way any ref is ever picked (no path typing, /). */
function nodeRefOptionsMarkup(idx: StudioIndexes, currentId: string): string {
  return [...idx.nodeById.keys()]
    .map((id) => ({ id, path: idx.pathByNode.get(id) || "root" }))
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((e) => `<option value="${e.id}" ${e.id === currentId ? "selected" : ""}>${escapeHtml(e.path)}</option>`)
    .join("");
}

/** "Server validation" inspector section — dependencies, debounce/timeout, skip-when-empty, stub creation. */
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
    Compound conditions support one level of `and`, `or` and `not`; arbitrary recursive editing is not exposed here. */
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
    2 = binary ("and"/"or" combine two). These operators
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

/** submit-action stub UI, mirroring the server-validator implementation picker. */
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

/** project-level "Form validators" section — always visible (not tied to node selection). */
export function formValidatorsMarkup(project: MdyStudioProject, idx: StudioIndexes, draft: FormValidatorDraft): string {
  const rows = project.formValidators
    .map((v) => {
      // Root's derived path is "" by design () — `|| "(none)"` on the joined string would wrongly
      // read a root-only dependency as "no dependencies" (empty-string path -> falsy join result).
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

/** Initial value for a newly-pushed array row, built from the item schema's own field defaults (nested arrays inside an array item are not supported — a documented limitation). */
export function defaultRowValue(item: FieldNode | GroupNode): unknown {
  if (item.node === "field") return item.initialValue;
  const row: Record<string, unknown> = {};
  for (const child of item.children) if (child.node !== "array") row[child.name] = defaultRowValue(child as FieldNode | GroupNode);
  return row;
}

/**
 * The widget each Studio field kind is, so the preview can wear that widget's root classes.
 *
 * Studio's `fieldKind` and the catalog's `MdyWidgetKind` mostly agree; where they do not, this is
 * the one place that says so rather than each call site guessing.
 */
const PREVIEW_WIDGET_KIND: Readonly<Record<string, MdyWidgetKind>> = Object.freeze({
  text: "text", email: "email", password: "password", textarea: "textarea",
  number: "number", slider: "slider", checkbox: "checkbox", toggle: "toggle",
  select: "select", radio: "radio", multiselect: "multiselect", segmented: "segmented",
  date: "datepicker", datepicker: "datepicker", daterange: "daterange", timepicker: "timepicker",
  file: "file", colors: "colors",
});

/** one live field, bound to the real form handle at `path` — rather than a static description (). */
export function previewFieldMarkup(node: FieldNode, path: string, form: MdyTypedForm<never> | null, mockConfig: Record<string, MockServerConfig>): string {
  const handle = getPreviewHandle(form, path);
  if (!handle) return "";
  const value = (handle.value as () => unknown)();
  const errors = (handle.errors as () => ReadonlyArray<{ message: string }>)();
  const pending = (handle.pending as () => boolean)();
  const label = escapeHtml(node.label || node.name);

  let control: string;
  if (node.fieldKind === "textarea") {
    control = `<textarea id="preview-${path}" data-preview-field="${path}">${escapeHtml(String(value ?? ""))}</textarea>`;
  } else if (node.fieldKind === "number") {
    control = `<input id="preview-${path}" type="number" data-preview-field="${path}" value="${escapeHtml(String(value ?? ""))}">`;
  } else if (node.fieldKind === "checkbox") {
    control = `<input id="preview-${path}" type="checkbox" data-preview-field="${path}" data-preview-checkbox ${value ? "checked" : ""}>`;
  } else if (node.fieldKind === "select") {
    const options = (node.options ?? [])
      .map((o) => `<option value="${escapeHtml(o.value)}" ${o.value === value ? "selected" : ""}>${escapeHtml(o.label)}</option>`)
      .join("");
    control = `<select id="preview-${path}" data-preview-field="${path}"><option value="">— choose —</option>${options}</select>`;
  } else if (node.fieldKind === "multiselect") {
    const selectedValues = Array.isArray(value) ? (value as unknown[]) : [];
    const options = (node.options ?? [])
      .map((o) => `<option value="${escapeHtml(o.value)}" ${selectedValues.includes(o.value) ? "selected" : ""}>${escapeHtml(o.label)}</option>`)
      .join("");
    control = `<select id="preview-${path}" multiple data-preview-field="${path}">${options}</select>`;
  } else if (node.fieldKind === "date") {
    control = `<input id="preview-${path}" type="date" data-preview-field="${path}" value="${escapeHtml(String(value ?? ""))}">`;
  } else {
    control = `<input id="preview-${path}" type="${node.fieldKind === "email" ? "email" : "text"}" data-preview-field="${path}" value="${escapeHtml(String(value ?? ""))}">`;
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

  // The shell is the contract's, not Studio's. These controls used to wear `preview-field`,
  // `preview-errors` and `preview-pending` — names only Studio styled — so the panel that exists to
  // show you the real form showed it in a costume. Wearing `mdy-renderer`, `mdy-label`,
  // `mdy-input-wrapper` and `mdy-control__errors` means the foundation paints them, and the preview
  // matches the canvas and the shipped form without Studio restating a single rule.
  const kind = PREVIEW_WIDGET_KIND[node.fieldKind] ?? "text";
  const root = MDY_WIDGET_CONTRACTS[kind].rootClasses.join(" ");
  const shell = MDY_FIELD_SHELL_CLASSES;
  return `
    <div class="${root}" data-preview-node="${escapeHtml(path)}">
      <label class="${shell.label}" for="preview-${escapeHtml(path)}">${label}${pending ? ` <span class="${shell.supportingText}">checking…</span>` : ""}</label>
      <div class="${shell.inputWrapper}">${control}</div>
      ${errors.length
        ? `<div class="${shell.errors}">${errors.map((e) => `<span class="${shell.errorItem}">${escapeHtml(e.message)}</span>`).join("")}</div>`
        : ""}
    </div>
    ${serverMock}`;
}

/** a field, group, or array node — recurses, always reading the real live handle at each computed path. */
export function previewNodeMarkup(node: StudioSchemaNode, path: string, form: MdyTypedForm<never> | null, mockConfig: Record<string, MockServerConfig>): string {
  if (node.node === "field") return previewFieldMarkup(node, path, form, mockConfig);
  if (node.node === "group") {
    return `
      <fieldset class="${MDY_LAYOUT_CLASSES.section}">
        <legend class="${MDY_LAYOUT_CLASSES.sectionLabel}">${escapeHtml(node.label || node.name)}</legend>
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

/** ("Preview reads model/Contract, not generated source"): status badges, every field live-bound, Submit. Diagnostics are appended by the caller (mountStudio already has a diagnosticsMarkup() it reuses everywhere else). */
/**
 * Preview renders the same arrangement the canvas does: a column row here is the same
 * `.mdy-layout-columns` grid @modyra/plain emits, so what you preview matches what ships
 * rather than being a second, drifting picture of the form.
 *
 * The row is emitted at its first member's position, the same splice rule plain uses.
 */
function previewRootMarkup(
  rootChildren: readonly StudioSchemaNode[],
  layout: ReadonlyArray<StudioLayoutNode>,
  form: MdyTypedForm<never> | null,
  mockConfig: Record<string, MockServerConfig>,
): string {
  const columnRows = layout.filter((node): node is StudioLayoutNode & { kind: "columns" } => node.kind === "columns");
  if (!columnRows.length) {
    return rootChildren.map((c) => previewNodeMarkup(c, c.name, form, mockConfig)).join("");
  }

  const byId = new Map(rootChildren.map((child) => [child.id, child]));
  const rowFor = new Map<string, StudioLayoutNode & { kind: "columns" }>();
  const claimed = new Set<string>();
  for (const row of columnRows) {
    const members = row.columns.flat().flatMap((child) => ("nodeId" in child ? [child.nodeId] : []));
    const anchorId = members.find((id) => byId.has(id) && !claimed.has(id));
    if (anchorId === undefined) continue;
    rowFor.set(anchorId, row);
    for (const id of members) claimed.add(id);
  }

  return rootChildren
    .map((child) => {
      const row = rowFor.get(child.id);
      if (row) {
        const cells = row.columns
          .map((column) => {
            const inner = column
              .flatMap((slot) => ("nodeId" in slot ? [byId.get(slot.nodeId)] : []))
              .filter((node): node is StudioSchemaNode => Boolean(node))
              .map((node) => previewNodeMarkup(node, node.name, form, mockConfig))
              .join("");
            return `<div class="mdy-layout-column">${inner}</div>`;
          })
          .join("");
        return `<div class="mdy-layout-columns" style="--mdy-layout-column-count:${row.columns.length}">${cells}</div>`;
      }
      return claimed.has(child.id) ? "" : previewNodeMarkup(child, child.name, form, mockConfig);
    })
    .join("");
}

export function previewBodyMarkup(
  project: MdyStudioProject,
  form: MdyTypedForm<never> | null,
  mockConfig: Record<string, MockServerConfig>,
  layout: ReadonlyArray<StudioLayoutNode> = project.presentation.layout ?? [],
): string {
  if (!form) {
    return `<p class="tab-hint">Preview needs a group at the schema root.</p>`;
  }
  const rootChildren = project.schema.node === "group" ? project.schema.children : [];
  const fields = previewRootMarkup(rootChildren, layout, form, mockConfig);
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
/**
 * Optional off-main-thread generate. Given the same request `runExport()` would otherwise pass to
 * `targetRegistry.load()` + `target.generate()` directly, resolves to the
 * same {@link Artifact} shape. The host (e.g. apps/studio's main.ts) owns
 * the actual `Worker` and its message-passing; studio-ui stays worker/DOM-
 * host agnostic and falls back to the in-thread path when this is absent —
 * e.g. in tests and the Astro embed, which have no worker bundle to point at.
 */
export type GenerateOffMainThread = (request: { targetId: string; project: MdyStudioProject; options: unknown }) => Promise<Artifact>;

export interface MountStudioOptions {
  readonly generateOffMainThread?: GenerateOffMainThread;
}

/** Cmd on Apple platforms, Ctrl elsewhere — shown in hints so the label matches the key that works. */
function modifierLabel(): string {
  const platform = typeof navigator === "undefined" ? "" : navigator.platform || "";
  return /Mac|iPhone|iPad/i.test(platform) ? "⌘" : "Ctrl+";
}

/** True when the event's modifier is the platform's primary chord key. */
function hasPrimaryModifier(event: KeyboardEvent): boolean {
  return /Mac|iPhone|iPad/i.test(typeof navigator === "undefined" ? "" : navigator.platform || "")
    ? event.metaKey
    : event.ctrlKey;
}

/** Whether a keystroke is being typed into a control, where single-letter shortcuts must not fire. */
function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element || typeof element.tagName !== "string") return false;
  const tag = element.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || element.isContentEditable === true;
}

/** Persistent shell containers, built once by `ensureShell()` and never replaced wholesale afterwards. */
interface StudioShell {
  readonly canvas: HTMLElement;
  readonly canvasSurface: HTMLElement;
  readonly inspectorBody: HTMLElement;
  readonly head: Region;
  readonly outline: Region;
  readonly dock: Region;
  readonly palette: Region;
  readonly surface: Region;
  readonly tabs: Region;
  readonly inspector: Region;
  readonly footer: Region;
}

export function mountStudio(host: HTMLElement, initial?: MdyStudioProject, options: MountStudioOptions = {}): () => void {
  const canvasController = new StudioCanvasController();
  const plainCanvasSession = new StudioRuntimeSession<MdyPlainForm>();
  const previewSession = new StudioRuntimeSession<{ dispose(): void }>();
  let project = initial ? structuredClone(initial) : createBlankProject();
  let selected = project.schema.id;
  let drag: Drag | null = null;
  let picked: string | null = null;
  let status = "Blank project ready";
  /** CSS selector re-focused after the next render — every action must set this, win or lose. */
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
  /** The live form is the editor; the outline rail is how you navigate and reorder it. */
  const canvasMode = "form" as const;
  /** Whether the floating toolbar is expanded. Collapsed by default so the canvas stays clean. */
  let dockOpen = false;
  /** Export tab state — `generation` guards against a stale async generate() clobbering a newer one
      Stale results are ignored; errors do not mutate `project` or `history`. */
  let exportState: { targetId: string; artifact: Artifact | null; generating: boolean; error: string | null; generation: number } = {
    targetId: targetRegistry.list()[0]?.id ?? "",
    artifact: null,
    generating: false,
    error: null,
    generation: 0,
  };
  /** Preview tab state. `previewReactivity`
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
  /** Built once; from then on `render()` only updates the regions whose markup actually changed. */
  let shell: StudioShell | null = null;
  /** Column widths and the narrow-window slide-overs; built with the shell, torn down with it. */
  let columns: StudioColumns | null = null;
  const scroll = new ScrollMemory();
  /** Indexes for the current `project`, derived once per render — every handler reads this instead of rebuilding. */
  let indexes: StudioIndexes = buildIndexes(project);
  /** Schema snapshot the live form canvas was last mounted from; identical snapshot -> no remount. */
  let plainCanvasSignature: string | null = null;
  /** True only while `ensurePreviewForm()` is wiring the live preview effect, whose first run is synchronous. */
  let buildingPreview = false;
  /** Insert-palette state: the typed query and the highlighted row. */
  let paletteOpen = false;
  let paletteQuery = "";
  let paletteIndex = 0;
  /** Where focus came from when the palette opened, so Escape can put it back. */
  let paletteReturn: string | null = null;
  /** Set by the disposer; read by the document-level key handler and the async session restore. */
  let disposed = false;

  function commit(command: Command, focusTarget: string = selected, focusOverride?: string): void {
    try {
      project = history.apply(project, command);
      status = command.description;
      autosave();
    } catch (error) {
      status = error instanceof CommandRejectedError
        ? error.diagnostics.map((d) => d.message).join(". ")
        : String(error);
    }
    // Restore focus regardless of success/failure — a rejected command must not strand the keyboard user.
    focusSelector = focusOverride ?? `[data-node="${focusTarget}"]`;
    render();
  }

  /** Fire-and-forget IndexedDB auto-save — never blocks the render, never surfaces a write failure as an app error (best-effort, same spirit as localStorage-backed draft persistence). */
  function autosave(): void {
    void saveSession(project).catch(() => {});
  }

  // ─── Actions: one implementation each, driven by both a control and a shortcut ───

  function undo(): void {
    project = history.undo(project);
    status = "Undo";
    autosave();
    // Undo may just have run out (button about to go `disabled`, which refuses focus) —
    // Redo is always enabled right after a successful undo, so it's a safe fallback target.
    focusSelector = history.canUndo() ? "[data-undo]" : "[data-redo]";
    render();
  }

  function redo(): void {
    project = history.redo(project);
    status = "Redo";
    autosave();
    focusSelector = history.canRedo() ? "[data-redo]" : "[data-undo]";
    render();
  }

  /** Where a newly inserted node goes: after the selected field, or inside the selected container. */
  function placementForInsert(): Placement {
    const current = indexes.nodeById.get(selected);
    if (current && current.node !== "field" && current.node !== "array") {
      return { kind: "inside", parentId: current.id, index: current.children.length };
    }
    if (current && current.id !== project.schema.id) return { kind: "after", targetId: current.id };
    const rootChildren = indexes.childrenByParent.get(project.schema.id)?.length ?? 0;
    return { kind: "inside", parentId: project.schema.id, index: rootChildren };
  }

  /**
   * Inserts a template and leaves the caret where the label is edited, ready to be typed over.
   * In the Structure outline there is no inline label editor, so focus lands on the tree node —
   * `commit`'s own default. Either way the keyboard user is never stranded.
   */
  function insertTemplate(templateId: string): void {
    const created = createNodeFromTemplate(templateId);
    // Read where it goes *before* moving the selection onto it. `placementForInsert` answers from
    // whatever is selected, and the new node is not in the index yet — so computing it afterwards
    // found nothing and fell through to the form root, which is where every insert landed however
    // carefully you had chosen a container first.
    const placement = placementForInsert();
    selected = created.id;
    commit(
      createInsertCommand(created, placement),
      created.id,
      canvasMode === "form" ? `[data-inline-edit="label"][data-inline-node="${created.id}"]` : undefined,
    );
  }

  /** Moves a node one slot among its siblings. Shared by Alt+Arrow and the row's move buttons. */
  function reorderSibling(nodeId: string, direction: -1 | 1): void {
    const parent = indexes.parentById.get(nodeId);
    const siblings = parent ? (indexes.childrenByParent.get(parent) ?? []) : [];
    const position = siblings.indexOf(nodeId);
    const target = siblings[position + direction];
    if (position < 0 || !target) return;
    selected = nodeId;
    commit(
      createMoveCommand(nodeId, { kind: direction === -1 ? "before" : "after", targetId: target }),
      nodeId,
      canvasMode === "form" ? `[data-plain-select="${nodeId}"]` : undefined,
    );
  }

  // ─── Layout authoring ─────────────────────────────────────────────────────

  /** Node IDs a layout child places, flattened. */
  function layoutChildNodeIds(child: StudioLayoutChild): string[] {
    if ("nodeId" in child) return [child.nodeId];
    return child.kind === "section"
      ? child.children.flatMap(layoutChildNodeIds)
      : child.columns.flatMap((column) => column.flatMap(layoutChildNodeIds));
  }

  /** The top-level layout node that currently places `nodeId`, if any. */
  function layoutNodeFor(nodeId: string): StudioLayoutNode | undefined {
    return (project.presentation.layout ?? []).find((node) => layoutChildNodeIds(node).includes(nodeId));
  }

  /**
   * Puts a field side by side with its neighbour. If that neighbour is already in a column row,
   * this field joins that row — which is how a third and fourth column get added, without a
   * separate "widen" control. A button rather than only a drag: keyboard-reachable, deterministic
   * about which fields pair up, and the fast path while composing.
   */
  function addToColumnRow(nodeId: string): void {
    const layout = structuredClone(project.presentation.layout ?? []);
    const siblings = indexes.childrenByParent.get(indexes.parentById.get(nodeId) ?? "") ?? [];
    const position = siblings.indexOf(nodeId);
    if (position < 0) return;

    // Pair with a free neighbour first — clicking `city` should pair it with `zip`, not append it
    // to whatever row `lastName` happens to sit in. Only when both neighbours are already
    // arranged does this join an existing row, which is how the third column gets added.
    const placed = new Set(layout.flatMap(layoutChildNodeIds));
    const neighbour =
      nearestFieldSibling(siblings, position, 1, placed, false) ??
      nearestFieldSibling(siblings, position, -1, placed, false) ??
      nearestFieldSibling(siblings, position, -1, placed, true) ??
      nearestFieldSibling(siblings, position, 1, placed, true);
    if (!neighbour) {
      status = "A column row needs a neighbouring field";
      render();
      return;
    }

    const neighbourRow = layout.find(
      (node): node is StudioLayoutNode & { kind: "columns" } =>
        node.kind === "columns" && layoutChildNodeIds(node).includes(neighbour),
    );
    if (neighbourRow) {
      const before = siblings.indexOf(nodeId) < siblings.indexOf(neighbour);
      neighbourRow.columns.splice(before ? 0 : neighbourRow.columns.length, 0, [{ nodeId }]);
      commit(
        createUpdateLayoutCommand(layout, `Add a column (${neighbourRow.columns.length} across)`),
        nodeId,
        columnFocus(nodeId),
      );
      return;
    }

    const ordered = siblings.indexOf(nodeId) < siblings.indexOf(neighbour) ? [nodeId, neighbour] : [neighbour, nodeId];
    layout.push({ kind: "columns", id: createId("lay"), columns: ordered.map((id) => [{ nodeId: id }]) });
    commit(createUpdateLayoutCommand(layout, "Put fields side by side"), nodeId, columnFocus(nodeId));
  }

  /** Nearest field sibling in `direction`, either already arranged by the layout or not. */
  function nearestFieldSibling(
    siblings: readonly string[],
    from: number,
    direction: 1 | -1,
    placed: ReadonlySet<string>,
    wantPlaced: boolean,
  ): string | undefined {
    for (let i = from + direction; i >= 0 && i < siblings.length; i += direction) {
      const candidate = siblings[i]!;
      if (indexes.nodeById.get(candidate)?.node !== "field") continue;
      if (placed.has(candidate) === wantPlaced) return candidate;
    }
    return undefined;
  }

  function columnFocus(nodeId: string): string {
    return `[data-layout-columns="${nodeId}"]`;
  }

  /** Drops every layout slot pointing at a node that no longer exists, and any row left too thin. */
  function pruneLayout(layout: StudioLayoutNode[]): StudioLayoutNode[] {
    const keep = (child: StudioLayoutChild): boolean =>
      "nodeId" in child ? indexes.nodeById.has(child.nodeId) : true;
    return layout
      .map((node) =>
        node.kind === "section"
          ? { ...node, children: node.children.filter(keep) }
          : { ...node, columns: node.columns.map((column) => column.filter(keep)).filter((c) => c.length > 0) },
      )
      .filter((node) => (node.kind === "section" ? node.children.length > 0 : node.columns.length >= 2));
  }

  /** Takes a field out of its row, dropping the row when fewer than two columns remain. */
  function removeFromColumnRow(nodeId: string): void {
    const layout = structuredClone(project.presentation.layout ?? []);
    const next = layout
      .map((node) => {
        if (node.kind !== "columns") return node;
        const columns = node.columns
          .map((column) => column.filter((child) => !("nodeId" in child) || child.nodeId !== nodeId))
          .filter((column) => column.length > 0);
        return { ...node, columns };
      })
      .filter((node) => node.kind !== "columns" || node.columns.length >= 2);
    commit(createUpdateLayoutCommand(next, "Take field out of the row"), nodeId, columnFocus(nodeId));
  }

  /** Flips the `required` validator — the one validator worth a single click. */
  function toggleRequired(nodeId: string): void {
    const node = indexes.nodeById.get(nodeId);
    if (!node || (node.node !== "field" && node.node !== "array")) return;
    const existing = node.validators.find((v) => v.kind === "required");
    const focus = `[data-toggle-required="${nodeId}"]`;
    selected = nodeId;
    if (existing) {
      commit(createRemoveValidatorCommand(nodeId, existing.id), nodeId, focus);
      return;
    }
    const entry = getFieldValidatorRegistryEntry("required");
    commit(createAddValidatorCommand(nodeId, { id: createId("val"), kind: "required", ...entry?.defaultConfig() }), nodeId, focus);
  }

  function drop(placement: Placement, liveCanvas = false): void {
    if (!drag) return;
    if ("template" in drag) {
      if (liveCanvas && (drag.template === "group" || drag.template === "array")) {
        status = "Groups and arrays must be added from the Structure canvas";
        drag = null;
        render();
        return;
      }
      const created = createNodeFromTemplate(drag.template);
      selected = created.id;
      commit(
        createInsertCommand(created, placement),
        created.id,
        liveCanvas ? `[data-plain-select="${created.id}"]` : undefined,
      );
    } else {
      commit(
        createMoveCommand(drag.nodeId, placement),
        drag.nodeId,
        liveCanvas ? `[data-plain-select="${drag.nodeId}"]` : undefined,
      );
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
    const stale = pruneLayout(project.presentation.layout ?? []);
    if (JSON.stringify(stale) !== JSON.stringify(project.presentation.layout ?? [])) {
      commit(createUpdateLayoutCommand(stale, "Clean up layout"));
    }
  }

  async function runExport(): Promise<void> {
    const targetId = exportState.targetId;
    if (!targetId) return;
    const myGeneration = ++exportState.generation;
    exportState = { ...exportState, generating: true, error: null };
    render();
    try {
      const target = await targetRegistry.load(targetId);
      const artifact = options.generateOffMainThread
        ? await options.generateOffMainThread({ targetId, project, options: target.defaults() })
        : await target.generate(project, target.defaults());
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
    previewSession.dispose();
    previewEffect = null;
    const result = buildLiveForm(project, { reactivity: previewReactivity, mockConfigByImplId: previewMockConfig });
    previewForm = result.form as MdyTypedForm<never> | null;
    previewDiagnostics = result.diagnostics;
    previewForProject = project;
    const form = previewForm;
    if (form) {
      // Reading these signals subscribes them — any write (a preview field change, an async
      // validator settling, a submit) re-runs this. It repaints the *preview panel only*:
      // nothing outside the inspector body depends on live form state, and a full render()
      // here would re-enter the render that is building this effect in the first place.
      buildingPreview = true;
      previewEffect = previewReactivity.effect(() => {
        form.value();
        form.state.pending();
        form.state.valid();
        form.state.canSubmit();
        form.state.submitting();
        form.state.lastSubmitErrors();
        // Building the markup *inside* the effect is what subscribes it to every signal the
        // panel actually shows — array lengths and per-field errors included, which the
        // form-level signals above do not cover. Skipping this read on the first (synchronous)
        // run would leave those dependencies untracked forever.
        const html = previewPanelMarkup();
        if (!buildingPreview) paintPreviewPanel(html);
      });
      buildingPreview = false;
      previewSession.replace({ dispose: () => previewEffect?.destroy() });
    }
  }

  /** Repaints just the preview panel, keeping the inspector's scroll and the field the user is typing in. */
  function paintPreviewPanel(html: string): void {
    if (!shell || inspectorTab !== "preview") return;
    const activePath = (document.activeElement as HTMLElement | null)?.dataset?.previewField ?? null;
    scroll.capture();
    shell.inspector.update(html);
    scroll.restore();
    if (activePath) shell.inspectorBody.querySelector<HTMLElement>(`[data-preview-field="${activePath}"]`)?.focus();
  }

  function getSelectedField(): FieldNode | null {
    const node = indexes.nodeById.get(selected);
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

  /** One-click fix for a diagnostic — dispatches an existing command, never a bespoke mutation. */
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
    if (d.code === "LAYOUT_UNKNOWN_NODE" || d.code === "LAYOUT_DUPLICATE_NODE") {
      return `<button data-fix-prune-layout>Clean up layout</button>`;
    }
    if (d.code === "BROKEN_REFERENCE" && d.nodeId) {
      return `<button data-fix-drop-reference="${d.nodeId}">Remove reference</button>`;
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

  /** The panel body alone — reading it tracks the live form signals it displays. */
  function previewPanelMarkup(): string {
    return previewBodyMarkup(project, previewForm, previewMockConfig) + diagnosticsMarkup(previewDiagnostics);
  }

  function previewMarkup(): string {
    ensurePreviewForm();
    return previewPanelMarkup();
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

  function instrumentPlainCanvas(
    plainHost: HTMLElement,
    fields: ReadonlyArray<{ readonly name: string }>,
    idx: StudioIndexes,
  ): void {
    const nodeIdByPath = new Map(Array.from(idx.pathByNode, ([nodeId, path]) => [path, nodeId]));
    // Resolved by name, not by child index: a layout row nests field roots inside itself, so
    // "nth child of the host" stops being "nth field" as soon as any layout exists.
    const rootByName = new Map<string, HTMLElement>();
    plainHost.querySelectorAll<HTMLElement>("[data-mdy-field]").forEach((element) => {
      const name = element.dataset.mdyField;
      if (name) rootByName.set(name, element);
    });
    const fieldRoots = fields.map((field) => rootByName.get(field.name));

    const dropPoint = (placement: "before" | "after", nodeId: string): HTMLDivElement => {
      const zone = document.createElement("div");
      zone.className = "drop-zone plain-canvas-drop";
      zone.dataset[placement] = nodeId;
      zone.setAttribute("aria-hidden", "true");
      zone.textContent = placement === "before" ? "Drop before" : "Drop after";
      return zone;
    };

    const insertionPoint = (placement: "before" | "after", nodeId: string): HTMLSelectElement => {
      const select = document.createElement("select");
      select.className = "plain-canvas-insert";
      select.dataset.plainInsert = placement;
      select.dataset.plainInsertTarget = nodeId;
      select.setAttribute("aria-label", `Choose a field type to insert ${placement} this field`);

      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "+ Add field";
      select.append(placeholder);

      for (const template of TEMPLATE_CATALOG) {
        if (template.group === "Structure") continue;
        const option = document.createElement("option");
        option.value = template.id;
        option.textContent = template.label;
        select.append(option);
      }
      return select;
    };

    /** Where a child node renders, by the id of the group *or array* that contains it. */
    const containerBodies = new Map<string, HTMLElement>();
    /** The element standing for a container node, once built. */
    const containerElements = new Map<string, HTMLElement>();

    /**
     * The element that represents a node on the canvas, whether it is a field, a group or an array.
     *
     * A field's element is the renderer root Plain mounted for its path; a container's is the
     * fieldset or section built here. Having one answer for all three is what lets a container be
     * placed relative to its siblings without caring what kind of sibling it lands next to.
     */
    const elementForNode = (nodeId: string): HTMLElement | undefined => {
      const container = containerElements.get(nodeId);
      if (container) return container;
      const path = idx.pathByNode.get(nodeId);
      return path ? rootByName.get(path) : undefined;
    };

    /**
     * Puts a container where the model says it belongs: inside its parent, among its siblings.
     *
     * Both containers used to be appended to the host — an array unconditionally, a group whenever
     * it had no rendered descendant to sit before. So a repeater declared between two fields drew
     * itself after both of them, and one nested in a group drew itself outside it. Neither is a
     * styling problem: the arrangement on screen simply was not the arrangement in the project.
     */
    const placeContainer = (nodeId: string, element: HTMLElement): void => {
      const parentId = idx.parentById.get(nodeId);
      const container = (parentId ? containerBodies.get(parentId) : undefined) ?? plainHost;
      const siblings = idx.childrenByParent.get(parentId ?? "") ?? [];
      const position = siblings.indexOf(nodeId);
      // The first sibling after this one that is already on the canvas. Anything before it has
      // either been placed already or will place itself relative to something else.
      for (const later of siblings.slice(position + 1)) {
        const anchor = elementForNode(later);
        if (anchor && anchor.parentElement === container) {
          container.insertBefore(element, anchor);
          return;
        }
      }
      container.append(element);
    };

    const arrays = Array.from(idx.nodeById.values())
      .filter((node): node is ArrayNode => node.node === "array")
      .sort((a, b) => (idx.pathByNode.get(a.id)?.split(".").length ?? 0) - (idx.pathByNode.get(b.id)?.split(".").length ?? 0));

    for (const array of arrays) {
      const arrayPath = idx.pathByNode.get(array.id);
      if (!arrayPath) continue;

      const section = document.createElement("section");
      section.className = "plain-canvas-array";
      section.dataset.plainArray = array.id;
      section.dataset.arrayPath = arrayPath;
      section.dataset.node = array.id;
      section.draggable = true;
      section.classList.toggle("selected", array.id === selected);
      section.setAttribute("aria-label", `${array.name}, array field`);

      const header = document.createElement("header");
      header.className = "plain-canvas-array-header plain-canvas-head";
      const select = kindChip("array", array.id, `Select array ${array.name} in Studio`);
      const count = document.createElement("span");
      count.className = "plain-canvas-array-count";
      count.textContent = `${array.initialRows.length} row${array.initialRows.length === 1 ? "" : "s"}`;
      const actions = document.createElement("span");
      actions.className = "plain-canvas-array-actions plain-canvas-actions";
      const addRow = iconButton("+", `Add initial row to ${array.name}`);
      addRow.dataset.plainArrayAdd = array.id;
      const removeRow = iconButton("\u2212", `Remove last initial row from ${array.name}`);
      removeRow.dataset.plainArrayRemove = array.id;
      removeRow.disabled = array.initialRows.length === 0;
      const siblings = idx.childrenByParent.get(idx.parentById.get(array.id) ?? "") ?? [];
      const position = siblings.indexOf(array.id);
      const move = (label: string, icon: string, kind: "before" | "after", targetId?: string): HTMLButtonElement => {
        const button = iconButton(icon, `${label} array ${array.name}`);
        button.dataset.plainArrayMove = kind;
        button.dataset.plainArrayNode = array.id;
        button.dataset.plainArrayTarget = targetId ?? "";
        button.disabled = !targetId;
        return button;
      };
      actions.append(
        addRow,
        removeRow,
        move("Move up", "\u2191", "before", position > 0 ? siblings[position - 1] : undefined),
        move("Move down", "\u2193", "after", position >= 0 && position < siblings.length - 1 ? siblings[position + 1] : undefined),
      );
      if (idx.parentById.get(array.id) !== project.schema.id) {
        const root = iconButton("\u2912", `Move array ${array.name} to form root`);
        root.dataset.plainArrayRoot = array.id;
        actions.append(root);
      }
      const into = document.createElement("select");
      into.dataset.plainArrayInto = array.id;
      into.setAttribute("aria-label", `Move array ${array.name} into group`);
      into.append(new Option("⊞", ""));
      for (const group of Array.from(idx.nodeById.values()).filter((node): node is GroupNode => node.node === "group" && node.id !== project.schema.id)) {
        if (group.id === idx.parentById.get(array.id)) continue;
        into.append(new Option(group.label || group.name, group.id));
      }
      actions.append(into);
      const arrayDuplicate = iconButton("\u29c9", `Duplicate array ${array.name}`);
      arrayDuplicate.dataset.duplicate = array.id;
      const arrayDelete = iconButton("\u00d7", `Delete array ${array.name}`);
      arrayDelete.dataset.delete = array.id;
      actions.append(arrayDuplicate, arrayDelete);
      header.append(
        dragGrip(array.id),
        inlineEditor("label", array.id, array.label ?? "", "Untitled array", `Label for array ${array.name}`),
        inlineEditor("name", array.id, array.name, "name", `Code name for array ${array.name}`),
        select,
        count,
        actions,
      );

      const body = document.createElement("div");
      body.className = "plain-canvas-array-body";
      if (array.initialRows.length === 0) {
        const empty = document.createElement("p");
        empty.className = "plain-canvas-array-empty";
        empty.textContent = "No initial rows";
        body.append(empty);
      } else {
        array.initialRows.forEach((_row, index) => {
          const row = document.createElement("div");
          row.className = "plain-canvas-array-row";
          row.dataset.plainArrayRow = String(index);
          const label = document.createElement("span");
          label.textContent = `Initial row ${index + 1}`;
          const rowActions = document.createElement("span");
          rowActions.className = "plain-canvas-array-row-actions";
          const rowButton = (labelText: string, action: "up" | "down" | "remove", disabled = false): HTMLButtonElement => {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.plainArrayRowAction = action;
            button.dataset.plainArrayNode = array.id;
            button.dataset.plainArrayRowIndex = String(index);
            button.disabled = disabled;
            button.setAttribute("aria-label", `${labelText} initial row ${index + 1} in ${array.name}`);
            button.textContent = labelText;
            return button;
          };
          rowActions.append(
            rowButton("Move up", "up", index === 0),
            rowButton("Move down", "down", index === array.initialRows.length - 1),
            rowButton("Remove", "remove"),
          );
          row.append(label, rowActions);
          body.append(row);
        });
      }
      const itemSchema = document.createElement("button");
      itemSchema.type = "button";
      itemSchema.className = "plain-canvas-array-item";
      itemSchema.dataset.plainSelect = array.item.id;
      itemSchema.setAttribute("aria-label", `Edit item schema for ${array.name}`);
      itemSchema.textContent = `Item schema: ${array.item.node === "group" ? "group" : array.item.fieldKind}`;
      const rowShape = document.createElement("select");
      rowShape.className = "plain-canvas-array-shape";
      rowShape.dataset.plainArrayShape = array.id;
      rowShape.setAttribute("aria-label", `Row shape for ${array.name}`);
      const currentShape = array.item.node === "group" ? "group" : array.item.fieldKind;
      rowShape.append(new Option("Group of fields", "group", false, currentShape === "group"));
      for (const template of TEMPLATE_CATALOG) {
        if (template.group === "Structure") continue;
        rowShape.append(new Option(`Single ${template.label.toLowerCase()}`, template.id, false, currentShape === template.id));
      }
      // Where the item schema's own group renders. An array whose row is a group had that group
      // land at the form root, because only groups were registered as containers — so the one part
      // of the schema that says what a row *is* appeared to be a sibling of the array rather than
      // its shape. Registering the array here puts it where the hierarchy actually is.
      const itemBody = document.createElement("div");
      itemBody.className = "plain-canvas-array-item-body";
      section.append(header, itemSchema, rowShape, itemBody, body);
      containerBodies.set(array.id, itemBody);
      containerElements.set(array.id, section);
    }

    const groups = Array.from(idx.nodeById.values())
      .filter((node): node is GroupNode => node.node === "group" && node.id !== project.schema.id)
      .sort((a, b) => (idx.pathByNode.get(a.id)?.split(".").length ?? 0) - (idx.pathByNode.get(b.id)?.split(".").length ?? 0));

    for (const group of groups) {
      const groupPath = idx.pathByNode.get(group.id);
      if (!groupPath) continue;
      const descendants = fields.flatMap((field, index) =>
        field.name.startsWith(`${groupPath}.`) && fieldRoots[index]
          ? [fieldRoots[index]!]
          : [],
      );

      const fieldset = document.createElement("fieldset");
      fieldset.className = "plain-canvas-group";
      fieldset.dataset.plainGroup = group.id;
      fieldset.dataset.groupPath = groupPath;
      fieldset.dataset.node = group.id;
      fieldset.draggable = true;
      fieldset.setAttribute("aria-label", `${group.name}, draggable group`);
      fieldset.classList.toggle("selected", group.id === selected);

      const legend = document.createElement("legend");
      legend.className = "plain-canvas-head";
      const select = kindChip("group", group.id, `Select group ${group.name} in Studio`);

      const controls = document.createElement("span");
      controls.className = "plain-canvas-group-actions plain-canvas-actions";
      const siblings = idx.childrenByParent.get(idx.parentById.get(group.id) ?? "") ?? [];
      const position = siblings.indexOf(group.id);
      const moveButton = (label: string, icon: string, kind: "before" | "after", targetId?: string): HTMLButtonElement => {
        const button = iconButton(icon, `${label} ${group.name}`);
        button.dataset.plainGroupMove = kind;
        button.dataset.plainGroupNode = group.id;
        button.dataset.plainGroupTarget = targetId ?? "";
        button.disabled = !targetId;
        return button;
      };
      // A row shape is not a sibling of anything: it *is* the array's item. The model refuses to
      // move, duplicate or delete it — "Node is not movable", "Replace the array item or delete its
      // array" — so offering those four controls only ever produced an error in the footer. What is
      // valid instead is replacing the shape, which is the one thing nothing offered.
      const isRowShape = idx.nodeById.get(idx.parentById.get(group.id) ?? "")?.node === "array";
      if (!isRowShape) {
        controls.append(
          moveButton("Move up", "\u2191", "before", position > 0 ? siblings[position - 1] : undefined),
          moveButton("Move down", "\u2193", "after", position >= 0 && position < siblings.length - 1 ? siblings[position + 1] : undefined),
        );
        if (idx.parentById.get(group.id) !== project.schema.id) {
          const root = iconButton("\u2912", `Move ${group.name} to form root`);
          root.dataset.plainGroupRoot = group.id;
          controls.append(root);
        }
        const into = document.createElement("select");
        into.dataset.plainGroupInto = group.id;
        into.setAttribute("aria-label", `Move ${group.name} into group`);
        into.append(new Option("⊞", ""));
        for (const target of groups) {
          const targetPath = idx.pathByNode.get(target.id) ?? "";
          if (target.id === group.id || targetPath.startsWith(`${groupPath}.`)) continue;
          into.append(new Option(target.label || target.name, target.id));
        }
        controls.append(into);
        const groupDuplicate = iconButton("\u29c9", `Duplicate ${group.name}`);
        groupDuplicate.dataset.duplicate = group.id;
        const groupDelete = iconButton("\u00d7", `Delete ${group.name}`);
        groupDelete.dataset.delete = group.id;
        controls.append(groupDuplicate, groupDelete);
      }
      legend.append(
        dragGrip(group.id),
        inlineEditor("label", group.id, group.label ?? "", "Untitled group", `Label for group ${group.name}`),
        inlineEditor("name", group.id, group.name, "name", `Code name for group ${group.name}`),
        select,
        controls,
      );

      const body = document.createElement("div");
      body.className = "plain-canvas-group-body";

      const first = descendants[0];
      const parentId = idx.parentById.get(group.id);
      const parentIsArray = parentId ? idx.nodeById.get(parentId)?.node === "array" : false;
      if (first && !parentIsArray) {
        // A group wraps fields that Plain has already mounted in contract order, so sitting just
        // before the first of them puts the group exactly where those fields are.
        first.before(fieldset);
      } else {
        // Nothing of its own on the canvas yet — an empty group, or a row shape whose fields are
        // `rows.0.street`, `rows.1.street`… and belong to the rows rather than to the shape.
        placeContainer(group.id, fieldset);
      }
      containerElements.set(group.id, fieldset);

      fieldset.before(dropPoint("before", group.id));
      fieldset.after(dropPoint("after", group.id));

      for (const element of descendants) body.append(element);

      const inside = document.createElement("div");
      inside.className = "drop-zone plain-canvas-drop plain-canvas-drop-inside";
      inside.dataset.inside = group.id;
      inside.dataset.index = String(group.children.length);
      inside.setAttribute("aria-hidden", "true");
      inside.textContent = group.children.length ? "Drop into group" : "Drop first field into group";
      body.append(inside);
      fieldset.append(legend, body);
      containerBodies.set(group.id, body);
    }

    // Arrays are placed last because a group may be an array's row shape *and* an array may sit
    // inside a group: only once every container has a body can each one be put where it belongs.
    // Deepest first, so an array nested in a group finds that group's body already in the document.
    for (const array of [...arrays].reverse()) {
      const section = containerElements.get(array.id);
      if (section) placeContainer(array.id, section);
    }

    const rootDrop = document.createElement("div");
    rootDrop.className = "drop-zone plain-canvas-drop plain-canvas-drop-root";
    rootDrop.dataset.inside = project.schema.id;
    rootDrop.dataset.index = String(idx.childrenByParent.get(project.schema.id)?.length ?? 0);
    rootDrop.setAttribute("aria-hidden", "true");
    rootDrop.textContent = "Drop at form root";
    plainHost.append(rootDrop);

    fields.forEach((field, index) => {
      const root = fieldRoots[index];
      const nodeId = nodeIdByPath.get(field.name);
      if (!root || !nodeId) return;
      root.dataset.node = nodeId;
      root.dataset.fieldPath = field.name;
      root.draggable = true;
      root.setAttribute("aria-label", `${field.name}, draggable field`);
      root.classList.add("plain-canvas-field");
      root.classList.toggle("selected", nodeId === selected);
      root.classList.toggle("has-diagnostic", diagnosticNodeIds.has(nodeId));

      const node = idx.nodeById.get(nodeId);
      const selectButton = kindChip(
        node?.node === "field" ? node.fieldKind : "field",
        nodeId,
        `Select ${field.name} in Studio`,
      );

      const actions = document.createElement("div");
      actions.className = "plain-canvas-actions";

      const duplicateButton = iconButton("\u29c9", `Duplicate ${field.name}`);
      duplicateButton.dataset.duplicate = nodeId;

      const moveUpButton = iconButton("\u2191", `Move ${field.name} up`);
      moveUpButton.dataset.plainMove = "before";
      moveUpButton.dataset.plainMoveNode = nodeId;
      moveUpButton.dataset.plainMoveTarget = index > 0 ? nodeIdByPath.get(fields[index - 1]!.name) ?? "" : "";
      moveUpButton.disabled = index === 0;

      const moveDownButton = iconButton("\u2193", `Move ${field.name} down`);
      moveDownButton.dataset.plainMove = "after";
      moveDownButton.dataset.plainMoveNode = nodeId;
      moveDownButton.dataset.plainMoveTarget = index < fields.length - 1 ? nodeIdByPath.get(fields[index + 1]!.name) ?? "" : "";
      moveDownButton.disabled = index === fields.length - 1;

      const inRow = layoutNodeFor(nodeId)?.kind === "columns";
      // Groups own their children's DOM position (studio-ui re-nests them into a fieldset) and
      // layout owns the position of what it places. Offering both for one field would put two
      // owners on the same node, so column rows are for root-level fields in this batch.
      const canColumn = idx.parentById.get(nodeId) === project.schema.id;
      const columnsButton = iconButton(
        "\u25a5",
        inRow ? `Take ${field.name} out of its column row` : `Put ${field.name} side by side with its neighbour`,
      );
      columnsButton.dataset.layoutColumns = nodeId;
      columnsButton.dataset.layoutInRow = String(inRow);
      columnsButton.setAttribute("aria-pressed", String(inRow));
      columnsButton.disabled = !canColumn && !inRow;
      if (!canColumn && !inRow) columnsButton.title = "Column rows apply to fields at the form root";

      const deleteButton = iconButton("\u00d7", `Delete ${field.name}`);
      deleteButton.dataset.delete = nodeId;

      const fieldParentId = idx.parentById.get(nodeId);
      if (fieldParentId !== project.schema.id) {
        const moveToRootButton = iconButton("\u2912", `Move ${field.name} to form root`);
        moveToRootButton.dataset.plainFieldRoot = nodeId;
        actions.append(moveToRootButton);
      }

      const moveIntoGroup = document.createElement("select");
      moveIntoGroup.dataset.plainFieldInto = nodeId;
      moveIntoGroup.setAttribute("aria-label", `Move ${field.name} into group`);
      moveIntoGroup.append(new Option("⊞", ""));
      for (const group of groups) {
        if (group.id === fieldParentId) continue;
        moveIntoGroup.append(new Option(group.label || group.name, group.id));
      }

      actions.append(moveUpButton, moveDownButton, columnsButton, moveIntoGroup, duplicateButton, deleteButton);

      // The label and the code name are edited on the field itself: the visible label the form
      // renders *is* the thing being edited, so there is no "where did that come from" gap.
      const required =
        node?.node === "field" || node?.node === "array" ? node.validators.some((v) => v.kind === "required") : false;
      const requiredToggle = document.createElement("button");
      requiredToggle.type = "button";
      requiredToggle.className = "plain-canvas-required";
      requiredToggle.dataset.toggleRequired = nodeId;
      requiredToggle.setAttribute("aria-pressed", String(required));
      requiredToggle.setAttribute("aria-label", `${required ? "Make optional" : "Make required"}: ${field.name}`);
      requiredToggle.title = required ? "Required — click to make optional" : "Optional — click to make required";
      requiredToggle.textContent = "✱";

      const head = document.createElement("div");
      head.className = "plain-canvas-head";
      head.append(
        dragGrip(nodeId),
        inlineEditor("label", nodeId, node?.label ?? "", "Untitled field", `Label for ${field.name}`),
        requiredToggle,
        inlineEditor("name", nodeId, node?.name ?? field.name, "name", `Code name for ${field.name}`),
        selectButton,
        actions,
      );
      root.prepend(head);
      root.before(dropPoint("before", nodeId), insertionPoint("before", nodeId));
      if (index === fields.length - 1) {
        root.after(insertionPoint("after", nodeId), dropPoint("after", nodeId));
      }
    });
  }

  /**
   * One compact icon control. The accessible name lives in `aria-label`, so the glyph carries no
   * meaning a screen reader has to guess at — fields, groups and arrays all use this, which is
   * what keeps their rows looking like one system instead of three.
   */
  function iconButton(icon: string, ariaLabel: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", ariaLabel);
    button.title = ariaLabel;
    button.textContent = icon;
    return button;
  }

  /** The kind pill that doubles as "select this node in Studio". Same shape for every node type. */
  function kindChip(kind: string, nodeId: string, ariaLabel: string): HTMLButtonElement {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "plain-canvas-select";
    chip.dataset.plainSelect = nodeId;
    chip.setAttribute("aria-pressed", String(nodeId === selected));
    chip.setAttribute("aria-label", ariaLabel);
    chip.textContent = kind;
    return chip;
  }

  /**
   * Explicit drag handle. Needed wherever the header is mostly text inputs: a mousedown on an
   * input selects text instead of starting a drag, so the container's own `draggable` is not
   * reachable there. Mouse-only by design — keyboard users move nodes with the arrow controls.
   */
  function dragGrip(nodeId: string): HTMLSpanElement {
    const grip = document.createElement("span");
    grip.className = "plain-canvas-grip";
    grip.draggable = true;
    grip.dataset.dragNode = nodeId;
    grip.setAttribute("aria-hidden", "true");
    grip.title = "Drag to move";
    grip.textContent = "⠿";
    return grip;
  }

  /**
   * One in-place text editor for a node's label or code name. Commits on `change` (blur/Enter),
   * never on every keystroke, so the region rewrite that follows can never eat the caret.
   */
  function inlineEditor(
    kind: "label" | "name",
    nodeId: string,
    value: string,
    placeholder: string,
    ariaLabel: string,
  ): HTMLInputElement {
    const input = document.createElement("input");
    input.className = `plain-canvas-inline plain-canvas-inline-${kind}`;
    input.dataset.inlineEdit = kind;
    input.dataset.inlineNode = nodeId;
    input.value = value;
    input.placeholder = placeholder;
    input.spellcheck = false;
    input.setAttribute("aria-label", ariaLabel);
    return input;
  }

  /** The form's own title bar: the name is edited where it is read, not in a side panel. */
  function headMarkup(idx: StudioIndexes): string {
    const fieldCount = [...idx.nodeById.values()].filter((n) => n.node === "field").length;
    return `
      <span class="brand" aria-hidden="true">
        <svg class="brand-mark" viewBox="0 0 384 384" role="img">
          <defs>
            <linearGradient id="studio-brand-top" x1="0" y1="222" x2="338" y2="118" gradientUnits="userSpaceOnUse"><stop stop-color="#6B61F2"/><stop offset=".45" stop-color="#A855F7"/><stop offset="1" stop-color="#DC66A8"/></linearGradient>
            <linearGradient id="studio-brand-left" x1="0" y1="150" x2="60" y2="380" gradientUnits="userSpaceOnUse"><stop stop-color="#7067FF"/><stop offset="1" stop-color="#A855F7"/></linearGradient>
            <linearGradient id="studio-brand-right" x1="338" y1="170" x2="250" y2="380" gradientUnits="userSpaceOnUse"><stop stop-color="#FF7A85"/><stop offset="1" stop-color="#FF556F"/></linearGradient>
          </defs>
          <g transform="translate(22)">
            <path d="M0 148Q0 118 24.87 101.22L147.45 18.54Q169 4 190.55 18.54L313.13 101.22Q338 118 338 148V198Q338 222 317.67 209.25L194.41 131.94Q169 116 143.59 131.94L20.33 209.25Q0 222 0 198Z" fill="url(#studio-brand-top)"/>
            <path d="M0 214Q0 160 45.61 188.91L104.84 226.45Q142 250 142 294V314Q142 368 96.39 339.09L37.16 301.55Q0 278 0 234Z" fill="url(#studio-brand-left)"/>
            <path d="M338 214Q338 160 292.39 188.91L233.16 226.45Q196 250 196 294V314Q196 368 241.61 339.09L300.84 301.55Q338 278 338 234Z" fill="url(#studio-brand-right)"/>
          </g>
        </svg>
        <span>Modyra</span>
      </span>
      <input class="form-name" data-form-name value="${escapeHtml(project.name)}" aria-label="Form name" spellcheck="false">
      <span class="form-meta">${fieldCount} field${fieldCount === 1 ? "" : "s"}</span>`;
  }

  /**
   * Everything that is not composing the form itself lives behind one floating button: adding
   * fields, history, project I/O and the structure outline. Collapsed, the canvas is just the form.
   */
  /** Rows only — rewritten on every keystroke, so it must not contain the input the user is typing in. */
  function paletteListMarkup(): string {
    const matches = filterTemplates(paletteQuery);
    if (!matches.length) {
      return `<li class="palette-empty" role="option" aria-disabled="true" aria-selected="false">No field type matches “${escapeHtml(paletteQuery)}”</li>`;
    }
    return matches
      .map(
        (template, index) => `
        <li role="option"
            id="mdy-palette-option-${index}"
            class="palette-option${index === paletteIndex ? " active" : ""}"
            aria-selected="${index === paletteIndex}"
            data-palette-option="${escapeHtml(template.id)}"
            data-palette-index="${index}">
          <span class="palette-option-label">${escapeHtml(template.label)}</span>
          <small class="palette-option-group">${escapeHtml(template.group)}</small>
        </li>`,
      )
      .join("");
  }

  /**
   * Type-to-insert, the affordance that makes composing fast. A combobox with
   * aria-activedescendant: focus stays in the input while the arrows move the
   * highlight, which is what screen readers expect from this pattern.
   */
  function paletteMarkup(): string {
    if (!paletteOpen) return "";
    const matches = filterTemplates(paletteQuery);
    const active = matches.length ? `aria-activedescendant="mdy-palette-option-${paletteIndex}"` : "";
    return `
      <div class="palette-backdrop" data-palette-backdrop></div>
      <div class="palette-dialog" role="dialog" aria-modal="true" aria-label="Add a field">
        <input class="palette-input"
               data-palette-input
               type="text"
               role="combobox"
               aria-expanded="true"
               aria-controls="mdy-palette-list"
               aria-autocomplete="list"
               ${active}
               placeholder="Add a field — type to search"
               spellcheck="false"
               autocomplete="off"
               value="${escapeHtml(paletteQuery)}">
        <ul class="palette-list" id="mdy-palette-list" role="listbox" aria-label="Field types" data-palette-list>${paletteListMarkup()}</ul>
        <p class="palette-hint">↑↓ to choose · Enter to add · Esc to close</p>
      </div>`;
  }

  function dockMarkup(): string {
    const groups: Array<FieldTemplate["group"]> = ["Fields", "Choice", "Structure"];
    return `
      <div class="dock-panel" data-dock-panel ${dockOpen ? "" : "hidden"}>
        <section class="dock-section">
          <h3>Add field <kbd>${modifierLabel()}K</kbd></h3>
          ${groups
            .map(
              (group) => `
            <div class="dock-group-label">${escapeHtml(group)}</div>
            <div class="dock-templates">
              ${TEMPLATE_CATALOG.filter((t) => t.group === group)
                .map((t) => `<button type="button" draggable="true" data-template="${t.id}">${escapeHtml(t.label)}</button>`)
                .join("")}
            </div>`,
            )
            .join("")}
        </section>
        <section class="dock-section">
          <h3>Form</h3>
          <div class="dock-actions">
            <button type="button" data-undo ${history.canUndo() ? "" : "disabled"}>Undo</button>
            <button type="button" data-redo ${history.canRedo() ? "" : "disabled"}>Redo</button>
            <button type="button" data-new>New blank</button>
            <label data-import-button class="import-button">
              Import
              <input type="file" accept="application/json" data-import hidden>
            </label>
          </div>
        </section>

      </div>
      <button type="button" class="fab" data-dock-toggle aria-expanded="${dockOpen}" aria-label="${dockOpen ? "Close the Studio toolbar" : "Open the Studio toolbar"}">
        <span aria-hidden="true">${dockOpen ? "×" : "＋"}</span>
      </button>`;
  }

  /**
   * The live-form frame is deliberately markup-stable: it only changes when the Contract flips
   * between available and blocked. As long as it is unchanged the Region skips the rewrite, so
   * the `[data-plain-canvas]` mount underneath survives untouched across renders.
   */
  function liveFrameMarkup(hasContract: boolean, diagnostics: StudioDiagnostic[] = []): string {
    if (hasContract) {
      return `<div class="plain-canvas-frame"><div class="plain-canvas-form" data-plain-canvas></div></div>`;
    }
    // Naming the blockers here, with a jump to each one, beats sending the user to hunt through
    // a tab for what a bare "unavailable" refused to tell them.
    const blocking = diagnostics.filter((d) => d.severity === "error");
    const rows = blocking
      .map(
        (d) => `<li class="diagnostic-row severity-error">
            <span class="diag-message">${escapeHtml(d.message)}</span>
            <span class="diag-actions">${d.nodeId ? `<button data-goto-node="${escapeHtml(d.nodeId)}">Go to</button>` : ""}${quickFixMarkup(d)}</span>
          </li>`,
      )
      .join("");
    return `
      <div class="plain-canvas-frame">
        <div class="plain-canvas-unavailable" role="status">
          <p><strong>The live form can't be built yet.</strong> ${blocking.length} problem${blocking.length === 1 ? "" : "s"} block${blocking.length === 1 ? "s" : ""} the Contract:</p>
          <ul class="diagnostic-list">${rows}</ul>
        </div>
      </div>`;
  }

  /**
   * The outline rail: the same tree renderer, in a persistent column instead of a canvas mode.
   * It is the surface the keyboard-parity gate covers (Space to pick up, arrows to move), and
   * it fills the gutter that was previously dead space beside the form card.
   */
  function outlineMarkup(rootChildren: readonly StudioSchemaNode[]): string {
    const body = rootChildren.length
      ? `<ul class="tree" aria-label="Form structure">${rootChildren.map(markup).join("")}</ul>`
      : `<div class="empty">
           <p>No fields yet.</p>
           <div class="drop-zone inside" data-inside="${project.schema.id}" data-index="0">Drop first element</div>
         </div>`;
    // The form itself is selectable. Inserting puts a node inside the selected container, so
    // without a way back to the root you could pick a group once and never add a sibling to it
    // again — every later insert would keep burrowing into whatever was selected last.
    return `<h2 class="outline-title">Outline</h2>
      <button type="button" class="outline-root${selected === project.schema.id ? " selected" : ""}"
              data-select="${project.schema.id}" aria-pressed="${selected === project.schema.id}">
        Form root
      </button>${body}`;
  }

  function tabsMarkup(current: StudioSchemaNode, diagnosticCount: number, errorCount: number): string {
    return `
      <button type="button" role="tab" data-inspector-tab="node" aria-selected="${inspectorTab === "node"}">
        ${current.node === "field" ? "Field" : current.node === "group" ? "Group" : "Array"}
      </button>
      <button type="button" role="tab" data-inspector-tab="form" aria-selected="${inspectorTab === "form"}">
        Form rules${project.formValidators.length ? ` <span class="badge">${project.formValidators.length}</span>` : ""}
      </button>
      <button type="button" role="tab" data-inspector-tab="diagnostics" aria-selected="${inspectorTab === "diagnostics"}">
        Diagnostics${diagnosticCount ? ` <span class="badge ${errorCount ? "badge-error" : ""}">${diagnosticCount}</span>` : ""}
      </button>
      <button type="button" role="tab" data-inspector-tab="export" aria-selected="${inspectorTab === "export"}">
        Export
      </button>
      <button type="button" role="tab" data-inspector-tab="preview" aria-selected="${inspectorTab === "preview"}">
        Preview
      </button>`;
  }

  function nodeInspectorMarkup(current: StudioSchemaNode, idx: StudioIndexes): string {
    return `
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
      ${
        current.node === "field"
          ? `<label class="dep-row"><input type="checkbox" data-exclude-draft ${
              (project.behaviors.draft?.exclude ?? []).some((ref) => ref.nodeId === current.id) ? "checked" : ""
            }> Exclude from saved draft</label>`
          : ""
      }
      ${accordionMarkup(
        "details",
        "Details",
        "",
        expandedSections.has("details"),
        `<dl><dt>Path</dt><dd>${escapeHtml(idx.pathByNode.get(current.id) || "root")}</dd><dt>Stable ID</dt><dd>${escapeHtml(current.id)}</dd></dl>`,
      )}`;
  }

  function inspectorBodyMarkup(current: StudioSchemaNode, idx: StudioIndexes, diagnostics: StudioDiagnostic[]): string {
    if (inspectorTab === "diagnostics") return diagnosticsMarkup(diagnostics);
    if (inspectorTab === "export") return exportMarkup();
    if (inspectorTab === "preview") return previewMarkup();
    if (inspectorTab === "form") return formValidatorsMarkup(project, idx, formValidatorDraft);
    return nodeInspectorMarkup(current, idx);
  }

  function footerMarkup(): string {
    return `${escapeHtml(status)}${picked ? ". Arrows reorder or enter and leave containers. Enter drops. Escape cancels." : ""}`;
  }

  /**
   * Builds the shell exactly once. Everything below it is owned by a {@link Region}, so a state
   * change only rewrites the regions whose markup differs — the rest keeps its nodes, listeners,
   * scroll offset and focus.
   */
  function ensureShell(): StudioShell {
    if (shell) return shell;
    host.innerHTML = `
      <div class="studio">
        <header></header>
        <main>
          <aside class="outline" aria-label="Form outline"></aside>
          <div class="studio-resizer" data-resize="outline" aria-label="Resize the outline, or show it when the window is narrow"></div>
          <div class="canvas-column">
            <section class="canvas" tabindex="-1">
              <div class="canvas-surface"></div>
            </section>
            <div class="dock"></div>
            <div class="palette-layer"></div>
          </div>
          <div class="studio-resizer" data-resize="inspector" aria-label="Resize the properties panel, or show it when the window is narrow"></div>
          <aside class="inspector">
            <div class="inspector-tabs" role="tablist"></div>
            <div class="inspector-body"></div>
          </aside>
        </main>
        <footer role="status" aria-live="polite"></footer>
      </div>`;

    const find = <T extends HTMLElement>(selector: string): T => host.querySelector<T>(selector)!;
    const canvas = find<HTMLElement>(".canvas");
    const canvasSurface = find<HTMLElement>(".canvas-surface");
    const inspectorBody = find<HTMLElement>(".inspector-body");

    shell = {
      canvas,
      canvasSurface,
      inspectorBody,
      head: new Region(find<HTMLElement>("header"), bindHead),
      outline: new Region(find<HTMLElement>(".outline"), bindOutline),
      dock: new Region(find<HTMLElement>(".dock"), bindDock),
      palette: new Region(find<HTMLElement>(".palette-layer"), bindPalette),
      // Bound explicitly by render(): in live-form mode the listeners belong to DOM that
      // instrumentPlainCanvas() adds *after* the region write, so the Region cannot own it.
      surface: new Region(canvasSurface),
      tabs: new Region(find<HTMLElement>(".inspector-tabs"), bindInspectorTabs),
      inspector: new Region(inspectorBody, bindInspector),
      footer: new Region(find<HTMLElement>("footer")),
    };

    scroll.track(canvas);
    scroll.track(inspectorBody);
    scroll.track(find<HTMLElement>(".outline"));
    canvasController.connect(canvas);
    columns = installColumns(host);

    // One document-level handler for the whole shortcut set, bound once. Scoped to this mount so
    // an embed (the Astro page) never has its own keystrokes hijacked by a Studio that is not focused.
    document.addEventListener("keydown", onGlobalKeydown);

    // Edge auto-scroll while dragging. Bound once on the persistent canvas, not per render.
    canvas.addEventListener("dragover", (event) => {
      const rect = canvas.getBoundingClientRect();
      if (event.clientY - rect.top < 50) canvas.scrollTop -= 12;
      if (rect.bottom - event.clientY < 50) canvas.scrollTop += 12;
    });

    return shell;
  }

  function render(): void {
    const view = ensureShell();
    scroll.capture();

    indexes = buildIndexes(project);
    const current = indexes.nodeById.get(selected) ?? project.schema;
    selected = current.id;
    const rootChildren = project.schema.node === "group" ? project.schema.children : [];
    const { contract, diagnostics } = compileToContract(project);
    diagnosticNodeIds = new Set(diagnostics.filter((d) => d.nodeId).map((d) => d.nodeId!));
    const errorCount = diagnostics.filter((d) => d.severity === "error").length;

    view.head.update(headMarkup(indexes));
    view.outline.update(outlineMarkup(rootChildren));
    view.dock.update(dockMarkup());
    view.palette.update(paletteMarkup());
    view.canvasSurface.dataset.canvasSurface = canvasMode;
    // The open toolbar must not sit on top of the form: the canvas yields the width instead.
    view.canvas.parentElement?.setAttribute("data-dock-open", String(dockOpen));

    if (view.surface.update(liveFrameMarkup(Boolean(contract), diagnostics))) {
      plainCanvasSignature = null;
      if (!contract) bindCanvasSurface(view.canvasSurface); // the blockers list has its own controls
    }
    syncLiveCanvas(contract, view);

    view.tabs.update(tabsMarkup(current, diagnostics.length, errorCount));
    view.inspector.update(inspectorBodyMarkup(current, indexes, diagnostics));
    view.footer.update(footerMarkup());

    // The registry has to see both surfaces: tree nodes are in the rail, field rows in the canvas.
    canvasController.elements.refresh(host);
    // After every write, never before: assigning scrollTop to a container the renderer has not
    // refilled yet is clamped to 0 by the browser, which is what used to reset the canvas.
    scroll.restore();
    restoreFocus(view);
  }

  /** Reads back the live canvas values so a structural edit does not wipe what the user typed into it. */
  function captureLiveValues(): Record<string, unknown> | null {
    const session = plainCanvasSession.current;
    if (!session) return null;
    const handles = session.form.f as unknown as Record<string, { value?: () => unknown }>;
    const values: Record<string, unknown> = {};
    for (const [name, handle] of Object.entries(handles)) {
      if (typeof handle?.value === "function") values[name] = handle.value();
    }
    return values;
  }

  function restoreLiveValues(session: MdyPlainForm, values: Record<string, unknown> | null): void {
    if (!values) return;
    const handles = session.form.f as unknown as Record<string, { value?: () => unknown; set?: (v: unknown) => void }>;
    for (const [name, value] of Object.entries(values)) {
      const handle = handles[name];
      if (typeof handle?.set !== "function" || typeof handle.value !== "function") continue;
      if (!Object.is(handle.value(), value)) handle.set(value);
    }
  }

  /** Selection/diagnostic markers are the only per-render change the live canvas needs when the schema is unchanged. */
  function syncLiveSelection(plainHost: HTMLElement): void {
    plainHost.querySelectorAll<HTMLElement>("[data-node]").forEach((element) => {
      const nodeId = element.dataset.node!;
      element.classList.toggle("selected", nodeId === selected);
      element.classList.toggle("has-diagnostic", diagnosticNodeIds.has(nodeId));
    });
    plainHost.querySelectorAll<HTMLElement>("[data-plain-select]").forEach((element) => {
      element.setAttribute("aria-pressed", String(element.dataset.plainSelect === selected));
    });
  }

  /**
   * Remounts the live form only when the schema it was built from actually changed. Selecting a
   * node, switching inspector tab or updating the status bar leaves the running form alone.
   */
  function syncLiveCanvas(contract: ReturnType<typeof compileToContract>["contract"], view: StudioShell): void {
    const plainHost = view.canvasSurface.querySelector<HTMLElement>("[data-plain-canvas]");
    if (!contract || !plainHost) {
      plainCanvasSession.dispose();
      plainCanvasSignature = null;
      return;
    }

    // Layout is part of what the live form renders, so it belongs in the remount signature.
    const signature = JSON.stringify({ schema: project.schema, layout: project.presentation.layout ?? [] });
    if (signature === plainCanvasSignature) {
      syncLiveSelection(plainHost);
      return;
    }

    const carried = captureLiveValues();
    plainCanvasSession.dispose();
    plainHost.replaceChildren();

    const fields = flattenContractFields(contract);
    if (fields.length) {
      const mounted = mountMdyForm(plainHost, fields, { submitLabel: null, layout: contract.layout ?? [] });
      plainCanvasSession.replace(mounted);
      restoreLiveValues(mounted, carried);
    }
    instrumentPlainCanvas(plainHost, fields, indexes);

    if (!plainHost.querySelector(".plain-canvas-field, .plain-canvas-group, .plain-canvas-array")) {
      plainHost.innerHTML = `<div class="plain-canvas-unavailable" role="status">The Contract has no renderable fields, groups, or arrays yet.</div>`;
    }

    plainCanvasSignature = signature;
    bindCanvasSurface(view.canvasSurface);
  }

  /**
   * Only moves focus when an action asked for it. Renders that carry no focus request (a preview
   * repaint, a status update) leave the caret where the user put it — the old unconditional
   * `.canvas` fallback stole it. When a requested target is gone (its node was deleted), the
   * canvas region still takes focus so it never falls through to `<body>`.
   */
  function restoreFocus(view: StudioShell): void {
    if (!focusSelector) return;
    const nodeId = focusSelector.match(/^\[data-node="(.+)"\]$/)?.[1];
    const target = nodeId ? canvasController.elementForNode(nodeId) : host.querySelector<HTMLElement>(focusSelector);
    (target ?? view.canvas).focus();
    focusSelector = null;
  }

  function bindDraggables(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>("[draggable=true]").forEach((el) => {
      el.addEventListener("dragstart", (event) => {
        event.stopPropagation();
        drag = el.dataset.template
          ? { template: el.dataset.template }
          : { nodeId: (el.dataset.dragNode ?? el.dataset.node)! };
        const isPaletteTemplate = Boolean(el.dataset.template);
        // A grip drags on behalf of its node, so it lights the drop targets exactly like
        // dragging the row itself does — otherwise the zones stay invisible mid-drag.
        const dragged = el.classList.contains("plain-canvas-field") ? el : el.closest<HTMLElement>("[data-node]");
        if (!isPaletteTemplate) dragged?.classList.add("dragging");
        if (dragged || isPaletteTemplate) {
          host.querySelectorAll<HTMLElement>(".plain-canvas-drop").forEach((zone) => zone.classList.add("active"));
          event.dataTransfer?.setData("text/plain", el.dataset.dragNode ?? el.dataset.node ?? el.dataset.template ?? "");
          if (event.dataTransfer) event.dataTransfer.effectAllowed = isPaletteTemplate ? "copy" : "move";
        }
      });
      el.addEventListener("dragend", () => {
        el.classList.remove("dragging");
        host.querySelectorAll<HTMLElement>(".dragging").forEach((node) => node.classList.remove("dragging"));
        host.querySelectorAll<HTMLElement>(".plain-canvas-drop").forEach((zone) => zone.classList.remove("active"));
        drag = null;
      });
    });
  }

  // ─── Insert palette ───────────────────────────────────────────────────────

  function openPalette(): void {
    if (paletteOpen) return;
    const active = document.activeElement as HTMLElement | null;
    paletteReturn = active?.dataset?.node ? `[data-node="${active.dataset.node}"]` : null;
    paletteOpen = true;
    paletteQuery = "";
    paletteIndex = 0;
    focusSelector = "[data-palette-input]";
    render();
  }

  function closePalette(restoreFocus = true): void {
    if (!paletteOpen) return;
    paletteOpen = false;
    paletteQuery = "";
    paletteIndex = 0;
    // Escaping out of a modal must land somewhere deliberate, never on <body>.
    focusSelector = restoreFocus ? (paletteReturn ?? "[data-dock-toggle]") : null;
    paletteReturn = null;
    render();
  }

  /** Repaints only the option rows: the input the user is typing in must survive untouched. */
  function repaintPaletteList(): void {
    const layer = shell?.palette.root;
    const list = layer?.querySelector<HTMLElement>("[data-palette-list]");
    if (!layer || !list) return;
    list.innerHTML = paletteListMarkup();
    const matches = filterTemplates(paletteQuery);
    const input = layer.querySelector<HTMLElement>("[data-palette-input]");
    if (matches.length) input?.setAttribute("aria-activedescendant", `mdy-palette-option-${paletteIndex}`);
    else input?.removeAttribute("aria-activedescendant");
    bindPaletteOptions(layer);
    list.querySelector<HTMLElement>(".palette-option.active")?.scrollIntoView?.({ block: "nearest" });
  }

  function movePaletteHighlight(delta: 1 | -1): void {
    const count = filterTemplates(paletteQuery).length;
    if (!count) return;
    paletteIndex = (paletteIndex + delta + count) % count;
    repaintPaletteList();
  }

  function commitPalette(): void {
    const matches = filterTemplates(paletteQuery);
    const chosen = matches[paletteIndex];
    if (!chosen) return;
    paletteOpen = false;
    paletteQuery = "";
    paletteIndex = 0;
    paletteReturn = null;
    insertTemplate(chosen.id);
  }

  function bindPaletteOptions(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>("[data-palette-option]").forEach((option) =>
      option.addEventListener("click", () => {
        paletteIndex = Number(option.dataset.paletteIndex ?? 0);
        commitPalette();
      }),
    );
  }

  function bindPalette(root: HTMLElement): void {
    if (!paletteOpen) return;
    root.querySelector<HTMLElement>("[data-palette-backdrop]")?.addEventListener("click", () => closePalette());
    const input = root.querySelector<HTMLInputElement>("[data-palette-input]");
    input?.addEventListener("input", () => {
      paletteQuery = input.value;
      paletteIndex = 0;
      repaintPaletteList();
    });
    input?.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        movePaletteHighlight(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        movePaletteHighlight(-1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        commitPalette();
      } else if (event.key === "Escape") {
        event.preventDefault();
        closePalette();
      } else if (event.key === "Tab") {
        // The dialog holds one focusable control; trapping Tab keeps a modal modal.
        event.preventDefault();
      }
    });
    bindPaletteOptions(root);
  }

  /** The whole keyboard shortcut set. Ignores keystrokes aimed at another app on the page. */
  function onGlobalKeydown(event: KeyboardEvent): void {
    if (disposed) return;
    const insideStudio = host.contains(document.activeElement) || document.activeElement === document.body;
    if (!insideStudio) return;

    if (hasPrimaryModifier(event) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (paletteOpen) closePalette();
      else openPalette();
      return;
    }
    if (paletteOpen) return; // the palette owns every other key while it is open

    if (event.key === "/" && !isEditableTarget(event.target) && !hasPrimaryModifier(event) && !event.altKey) {
      event.preventDefault();
      openPalette();
      return;
    }
    if (hasPrimaryModifier(event) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) {
        if (history.canRedo()) redo();
      } else if (history.canUndo()) undo();
      return;
    }
    if (hasPrimaryModifier(event) && event.key.toLowerCase() === "d") {
      event.preventDefault();
      if (selected !== project.schema.id) commit(createDuplicateCommand(selected));
      return;
    }
    if (hasPrimaryModifier(event) && event.key === "Backspace") {
      event.preventDefault();
      if (selected !== project.schema.id) remove(selected);
      return;
    }
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      if (selected !== project.schema.id) reorderSibling(selected, event.key === "ArrowUp" ? -1 : 1);
    }
  }

  function bindHead(root: HTMLElement): void {
    root.querySelector<HTMLInputElement>("[data-form-name]")?.addEventListener("change", (e) => {
      const name = (e.target as HTMLInputElement).value;
      focusSelector = "[data-form-name]";
      commit(createRenameProjectCommand(name), selected, "[data-form-name]");
    });
  }

  function bindDock(root: HTMLElement): void {
    root.querySelector<HTMLElement>("[data-dock-toggle]")?.addEventListener("click", () => {
      dockOpen = !dockOpen;
      focusSelector = "[data-dock-toggle]";
      render();
    });
    root.querySelectorAll<HTMLElement>("[data-template]").forEach((el) =>
      el.addEventListener("click", () => insertTemplate(el.dataset.template!)),
    );
    bindDraggables(root);

    root.querySelector<HTMLElement>("[data-undo]")?.addEventListener("click", undo);
    root.querySelector<HTMLElement>("[data-redo]")?.addEventListener("click", redo);
    root.querySelector<HTMLElement>("[data-new]")?.addEventListener("click", () => {
      project = createBlankProject();
      selected = project.schema.id;
      status = "New blank project";
      autosave();
      focusSelector = "[data-new]";
      render();
    });
    root.querySelector<HTMLInputElement>("[data-import]")?.addEventListener("change", (e) => {
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      file
        .text()
        .then((text) => {
          const result = importProjectFromText(text);
          if (!result.project) {
            status = `Import failed: ${result.error}`;
          } else {
            project = result.project;
            selected = project.schema.id;
            inspectorTab = "node"; // an inspector tab left over from the previous project (e.g. stale Export output) would be confusing
            status = result.diagnostics.length
              ? `Imported with ${result.diagnostics.length} warning${result.diagnostics.length > 1 ? "s" : ""}`
              : "Imported project";
            autosave();
          }
          input.value = ""; // allow re-importing the same filename
          focusSelector = "[data-import-button]";
          render();
        })
        .catch(() => {
          status = "Import failed: could not read the file";
          render();
        });
    });
  }

  /**
   * The outline rail. Its tree nodes are one tab stop, not one per node: arrows move within the
   * tree (the app's own Space/arrow reorder scheme still works from any focused node), so a form
   * with thirty fields no longer costs thirty tabs to get past.
   */
  function bindOutline(root: HTMLElement): void {
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-node]"));
    nodes.forEach((node, index) => {
      node.tabIndex = index === 0 || node.dataset.node === selected ? 0 : -1;
      node.addEventListener("keydown", (event) => keyboard(event, node.dataset.node!));
      // Roving focus, but only when nothing is picked up — while moving a node the app's own
      // arrow handling owns the arrows.
      node.addEventListener("keydown", (event) => {
        if (picked || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
        const next = nodes[index + (event.key === "ArrowDown" ? 1 : -1)];
        if (!next) return;
        event.preventDefault();
        for (const other of nodes) other.tabIndex = -1;
        next.tabIndex = 0;
        next.focus();
      });
    });
    bindTreeControls(root);
  }

  /** Selection, delete, duplicate, drag and drop zones — shared by the rail and the live canvas. */
  function bindTreeControls(root: HTMLElement): void {
    bindDraggables(root);
    root.querySelectorAll<HTMLElement>(".drop-zone").forEach((el) => {
      el.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = drag && "template" in drag ? "copy" : "move";
      });
      el.addEventListener("dragenter", () => el.classList.add("drag-over"));
      el.addEventListener("dragleave", () => el.classList.remove("drag-over"));
      el.addEventListener("drop", (event) => {
        event.preventDefault();
        el.classList.remove("drag-over");
        const liveCanvas = el.classList.contains("plain-canvas-drop");
        if (el.dataset.before) drop({ kind: "before", targetId: el.dataset.before }, liveCanvas);
        else if (el.dataset.after) drop({ kind: "after", targetId: el.dataset.after }, liveCanvas);
        else drop({ kind: "inside", parentId: el.dataset.inside!, index: Number(el.dataset.index) });
      });
    });
    root.querySelectorAll<HTMLElement>("[data-select]").forEach((el) =>
      el.addEventListener("click", () => {
        selected = el.dataset.select!;
        render();
      }),
    );
    root.querySelectorAll<HTMLElement>("[data-delete]").forEach((el) =>
      el.addEventListener("click", () => remove(el.dataset.delete!)),
    );
    root.querySelectorAll<HTMLElement>("[data-duplicate]").forEach((el) =>
      el.addEventListener("click", () => commit(createDuplicateCommand(el.dataset.duplicate!))),
    );
  }

  /**
   * Everything inside the canvas surface: the instrumented live-form canvas.
   */
  /** "Go to" and the quick fixes — used by the Diagnostics tab and by the blockers list. */
  function bindDiagnosticActions(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>("[data-goto-node]").forEach((el) =>
      el.addEventListener("click", () => {
        const nodeId = el.dataset.gotoNode!;
        selected = nodeId;
        inspectorTab = "node";
        focusSelector = `[data-node="${nodeId}"]`;
        render();
      }),
    );
    root.querySelectorAll<HTMLElement>("[data-fix-clear-pattern]").forEach((el) =>
      el.addEventListener("click", () =>
        commit(createUpdateValidatorCommand(el.dataset.fixNode!, el.dataset.fixClearPattern!, { pattern: "" })),
      ),
    );
    root.querySelectorAll<HTMLElement>("[data-fix-add-option]").forEach((el) =>
      el.addEventListener("click", () =>
        commit(createSetFieldOptionsCommand(el.dataset.fixAddOption!, [{ value: "option", label: "Option" }])),
      ),
    );
    root.querySelector<HTMLInputElement>("[data-exclude-draft]")?.addEventListener("change", (e) => {
      // Draft exclusion is a property of the field, not only a remedy the diagnostics offer.
      const draft = project.behaviors.draft;
      const exclude = (draft?.exclude ?? []).filter((ref) => ref.nodeId !== selected);
      if ((e.target as HTMLInputElement).checked) exclude.push({ nodeId: selected });
      commit(
        createUpdateBehaviorCommand({ draft: { key: draft?.key ?? "draft", exclude } }),
        selected,
        "[data-exclude-draft]",
      );
    });
    root.querySelector<HTMLElement>("[data-fix-prune-layout]")?.addEventListener("click", () => {
      commit(createUpdateLayoutCommand(pruneLayout(project.presentation.layout ?? []), "Clean up layout"));
    });
    root.querySelectorAll<HTMLElement>("[data-fix-drop-reference]").forEach((el) =>
      el.addEventListener("click", () => {
        // A reference to a deleted node lives in a form validator's dependencies or error
        // target, or in the draft-exclusion list. Strip it wherever it is.
        const gone = el.dataset.fixDropReference!;
        for (const validator of project.formValidators) {
          if (validator.errorTarget?.nodeId === gone) {
            commit(createUpdateFormValidatorCommand(validator.id, { errorTarget: null }));
          }
        }
        const draft = project.behaviors.draft;
        if (draft?.exclude?.some((ref) => ref.nodeId === gone)) {
          commit(
            createUpdateBehaviorCommand({
              draft: { key: draft.key, exclude: draft.exclude.filter((ref) => ref.nodeId !== gone) },
            }),
          );
        }
        const orphaned = project.formValidators.filter((v) => v.dependencies.some((dep) => dep.nodeId === gone));
        for (const validator of orphaned) commit(createRemoveFormValidatorCommand(validator.id));
      }),
    );
    root.querySelectorAll<HTMLElement>("[data-fix-exclude-draft]").forEach((el) =>
      el.addEventListener("click", () => {
        const nodeId = el.dataset.fixExcludeDraft!;
        const currentDraft = project.behaviors.draft;
        const exclude = [...(currentDraft?.exclude ?? []), { nodeId }];
        commit(createUpdateBehaviorCommand({ draft: { key: currentDraft?.key ?? "draft", exclude } }));
      }),
    );

  }

  function bindCanvasSurface(root: HTMLElement): void {
    bindDiagnosticActions(root);
    root.querySelectorAll<HTMLButtonElement>("[data-toggle-required]").forEach((button) =>
      button.addEventListener("click", () => toggleRequired(button.dataset.toggleRequired!)),
    );
    root.querySelectorAll<HTMLButtonElement>("[data-layout-columns]").forEach((button) =>
      button.addEventListener("click", () => {
        const nodeId = button.dataset.layoutColumns!;
        if (button.dataset.layoutInRow === "true") removeFromColumnRow(nodeId);
        else addToColumnRow(nodeId);
      }),
    );

    // Enter in a label commits it and starts the next field of the same kind — the composing
    // rhythm every fast builder has. Handled on keydown so the follow-up insert is ours to order.
    root.querySelectorAll<HTMLInputElement>('[data-inline-edit="label"]').forEach((input) =>
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        const nodeId = input.dataset.inlineNode;
        const node = nodeId ? indexes.nodeById.get(nodeId) : undefined;
        if (!nodeId || !node) return;
        const value = input.value.trim();
        // Commit the label first: that render detaches this input, so its own `change` can no
        // longer fire and double-commit behind the insert.
        if (value !== (node.label ?? "")) commit(createUpdateNodeCommand(nodeId, { label: value }), nodeId);
        selected = nodeId;
        insertTemplate(node.node === "field" ? node.fieldKind : "text");
      }),
    );

    root.querySelectorAll<HTMLInputElement>("[data-inline-edit]").forEach((input) =>
      input.addEventListener("change", () => {
        const nodeId = input.dataset.inlineNode;
        const kind = input.dataset.inlineEdit;
        if (!nodeId || (kind !== "label" && kind !== "name")) return;
        const value = input.value.trim();
        // A blank code name would be rejected by the command anyway; put the old one back so the
        // field does not sit there looking renamed when it is not.
        if (kind === "name" && !value) {
          input.value = indexes.nodeById.get(nodeId)?.name ?? "";
          return;
        }
        selected = nodeId;
        commit(
          createUpdateNodeCommand(nodeId, kind === "name" ? { name: value } : { label: value }),
          nodeId,
          `[data-inline-edit="${kind}"][data-inline-node="${nodeId}"]`,
        );
      }),
    );

    root.querySelectorAll<HTMLSelectElement>("[data-plain-insert]").forEach((select) =>
      select.addEventListener("change", () => {
        const targetId = select.dataset.plainInsertTarget;
        const placementKind = select.dataset.plainInsert;
        const template = select.value;
        if (!targetId || !template || (placementKind !== "before" && placementKind !== "after")) return;
        const created = createNodeFromTemplate(template);
        selected = created.id;
        commit(
          createInsertCommand(created, { kind: placementKind, targetId }),
          created.id,
          `[data-inline-edit="label"][data-inline-node="${created.id}"]`,
        );
      }),
    );

    root.querySelectorAll<HTMLButtonElement>("[data-plain-array-row-action]").forEach((button) =>
      button.addEventListener("click", () => {
        const nodeId = button.dataset.plainArrayNode;
        const index = Number(button.dataset.plainArrayRowIndex);
        const action = button.dataset.plainArrayRowAction;
        const array = nodeId ? indexes.nodeById.get(nodeId) : undefined;
        if (!nodeId || array?.node !== "array" || !Number.isInteger(index) || index < 0 || index >= array.initialRows.length) return;
        const rows = [...array.initialRows];
        if (action === "remove") rows.splice(index, 1);
        else if (action === "up" && index > 0) [rows[index - 1], rows[index]] = [rows[index], rows[index - 1]];
        else if (action === "down" && index < rows.length - 1) [rows[index], rows[index + 1]] = [rows[index + 1], rows[index]];
        else return;
        selected = nodeId;
        const focusIndex = action === "remove" ? Math.min(index, rows.length - 1) : action === "up" ? index - 1 : index + 1;
        commit(createUpdateNodeCommand(nodeId, { initialRows: rows }), nodeId,
          rows.length ? `[data-plain-array="${nodeId}"] [data-plain-array-row="${focusIndex}"] [data-plain-array-row-action="${action}"]` : `[data-plain-array="${nodeId}"] [data-plain-array-add]`);
      }),
    );
    root.querySelectorAll<HTMLButtonElement>("[data-plain-array-move]").forEach((button) =>
      button.addEventListener("click", () => {
        const nodeId = button.dataset.plainArrayNode;
        const targetId = button.dataset.plainArrayTarget;
        const kind = button.dataset.plainArrayMove;
        if (!nodeId || !targetId || (kind !== "before" && kind !== "after")) return;
        selected = nodeId;
        commit(createMoveCommand(nodeId, { kind, targetId }), nodeId, `[data-plain-select="${nodeId}"]`);
      }),
    );
    root.querySelectorAll<HTMLButtonElement>("[data-plain-array-root]").forEach((button) =>
      button.addEventListener("click", () => {
        const nodeId = button.dataset.plainArrayRoot;
        if (!nodeId) return;
        selected = nodeId;
        commit(createMoveCommand(nodeId, { kind: "inside", parentId: project.schema.id, index: indexes.childrenByParent.get(project.schema.id)?.length ?? 0 }), nodeId, `[data-plain-select="${nodeId}"]`);
      }),
    );
    root.querySelectorAll<HTMLSelectElement>("[data-plain-array-into]").forEach((select) =>
      select.addEventListener("change", () => {
        const nodeId = select.dataset.plainArrayInto;
        const parentId = select.value;
        if (!nodeId || !parentId) return;
        selected = nodeId;
        commit(createMoveCommand(nodeId, { kind: "inside", parentId, index: indexes.childrenByParent.get(parentId)?.length ?? 0 }), nodeId, `[data-plain-select="${nodeId}"]`);
      }),
    );

    root.querySelectorAll<HTMLButtonElement>("[data-plain-array-add]").forEach((button) =>
      button.addEventListener("click", () => {
        const nodeId = button.dataset.plainArrayAdd;
        const array = nodeId ? indexes.nodeById.get(nodeId) : undefined;
        if (!nodeId || array?.node !== "array") return;
        selected = nodeId;
        commit(
          createUpdateNodeCommand(nodeId, {
            initialRows: [...array.initialRows, defaultRowValue(array.item)],
          }),
          nodeId,
          `[data-plain-array="${nodeId}"] [data-plain-array-add]`,
        );
      }),
    );
    root.querySelectorAll<HTMLButtonElement>("[data-plain-array-remove]").forEach((button) =>
      button.addEventListener("click", () => {
        const nodeId = button.dataset.plainArrayRemove;
        const array = nodeId ? indexes.nodeById.get(nodeId) : undefined;
        if (!nodeId || array?.node !== "array" || array.initialRows.length === 0) return;
        selected = nodeId;
        commit(
          createUpdateNodeCommand(nodeId, {
            initialRows: array.initialRows.slice(0, -1),
          }),
          nodeId,
          `[data-plain-array="${nodeId}"] [data-plain-array-remove]`,
        );
      }),
    );

    root.querySelectorAll<HTMLButtonElement>("[data-plain-field-root]").forEach((button) =>
      button.addEventListener("click", () => {
        const nodeId = button.dataset.plainFieldRoot;
        if (!nodeId) return;
        selected = nodeId;
        commit(
          createMoveCommand(nodeId, {
            kind: "inside",
            parentId: project.schema.id,
            index: indexes.childrenByParent.get(project.schema.id)?.length ?? 0,
          }),
          nodeId,
          `[data-plain-select="${nodeId}"]`,
        );
      }),
    );
    root.querySelectorAll<HTMLSelectElement>("[data-plain-field-into]").forEach((select) =>
      select.addEventListener("change", () => {
        const nodeId = select.dataset.plainFieldInto;
        const parentId = select.value;
        if (!nodeId || !parentId) return;
        selected = nodeId;
        commit(
          createMoveCommand(nodeId, {
            kind: "inside",
            parentId,
            index: indexes.childrenByParent.get(parentId)?.length ?? 0,
          }),
          nodeId,
          `[data-plain-select="${nodeId}"]`,
        );
      }),
    );

    root.querySelectorAll<HTMLButtonElement>("[data-plain-group-move]").forEach((button) =>
      button.addEventListener("click", () => {
        const nodeId = button.dataset.plainGroupNode;
        const targetId = button.dataset.plainGroupTarget;
        const kind = button.dataset.plainGroupMove;
        if (!nodeId || !targetId || (kind !== "before" && kind !== "after")) return;
        selected = nodeId;
        commit(createMoveCommand(nodeId, { kind, targetId }), nodeId, `[data-plain-select="${nodeId}"]`);
      }),
    );
    root.querySelectorAll<HTMLButtonElement>("[data-plain-group-root]").forEach((button) =>
      button.addEventListener("click", () => {
        const nodeId = button.dataset.plainGroupRoot;
        if (!nodeId) return;
        selected = nodeId;
        commit(createMoveCommand(nodeId, { kind: "inside", parentId: project.schema.id, index: indexes.childrenByParent.get(project.schema.id)?.length ?? 0 }), nodeId, `[data-plain-select="${nodeId}"]`);
      }),
    );
    root.querySelectorAll<HTMLSelectElement>("[data-plain-array-shape]").forEach((select) =>
      select.addEventListener("change", () => {
        const arrayId = select.dataset.plainArrayShape;
        const template = select.value;
        if (!arrayId || !template) return;
        // `arrayItem` replaces what a row is. The editor has always supported the placement; nothing
        // reached it, so a repeater's rows were whatever shape they were created with for ever.
        const created = createNodeFromTemplate(template);
        selected = created.id;
        commit(createInsertCommand(created, { kind: "arrayItem", arrayId }), created.id,
          `[data-plain-array-shape="${arrayId}"]`);
      }),
    );

    root.querySelectorAll<HTMLSelectElement>("[data-plain-group-into]").forEach((select) =>
      select.addEventListener("change", () => {
        const nodeId = select.dataset.plainGroupInto;
        const parentId = select.value;
        if (!nodeId || !parentId) return;
        selected = nodeId;
        commit(createMoveCommand(nodeId, { kind: "inside", parentId, index: indexes.childrenByParent.get(parentId)?.length ?? 0 }), nodeId, `[data-plain-select="${nodeId}"]`);
      }),
    );

    root.querySelectorAll<HTMLButtonElement>("[data-plain-move]").forEach((button) =>
      button.addEventListener("click", () => {
        const nodeId = button.dataset.plainMoveNode;
        const targetId = button.dataset.plainMoveTarget;
        const kind = button.dataset.plainMove;
        if (!nodeId || !targetId || (kind !== "before" && kind !== "after")) return;
        selected = nodeId;
        commit(
          createMoveCommand(nodeId, { kind, targetId }),
          nodeId,
          `[data-plain-select="${nodeId}"]`,
        );
      }),
    );

    root.querySelectorAll<HTMLButtonElement>("[data-plain-select]").forEach((button) =>
      button.addEventListener("click", () => {
        const nodeId = button.dataset.plainSelect;
        if (!nodeId) return;
        selected = nodeId;
        inspectorTab = "node";
        status = "Selected field from live canvas";
        focusSelector = `[data-plain-select="${nodeId}"]`;
        render();
      }),
    );

    bindTreeControls(root);

    root.querySelectorAll<HTMLElement>("[data-node]").forEach((el) =>
      el.addEventListener("keydown", (e) => keyboard(e, el.dataset.node!)),
    );
  }

  function bindInspectorTabs(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>("[data-inspector-tab]").forEach((el) =>
      el.addEventListener("click", () => {
        const tab = el.dataset.inspectorTab as "node" | "form" | "diagnostics" | "export" | "preview";
        inspectorTab = tab;
        focusSelector = `[data-inspector-tab="${tab}"]`;
        render();
      }),
    );
  }

  /** Everything inside the inspector body — whichever tab is currently rendered there. */
  function bindInspector(root: HTMLElement): void {
    root.querySelector<HTMLInputElement>("[data-name]")?.addEventListener("change", (e) =>
      commit(createUpdateNodeCommand(selected, { name: (e.target as HTMLInputElement).value })),
    );
    root.querySelector<HTMLInputElement>("[data-label]")?.addEventListener("change", (e) =>
      commit(createUpdateNodeCommand(selected, { label: (e.target as HTMLInputElement).value })),
    );
    root.querySelector<HTMLTextAreaElement>("[data-description]")?.addEventListener("change", (e) =>
      commit(createUpdateNodeCommand(selected, { description: (e.target as HTMLTextAreaElement).value })),
    );

    root.querySelector<HTMLSelectElement>("[data-add-validator]")?.addEventListener("change", (e) => {
      const kind = (e.target as HTMLSelectElement).value as StudioValidatorKind | "";
      if (!kind) return;
      const entry = getFieldValidatorRegistryEntry(kind);
      commit(createAddValidatorCommand(selected, { id: createId("val"), kind, ...entry?.defaultConfig() }));
    });
    root.querySelectorAll<HTMLElement>("[data-remove-validator]").forEach((el) =>
      el.addEventListener("click", () => commit(createRemoveValidatorCommand(selected, el.dataset.removeValidator!))),
    );
    root.querySelectorAll<HTMLInputElement>("[data-validator-pattern]").forEach((el) =>
      el.addEventListener("change", () =>
        commit(createUpdateValidatorCommand(selected, el.dataset.validatorPattern!, { pattern: el.value })),
      ),
    );
    root.querySelectorAll<HTMLInputElement>("[data-validator-message]").forEach((el) =>
      el.addEventListener("change", () =>
        commit(createUpdateValidatorCommand(selected, el.dataset.validatorMessage!, { message: el.value })),
      ),
    );
    root.querySelectorAll<HTMLInputElement>("[data-validator-value]").forEach((el) =>
      el.addEventListener("change", () =>
        commit(createUpdateValidatorCommand(selected, el.dataset.validatorValue!, { value: Number(el.value) })),
      ),
    );

    root.querySelectorAll<HTMLInputElement>("[data-option-value]").forEach((el) =>
      el.addEventListener("change", () => {
        const field = getSelectedField();
        if (!field) return;
        const options = [...(field.options ?? [])];
        const index = Number(el.dataset.optionValue);
        options[index] = { ...options[index]!, value: el.value };
        commit(createSetFieldOptionsCommand(selected, options));
      }),
    );
    root.querySelectorAll<HTMLInputElement>("[data-option-label]").forEach((el) =>
      el.addEventListener("change", () => {
        const field = getSelectedField();
        if (!field) return;
        const options = [...(field.options ?? [])];
        const index = Number(el.dataset.optionLabel);
        options[index] = { ...options[index]!, label: el.value };
        commit(createSetFieldOptionsCommand(selected, options));
      }),
    );
    root.querySelectorAll<HTMLElement>("[data-remove-option]").forEach((el) =>
      el.addEventListener("click", () => {
        const field = getSelectedField();
        if (!field) return;
        const index = Number(el.dataset.removeOption);
        commit(createSetFieldOptionsCommand(selected, (field.options ?? []).filter((_, i) => i !== index)));
      }),
    );
    root.querySelector<HTMLElement>("[data-add-option]")?.addEventListener("click", () => {
      const field = getSelectedField();
      if (!field) return;
      commit(createSetFieldOptionsCommand(selected, [...(field.options ?? []), { value: "", label: "" }]));
    });

    // Native <details> already toggled itself in the DOM by the time this fires — just keep our
    // tracked state in sync so it survives the next rewrite of this region.
    root.querySelectorAll<HTMLDetailsElement>("details.accordion").forEach((el) =>
      el.addEventListener("toggle", () => {
        const id = el.dataset.section!;
        if (el.open) expandedSections.add(id);
        else expandedSections.delete(id);
      }),
    );

    bindDiagnosticActions(root);
    root.querySelector<HTMLElement>("[data-enable-server-validator]")?.addEventListener("click", () => {
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
    root.querySelector<HTMLElement>("[data-remove-server-validator]")?.addEventListener("click", () => {
      commit(createSetServerValidatorCommand(selected, null));
    });
    root.querySelector<HTMLSelectElement>("[data-server-impl]")?.addEventListener("change", (e) => {
      const field = getSelectedField();
      if (!field?.serverValidator) return;
      commit(createSetServerValidatorCommand(selected, { ...field.serverValidator, implementationRef: (e.target as HTMLSelectElement).value }));
    });
    root.querySelector<HTMLElement>("[data-new-server-impl]")?.addEventListener("click", () => {
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
    root.querySelector<HTMLInputElement>("[data-server-debounce]")?.addEventListener("change", (e) => {
      const field = getSelectedField();
      if (!field?.serverValidator) return;
      commit(createSetServerValidatorCommand(selected, { ...field.serverValidator, debounceMs: Number((e.target as HTMLInputElement).value) }));
    });
    root.querySelector<HTMLInputElement>("[data-server-timeout]")?.addEventListener("change", (e) => {
      const field = getSelectedField();
      if (!field?.serverValidator) return;
      commit(createSetServerValidatorCommand(selected, { ...field.serverValidator, timeoutMs: Number((e.target as HTMLInputElement).value) }));
    });
    root.querySelector<HTMLInputElement>("[data-server-skip-empty]")?.addEventListener("change", (e) => {
      const field = getSelectedField();
      if (!field?.serverValidator) return;
      const next = { ...field.serverValidator };
      if ((e.target as HTMLInputElement).checked) next.skipWhen = { op: "isEmpty", operand: { nodeId: selected } };
      else delete next.skipWhen;
      commit(createSetServerValidatorCommand(selected, next));
    });
    root.querySelector<HTMLInputElement>("[data-server-message]")?.addEventListener("change", (e) => {
      const field = getSelectedField();
      if (!field?.serverValidator) return;
      commit(createSetServerValidatorCommand(selected, { ...field.serverValidator, errorMessage: (e.target as HTMLInputElement).value }));
    });
    root.querySelectorAll<HTMLInputElement>("[data-server-dependency]").forEach((el) =>
      el.addEventListener("change", () => {
        const field = getSelectedField();
        if (!field?.serverValidator) return;
        const checkedIds = Array.from(root.querySelectorAll<HTMLInputElement>("[data-server-dependency]"))
          .filter((c) => c.checked)
          .map((c) => c.dataset.serverDependency!);
        commit(createSetServerValidatorCommand(selected, { ...field.serverValidator, dependencies: checkedIds.map((nodeId) => ({ nodeId })) }));
      }),
    );

    root.querySelector<HTMLSelectElement>("[data-fv-ref]")?.addEventListener("change", (e) => {
      formValidatorDraft = { ...formValidatorDraft, refNodeId: (e.target as HTMLSelectElement).value };
      render();
    });
    root.querySelector<HTMLSelectElement>("[data-fv-op]")?.addEventListener("change", (e) => {
      formValidatorDraft = { ...formValidatorDraft, op: (e.target as HTMLSelectElement).value as StudioExpressionOp };
      render();
    });
    root.querySelector<HTMLInputElement>("[data-fv-literal]")?.addEventListener("change", (e) => {
      formValidatorDraft = { ...formValidatorDraft, literal: (e.target as HTMLInputElement).value };
    });
    root.querySelectorAll<HTMLSelectElement>("[data-fv-sub-ref]").forEach((el) =>
      el.addEventListener("change", () => {
        const index = Number(el.dataset.fvSubRef) as 0 | 1;
        const subConditions: [ConditionDraft, ConditionDraft] = [...formValidatorDraft.subConditions];
        subConditions[index] = { ...subConditions[index], refNodeId: el.value };
        formValidatorDraft = { ...formValidatorDraft, subConditions };
      }),
    );
    root.querySelectorAll<HTMLSelectElement>("[data-fv-sub-op]").forEach((el) =>
      el.addEventListener("change", () => {
        const index = Number(el.dataset.fvSubOp) as 0 | 1;
        const subConditions: [ConditionDraft, ConditionDraft] = [...formValidatorDraft.subConditions];
        subConditions[index] = { ...subConditions[index], op: el.value as StudioExpressionOp };
        formValidatorDraft = { ...formValidatorDraft, subConditions };
        render();
      }),
    );
    root.querySelectorAll<HTMLInputElement>("[data-fv-sub-literal]").forEach((el) =>
      el.addEventListener("change", () => {
        const index = Number(el.dataset.fvSubLiteral) as 0 | 1;
        const subConditions: [ConditionDraft, ConditionDraft] = [...formValidatorDraft.subConditions];
        subConditions[index] = { ...subConditions[index], literal: el.value };
        formValidatorDraft = { ...formValidatorDraft, subConditions };
      }),
    );
    root.querySelector<HTMLSelectElement>("[data-fv-target]")?.addEventListener("change", (e) => {
      formValidatorDraft = { ...formValidatorDraft, errorTargetId: (e.target as HTMLSelectElement).value };
    });
    root.querySelector<HTMLInputElement>("[data-fv-message]")?.addEventListener("change", (e) => {
      formValidatorDraft = { ...formValidatorDraft, message: (e.target as HTMLInputElement).value };
    });
    root.querySelector<HTMLElement>("[data-add-form-validator]")?.addEventListener("click", () => {
      commit(createAddFormValidatorCommand(buildFormValidatorFromDraft(formValidatorDraft)));
      formValidatorDraft = { ...formValidatorDraft, literal: "", message: "" };
    });
    root.querySelectorAll<HTMLElement>("[data-remove-form-validator]").forEach((el) =>
      el.addEventListener("click", () => commit(createRemoveFormValidatorCommand(el.dataset.removeFormValidator!))),
    );
    root.querySelectorAll<HTMLInputElement>("[data-form-validator-message]").forEach((el) =>
      el.addEventListener("change", () =>
        commit(createUpdateFormValidatorCommand(el.dataset.formValidatorMessage!, { message: el.value })),
      ),
    );

    root.querySelector<HTMLSelectElement>("[data-submit-impl]")?.addEventListener("change", (e) => {
      const value = (e.target as HTMLSelectElement).value;
      commit(createUpdateBehaviorCommand({ submit: value ? { implementationRef: value } : undefined }));
    });
    root.querySelector<HTMLElement>("[data-new-submit-impl]")?.addEventListener("click", () => {
      const id = createId("impl");
      const ref = { id, role: "submitAction" as const, displayName: `submitForm${id.slice(-5)}`, mode: "stub" as const };
      commit(createAddImplementationCommand(ref));
      commit(createUpdateBehaviorCommand({ submit: { implementationRef: ref.id } }));
    });
    root.querySelector<HTMLElement>("[data-remove-submit-action]")?.addEventListener("click", () => {
      commit(createUpdateBehaviorCommand({ submit: undefined }));
    });

    root.querySelector<HTMLSelectElement>("[data-export-target]")?.addEventListener("change", (e) => {
      exportState = { ...exportState, targetId: (e.target as HTMLSelectElement).value, artifact: null, error: null };
      render();
    });
    root.querySelector<HTMLElement>("[data-export-generate]")?.addEventListener("click", () => {
      void runExport();
    });
    root.querySelectorAll<HTMLElement>("[data-export-download]").forEach((el) =>
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
    root.querySelectorAll<HTMLButtonElement>("[data-export-copy]").forEach((el) =>
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

    root.querySelectorAll<HTMLElement>("[data-preview-field]").forEach((el) =>
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
    root.querySelectorAll<HTMLElement>("[data-preview-array-push]").forEach((el) =>
      el.addEventListener("click", () => {
        const path = el.dataset.previewArrayPush!;
        const handle = getPreviewHandle(previewForm, path) as { push?(v: unknown): void } | null;
        const nodeId = indexes.nodeByPath.get(path);
        const node = nodeId ? indexes.nodeById.get(nodeId) : null;
        if (handle?.push && node?.node === "array") handle.push(defaultRowValue(node.item));
      }),
    );
    root.querySelectorAll<HTMLElement>("[data-preview-array-remove]").forEach((el) =>
      el.addEventListener("click", () => {
        const path = el.dataset.previewArrayRemove!;
        const index = Number(el.dataset.previewArrayIndex);
        const handle = getPreviewHandle(previewForm, path) as { remove?(i: number): void } | null;
        handle?.remove?.(index);
      }),
    );
    root.querySelectorAll<HTMLSelectElement>("[data-preview-mock-mode]").forEach((el) =>
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
    root.querySelector<HTMLElement>("[data-preview-submit]")?.addEventListener("click", () => {
      if (!previewForm) return;
      const submitRef = project.behaviors.submit?.implementationRef;
      const mockCfg = submitRef ? previewMockConfig[submitRef] : undefined;
      void previewForm.submit(createMockSubmitAction(mockCfg ?? {}));
    });
  }

  function keyboard(event: KeyboardEvent, id: string): void {
    const idx = indexes;

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
      // A repeater is a container too: moving into one means moving into the shape of its rows.
      const target = container?.node === "array" ? idx.nodeById.get(container.item.id) : container;
      if (target?.node === "group") {
        commit(createMoveCommand(picked, { kind: "inside", parentId: target.id, index: target.children.length }), picked);
      }
    } else if (event.key === "ArrowLeft" && parent) {
      // Out of a repeater's row shape, the thing to land after is the *array* — the row shape is the
      // array's item and has no sibling slot of its own, so aiming at it threw "has no group parent"
      // and a node moved into a row could never be moved back out.
      const parentNode = idx.nodeById.get(parent);
      const grandparent = idx.parentById.get(parent);
      const grandparentNode = grandparent ? idx.nodeById.get(grandparent) : null;
      const escapeTarget = grandparentNode?.node === "array" && grandparentNode.item.id === parentNode?.id
        ? grandparent
        : parent;
      if (grandparent && escapeTarget) {
        event.preventDefault();
        commit(createMoveCommand(picked, { kind: "after", targetId: escapeTarget }), picked);
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

  // Auto-restore — only when the caller did not explicitly
  // pass a project: an explicit `initial` always wins over IndexedDB. Async by nature (IndexedDB
  // has no sync API), so this can only run *after* the synchronous first render above; `disposed`
  // guards against restoring into a host that unmounted before the read finished.
  if (!initial) {
    void loadSession()
      .then((result) => {
        if (disposed || !result) return;
        project = result.project;
        selected = project.schema.id;
        status = "Restored last session";
        render();
      })
      .catch(() => {}); // no IndexedDB (e.g. non-browser test env) -> stay on the blank project, not a crash
  }

  return () => {
    disposed = true;
    plainCanvasSession.dispose();
    plainCanvasSignature = null;
    previewSession.dispose();
    previewEffect = null;
    canvasController.dispose();
    columns?.dispose();
    columns = null;
    scroll.clear();
    document.removeEventListener("keydown", onGlobalKeydown);
    shell = null;
    host.replaceChildren();
  };
}
