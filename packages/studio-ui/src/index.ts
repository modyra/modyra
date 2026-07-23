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
  type MdyStudioProject,
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
  createUpdateFormValidatorCommand,
  createUpdateNodeCommand,
  createUpdateValidatorCommand,
  inspectDelete,
  type Command,
  type Placement,
} from "@modyra/studio-editor";
import "./studio.css";

type Drag = { nodeId: string } | { template: string };

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

/** P5: "Validation" inspector section — add/edit/remove, only ever offering registry-compatible kinds. */
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
    <div class="validators">
      <h3>Validation</h3>
      <ul class="validator-list">${rows}</ul>
      ${available.length ? `<select data-add-validator aria-label="Add validator"><option value="">+ Add validator</option>${options}</select>` : ""}
    </div>`;
}

/** P5: "Options" inspector section, select/multiselect only (plan section 8 "properties options"). */
function optionsMarkup(node: FieldNode): string {
  if (node.fieldKind !== "select" && node.fieldKind !== "multiselect") return "";
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
    <div class="options">
      <h3>Options</h3>
      <ul class="option-list">${rows}</ul>
      <button data-add-option>+ Add option</button>
    </div>`;
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
    return `
      <div class="server-validator">
        <h3>Server validation</h3>
        <button data-enable-server-validator>+ Enable server validation</button>
      </div>`;
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
    <div class="server-validator">
      <h3>Server validation</h3>
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
      <button data-remove-server-validator>Remove server validation</button>
    </div>`;
}

/** Draft state for the "add a form validator" mini-form — templates, not a general recursive expression tree
    (see .modyra/framework/STATUS.md P5 batch 2 note: and/or/not composition is a deferred gap). */
interface FormValidatorDraft {
  kind: "form" | "crossField";
  refNodeId: string;
  op: StudioExpressionOp;
  literal: string;
  errorTargetId: string;
  message: string;
}

const CONDITION_TEMPLATES: { op: StudioExpressionOp; label: string; needsLiteral: boolean; literalKind: "text" | "number" }[] = [
  { op: "isEmpty", label: "is empty", needsLiteral: false, literalKind: "text" },
  { op: "isNotEmpty", label: "is not empty", needsLiteral: false, literalKind: "text" },
  { op: "equals", label: "equals", needsLiteral: true, literalKind: "text" },
  { op: "notEquals", label: "does not equal", needsLiteral: true, literalKind: "text" },
  { op: "greaterThan", label: "is greater than", needsLiteral: true, literalKind: "number" },
  { op: "lessThan", label: "is less than", needsLiteral: true, literalKind: "number" },
  { op: "matches", label: "matches pattern", needsLiteral: true, literalKind: "text" },
  { op: "lengthAtLeast", label: "has length at least", needsLiteral: true, literalKind: "number" },
  { op: "lengthAtMost", label: "has length at most", needsLiteral: true, literalKind: "number" },
];

function buildFormValidatorFromDraft(draft: FormValidatorDraft): StudioFormValidator {
  const template = CONDITION_TEMPLATES.find((t) => t.op === draft.op)!;
  const ref = { nodeId: draft.refNodeId };
  const literalValue: string | number = template.literalKind === "number" ? Number(draft.literal || "0") : draft.literal;
  const condition: StudioExpression = template.needsLiteral
    ? { op: draft.op, operands: [ref, literalValue] }
    : { op: draft.op, operand: ref };
  return {
    id: createId("val"),
    kind: draft.kind,
    dependencies: [{ nodeId: draft.refNodeId }],
    condition,
    message: draft.message || "Invalid value",
    errorTarget: draft.errorTargetId ? { nodeId: draft.errorTargetId } : null,
  };
}

/** P5b2: project-level "Form validators" section — always visible (not tied to node selection). */
export function formValidatorsMarkup(project: MdyStudioProject, idx: StudioIndexes, draft: FormValidatorDraft): string {
  const rows = project.formValidators
    .map((v) => {
      const depsPaths = v.dependencies.map((d) => idx.pathByNode.get(d.nodeId) ?? d.nodeId).join(", ") || "(none)";
      const targetPath = v.errorTarget ? (idx.pathByNode.get(v.errorTarget.nodeId) ?? v.errorTarget.nodeId) : "(none)";
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

  return `
    <div class="form-validators">
      <h2>Form validators</h2>
      <ul class="form-validator-list">${rows}</ul>
      <div class="fv-draft">
        <label>Field<select data-fv-ref>${nodeRefOptionsMarkup(idx, draft.refNodeId)}</select></label>
        <label>Condition<select data-fv-op>${opOptions}</select></label>
        ${template.needsLiteral ? `<label>Value<input data-fv-literal value="${escapeHtml(draft.literal)}"></label>` : ""}
        <label>Error target<select data-fv-target>${targetOptions}</select></label>
        <label>Message<input data-fv-message value="${escapeHtml(draft.message)}"></label>
        <button data-add-form-validator>+ Add form validator</button>
      </div>
    </div>`;
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
    errorTargetId: "",
    message: "",
  };
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

  function getSelectedField(): FieldNode | null {
    const node = buildIndexes(project).nodeById.get(selected);
    return node && node.node === "field" ? node : null;
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
          <button class="select" data-select="${n.id}">${label}<small>${n.node}</small></button>
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
            <h2>Inspector</h2>
            <label>Name<input data-name value="${escapeHtml(current.name)}"></label>
            <label>Label<input data-label value="${escapeHtml(current.label ?? "")}"></label>
            <label>Description<textarea data-description>${escapeHtml(current.description ?? "")}</textarea></label>
            ${current.node === "field" ? validatorsMarkup(current) + optionsMarkup(current) + serverValidatorMarkup(project, idx, current) : ""}
            <dl>
              <dt>Path</dt><dd>${escapeHtml(idx.pathByNode.get(current.id) || "root")}</dd>
              <dt>Stable ID</dt><dd>${escapeHtml(current.id)}</dd>
            </dl>
            ${formValidatorsMarkup(project, idx, formValidatorDraft)}
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
    host.replaceChildren();
  };
}
