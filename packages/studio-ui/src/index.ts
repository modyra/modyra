/**
 * Vanilla (no framework) Studio canvas shell — palette, tree, inspector,
 * pointer drag + keyboard-equivalent reordering, undo/redo. Consumes
 * @modyra/studio-model (project/indexes) and @modyra/studio-editor
 * (commands/history) only; owns no model logic itself (R4).
 */
import {
  buildIndexes,
  createBlankProject,
  createId,
  type MdyStudioProject,
  type StudioSchemaNode,
} from "@modyra/studio-model";
import {
  CommandHistory,
  CommandRejectedError,
  createDeleteCommand,
  createDuplicateCommand,
  createInsertCommand,
  createMoveCommand,
  createUpdateNodeCommand,
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

/** Mounts the Studio editor into `host`. Returns a disposer that clears the host. */
export function mountStudio(host: HTMLElement, initial?: MdyStudioProject): () => void {
  let project = initial ? structuredClone(initial) : createBlankProject();
  let selected = project.schema.id;
  let drag: Drag | null = null;
  let picked: string | null = null;
  let status = "Blank project ready";
  let focusId: string | null = null;
  const history = new CommandHistory();

  function commit(command: Command): void {
    try {
      project = history.apply(project, command);
      status = command.description;
      focusId = selected;
    } catch (error) {
      status = error instanceof CommandRejectedError
        ? error.diagnostics.map((d) => d.message).join(". ")
        : String(error);
    }
    render();
  }

  function drop(placement: Placement): void {
    if (!drag) return;
    if ("template" in drag) {
      const created = createNodeFromTemplate(drag.template);
      commit(createInsertCommand(created, placement));
      selected = created.id;
    } else {
      commit(createMoveCommand(drag.nodeId, placement));
    }
    drag = null;
    render();
  }

  function remove(id: string): void {
    const info = inspectDelete(project, id);
    if (
      info.requiresConfirmation &&
      !confirm(`Delete this node? ${info.descendantIds.length} descendants, ${info.referencedBy.length} references.`)
    ) {
      return;
    }
    commit(createDeleteCommand(id, true));
    selected = project.schema.id;
    render();
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
          <section class="canvas">
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
            <dl>
              <dt>Path</dt><dd>${escapeHtml(idx.pathByNode.get(current.id) || "root")}</dd>
              <dt>Stable ID</dt><dd>${escapeHtml(current.id)}</dd>
            </dl>
          </aside>
        </main>
        <footer role="status" aria-live="polite">
          ${escapeHtml(status)}${picked ? ". Arrows reorder or enter and leave containers. Enter drops. Escape cancels." : ""}
        </footer>
      </div>`;

    bind();
    if (focusId) {
      host.querySelector<HTMLElement>(`[data-node="${focusId}"]`)?.focus();
      focusId = null;
    }
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
        commit(createInsertCommand(created, { kind: "inside", parentId: project.schema.id, index }));
        selected = created.id;
        render();
      }),
    );

    host.querySelector<HTMLElement>("[data-undo]")?.addEventListener("click", () => {
      project = history.undo(project);
      status = "Undo";
      render();
    });
    host.querySelector<HTMLElement>("[data-redo]")?.addEventListener("click", () => {
      project = history.redo(project);
      status = "Redo";
      render();
    });
    host.querySelector<HTMLElement>("[data-new]")?.addEventListener("click", () => {
      project = createBlankProject();
      selected = project.schema.id;
      status = "New blank project";
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
      render();
      return;
    }
    if (event.key === "Escape" && picked) {
      picked = null;
      status = "Move cancelled";
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
      if (target) commit(createMoveCommand(picked, { kind: event.key === "ArrowUp" ? "before" : "after", targetId: target }));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      const previousSibling = siblings[position - 1];
      const container = previousSibling ? idx.nodeById.get(previousSibling) : null;
      if (container?.node === "group") {
        commit(createMoveCommand(picked, { kind: "inside", parentId: container.id, index: container.children.length }));
      }
    } else if (event.key === "ArrowLeft" && parent) {
      const grandparent = idx.parentById.get(parent);
      if (grandparent) {
        event.preventDefault();
        commit(createMoveCommand(picked, { kind: "after", targetId: parent }));
      }
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      picked = null;
      status = "Drop completed";
      render();
    }
  }

  render();
  return () => {
    host.replaceChildren();
  };
}
