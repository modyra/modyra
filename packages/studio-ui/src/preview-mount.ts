/**
 * The preview's fields, as the real controls.
 *
 * Studio used to hand-write an `<input>`, a `<select>` or a `<textarea>` for every field it
 * previewed. A datepicker previewed as a text box, a slider as a text box, a toggle as a checkbox,
 * a multiselect as a native multi-select — none of them the control the form actually ships. A
 * preview whose controls are not the controls is not a preview; it is a mock-up that happens to be
 * bound to real state.
 *
 * These are the same controls the canvas draws: `renderField` from `@modyra/plain`, given the field
 * descriptor `compileToContract` would emit and the live handle of the form the panel already
 * reports on — so the value, the errors and the pending state are the live ones, and the appearance
 * is the foundation's.
 *
 * The mount is deliberately *not* inside a {@link Region}. The panel repaints inside a reactive
 * effect on every keystroke and `Region.update` rewrites `innerHTML`; mounted controls living there
 * would be destroyed and rebuilt on every character typed, taking the caret and any open popup with
 * them. It is rebuilt only when the structure it draws actually changed — the same rule
 * `syncLiveCanvas` applies to the canvas.
 */
import type { ArrayNode, FieldNode, GroupNode, MdyStudioProject, RecordNode, StudioLayoutNode, StudioSchemaNode } from "@modyra/studio-model";
import { renderField } from "@modyra/plain";
import { MDY_LAYOUT_CLASSES, layoutNodeAttributes, layoutSlotStyle } from "@modyra/widgets";
import type { MdyDynamicField } from "@modyra/studio-contract";
import type { MockServerConfig } from "@modyra/studio-preview";

/** The live form's handle for a dotted path, or null when the form has no such field. */
export type PreviewHandleLookup = (path: string) => Record<string, unknown> | null;

export interface PreviewMountOptions {
  /** Resolves a live handle by dotted path — `getPreviewHandle` bound to the current form. */
  readonly handleFor: PreviewHandleLookup;
  /** The Contract descriptor for a project field at a live path — `dynamicFieldForNode`. */
  readonly fieldFor: (node: FieldNode, path: string) => MdyDynamicField | null;
  /**
   * The preview form's own reactivity graph, so a rendered control observes the live signals.
   *
   * Taken from `renderField`'s own signature rather than imported from `@modyra/core`: studio-ui
   * deliberately has no direct dependency on core (see `studio-contract/src/flatten.ts`).
   */
  readonly reactivity: NonNullable<Parameters<typeof renderField>[3]>;
  /** Current server-mock modes, so a server-validated field's selector shows the mode in force. */
  readonly mockConfig: Record<string, MockServerConfig>;
}

export interface PreviewFieldsMount {
  dispose(): void;
}

/**
 * What the mounted structure is made of.
 *
 * Remounting is only worth doing when this changes: the schema, the arrangement, the number of rows
 * in each repeater, and the mock modes (which the per-field selector reflects). Field *values* are
 * deliberately absent — a mounted control owns its own value, and remounting on every keystroke is
 * exactly what this signature exists to prevent.
 */
export function previewStructureSignature(
  project: MdyStudioProject,
  layout: ReadonlyArray<StudioLayoutNode>,
  handleFor: PreviewHandleLookup,
  mockConfig: Record<string, MockServerConfig>,
): string {
  const lengths: Record<string, number> = {};
  const visit = (node: StudioSchemaNode, path: string): void => {
    if (node.node === "field") return;
    if (node.node === "group") {
      for (const child of node.children) visit(child, path ? `${path}.${child.name}` : child.name);
      return;
    }
    const length = rowCount(handleFor(path));
    lengths[path] = length;
    for (let index = 0; index < length; index += 1) visit(node.item, `${path}.${index}`);
  };
  visit(project.schema, project.schema.node === "group" ? "" : project.schema.name);
  return JSON.stringify({ schema: project.schema, layout, lengths, mockConfig });
}

/** Reading `length()` here is what subscribes the caller's effect to a push or a remove. */
function rowCount(handle: Record<string, unknown> | null): number {
  const length = handle?.length;
  return typeof length === "function" ? Number((length as () => number).call(handle)) || 0 : 0;
}

/** The keys a keyed collection currently has, in the order its handle reports them. */
function rowKeys(handle: Record<string, unknown> | null): readonly string[] {
  const keys = handle?.keys;
  return typeof keys === "function" ? (keys as () => readonly string[]).call(handle) ?? [] : [];
}

/**
 * Renders the project's fields into `container` as real controls, arranged the way the canvas
 * arranges them. Returns a disposer that tears every mounted control down.
 */
export function mountPreviewFields(container: HTMLElement, project: MdyStudioProject, options: PreviewMountOptions): PreviewFieldsMount {
  container.replaceChildren();
  // Preview is a form root like the other two renderers', named the same way. That is what lets the
  // foundation treat it as a layout container, so the arrangement follows the panel's own width.
  container.classList.add("mdy-dynamic-form");
  const disposers: Array<() => void> = [];
  if (project.schema.node !== "group") return { dispose: () => container.replaceChildren() };

  const element = (tag: string, className?: string): HTMLElement => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  };

  const mountField = (target: HTMLElement, node: FieldNode, path: string): void => {
    const handle = options.handleFor(path);
    const field = options.fieldFor(node, path);
    if (!handle || !field) return;
    const host = element("div", "preview-field-host");
    host.dataset.previewNode = path;
    target.append(host);
    disposers.push(renderField(host, field, handle as never, options.reactivity));
    mountMockMode(target, node);
  };

  /** Studio chrome, not the form's: which outcome the server validator's mock will produce. */
  const mountMockMode = (target: HTMLElement, node: FieldNode): void => {
    const validator = node.serverValidator;
    if (!validator) return;
    const config = options.mockConfig[validator.implementationRef];
    const mode = config?.forceNetworkFailure ? "network" : config?.forceError ? "error" : "success";
    const label = element("label", "preview-mock-mode");
    label.append("Server mock");
    const select = document.createElement("select");
    select.dataset.previewMockMode = validator.implementationRef;
    for (const [value, text] of [["success", "Succeeds"], ["error", "Fails"], ["network", "Network failure"]] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      option.selected = value === mode;
      select.append(option);
    }
    label.append(select);
    target.append(label);
  };

  const mountGroup = (target: HTMLElement, node: GroupNode, path: string): void => {
    const section = element("fieldset", MDY_LAYOUT_CLASSES.section);
    const legend = element("legend", MDY_LAYOUT_CLASSES.sectionLabel);
    legend.textContent = node.label || node.name;
    section.append(legend);
    for (const child of node.children) mountNode(section, child, `${path}.${child.name}`);
    target.append(section);
  };

  /**
   * A collection, drawn row by row from the handle rather than from the project.
   *
   * Which rows exist is the running form's answer, not the author's: a positional collection is
   * asked for its length and a keyed one for its keys, and the preview draws what it is told.
   */
  const mountCollection = (target: HTMLElement, node: ArrayNode | RecordNode, path: string): void => {
    const handle = options.handleFor(path);
    const keyed = node.node === "record";
    const rows: readonly string[] = keyed
      ? rowKeys(handle)
      : Array.from({ length: rowCount(handle) }, (_, index) => String(index));
    const wrapper = element("div", "preview-array");
    const label = element("div", "preview-array-label");
    label.textContent = `${node.label || node.name} (${rows.length})`;
    wrapper.append(label);

    for (const rowKey of rows) {
      const rowPath = `${path}.${rowKey}`;
      const row = element("div", "preview-array-row");
      if (keyed) {
        const key = element("span", "preview-array-key");
        key.textContent = rowKey;
        row.append(key);
      }
      if (node.item.node === "group") {
        for (const child of node.item.children) mountNode(row, child, `${rowPath}.${child.name}`);
      } else {
        mountNode(row, node.item, rowPath);
      }
      const remove = element("button") as HTMLButtonElement;
      remove.type = "button";
      remove.textContent = "Remove";
      remove.dataset.previewArrayRemove = path;
      remove.dataset.previewArrayIndex = rowKey;
      row.append(remove);
      wrapper.append(row);
    }

    const push = element("button") as HTMLButtonElement;
    push.type = "button";
    push.textContent = "+ Add row";
    push.dataset.previewArrayPush = path;
    wrapper.append(push);
    target.append(wrapper);
  };

  const mountNode = (target: HTMLElement, node: StudioSchemaNode, path: string): void => {
    if (node.node === "field") mountField(target, node, path);
    else if (node.node === "group") mountGroup(target, node, path);
    else mountCollection(target, node, path);
  };

  mountArrangement(container, project.schema.children, project.presentation.layout ?? [], element, mountNode);

  return {
    dispose: () => {
      for (const off of disposers.reverse()) off();
      container.replaceChildren();
    },
  };
}

/**
 * Places the root's children, honouring the column rows the project's layout declares.
 *
 * The row is emitted at its first member's position and its members are not emitted again — the
 * same splice rule `@modyra/plain` applies, so what you preview is arranged the way what ships is.
 */
function mountArrangement(
  container: HTMLElement,
  rootChildren: readonly StudioSchemaNode[],
  layout: ReadonlyArray<StudioLayoutNode>,
  element: (tag: string, className?: string) => HTMLElement,
  mountNode: (target: HTMLElement, node: StudioSchemaNode, path: string) => void,
): void {
  const columnRows = layout.filter((node): node is StudioLayoutNode & { kind: "columns" } => node.kind === "columns");
  if (!columnRows.length) {
    for (const child of rootChildren) mountNode(container, child, child.name);
    return;
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

  for (const child of rootChildren) {
    const row = rowFor.get(child.id);
    if (row) {
      const grid = element("div", MDY_LAYOUT_CLASSES.columns);
      // The row's own attributes, from the same function the two shipping renderers call. Writing
      // the declared count by hand meant Preview showed one arrangement at every size while the form
      // it previews changed at three — the per-breakpoint counts were never emitted here at all.
      for (const [property, value] of Object.entries(layoutNodeAttributes(row).style)) {
        grid.style.setProperty(property, value);
      }
      for (const column of row.columns) {
        const cell = element("div", MDY_LAYOUT_CLASSES.column);
        // The column is the grid item, so a slot's placement is applied to it — the same reading as
        // `@modyra/plain` and `<mdy-dynamic-form>`. First slot with something to say wins.
        const placed = column.find((slot) => "nodeId" in slot && slot.at !== undefined);
        if (placed && "nodeId" in placed) {
          for (const [property, value] of Object.entries(layoutSlotStyle(placed.at))) {
            cell.style.setProperty(property, value);
          }
        }
        for (const slot of column) {
          const node = "nodeId" in slot ? byId.get(slot.nodeId) : undefined;
          if (node) mountNode(cell, node, node.name);
        }
        grid.append(cell);
      }
      container.append(grid);
      continue;
    }
    if (!claimed.has(child.id)) mountNode(container, child, child.name);
  }
}
