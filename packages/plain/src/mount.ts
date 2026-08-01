/**
 * Top-level entry point: given a container element and a flat Dynamic
 * Form Contract field list (the same shape `useMdyDynamicForm` in
 * other adapters' declarative form entry points already
 * consume), builds a real running @modyra/core form and renders real,
 * interactive DOM for every field — no virtual DOM, no template engine,
 * no framework: pure `document.createElement`/`addEventListener`, wired to
 * @modyra/widgets' headless controllers.
 */
import { vanillaReactivity, type MdyDynamicField, type MdyDynamicLayoutChild, type MdyDynamicLayoutNode, type MdyDynamicLayoutSlot, type MdyFieldHandle, type MdyFormSchema, type MdyReactivity, type MdySubmittedValue, type MdyTypedForm } from "@modyra/core";
import { buildForm } from "./schema.js";
import { isValidWidgetId, layoutNodeAttributes, layoutSlotStyle, MDY_ID_DELIMITER, MDY_LAYOUT_CLASSES } from "@modyra/widgets";
import { renderField } from "./fields/index.js";
import { el, setText } from "./dom.js";

export interface MountMdyFormOptions {
  /**
   * Called on submit once the form is valid; return field-level errors to reject, same contract as
   * `form.submit()`.
   *
   * The value is **partial**: a disabled field is not submitted, and any field may be disabled at
   * runtime. Read a key defensively rather than assuming the schema's shape.
   */
  readonly onSubmit?: (
    value: MdySubmittedValue<MdyFormSchema>,
  ) => Promise<import("@modyra/core").MdyFormError[] | void> | import("@modyra/core").MdyFormError[] | void;
  /** Text for the generated submit button. Pass `null` to render no submit button (host drives `handle.form.submit()` itself). */
  readonly submitLabel?: string | null;
  /**
   * Contract v2 `layout`: sections and column rows, nestable. Fields named by the layout
   * render inside it, in layout order; anything the layout does not mention still renders,
   * appended after — a partial layout degrades to "these bits are arranged, the rest follows"
   * rather than silently dropping fields.
   */
  readonly layout?: ReadonlyArray<MdyDynamicLayoutNode>;
}

export interface MdyPlainForm {
  /** The real, running @modyra/core form backing every rendered field. */
  readonly form: MdyTypedForm<MdyFormSchema>;
  /** The reactivity graph shared by the form and every field's widget controller — effects are microtask-batched by default; call `await reactivity.flush()` to settle re-renders deterministically (e.g. in tests, right after dispatching a DOM event). */
  readonly reactivity: MdyReactivity;
  /** Unmounts every field, destroys their controllers/effects, and deactivates the form. */
  dispose(): void;
}

/** Renders a complete form for `fields` into `container`. `container` is cleared first — this function owns everything inside it until `dispose()`. */
/**
 * A field name is an identity, and the typed entry point has to hold that precondition as firmly
 * as the dynamic parser does.
 *
 * Two definitions sharing a name used to collapse silently: the `byName` map kept the second, the
 * `rendered` set stopped the first, and the form came out with one instance where the caller asked
 * for two — a difference visible only by counting. A name carrying the id delimiter is the same
 * failure one level down, in the generated ids rather than the field list.
 */
function assertMountableNames(fields: ReadonlyArray<MdyDynamicField>): void {
  const seen = new Set<string>();
  for (const field of fields) {
    if (!isValidWidgetId(field.name)) {
      throw new Error(
        `mountMdyForm: field name "${field.name}" cannot contain "${MDY_ID_DELIMITER}" — it separates ` +
          `the segments of a generated id, so this name would collide with another field's parts.`,
      );
    }
    if (seen.has(field.name)) {
      throw new Error(`mountMdyForm: duplicate field name "${field.name}" — every field needs its own identity.`);
    }
    seen.add(field.name);
  }
}

export function mountMdyForm(
  container: HTMLElement,
  fields: ReadonlyArray<MdyDynamicField>,
  options: MountMdyFormOptions = {},
): MdyPlainForm {
  assertMountableNames(fields);

  container.replaceChildren();
  container.classList.add("mdy-dynamic-form", "mdy-plain-form");

  const reactivity = vanillaReactivity();
  const form = buildForm(fields, reactivity);
  const fieldHandles = form.f as unknown as Record<string, MdyFieldHandle<never>>;

  const disposers: Array<() => void> = [];
  const byName = new Map(fields.map((f) => [f.name, f]));
  const rendered = new Set<string>();

  const renderOne = (target: HTMLElement, name: string): void => {
    const field = byName.get(name);
    const handle = fieldHandles[name];
    if (!field || !handle || rendered.has(name)) return;
    rendered.add(name);
    disposers.push(renderField(target, field, handle, reactivity));
    // Name the root so a host can find a field's DOM without depending on child order —
    // which stops holding once a layout row nests fields inside it.
    const root = target.lastElementChild;
    if (root instanceof HTMLElement) root.dataset.mdyField = name;
  };

  /** A v3 slot names a field and says where it sits; a bare string is the same slot saying nothing. */
  const isSlot = (child: MdyDynamicLayoutChild): child is MdyDynamicLayoutSlot =>
    typeof child === "object" && "ref" in child;

  /** What a child asks of the column it occupies — a slot and a section answer the same way. */
  const placementOf = (child: MdyDynamicLayoutChild): MdyDynamicLayoutSlot["at"] => {
    if (typeof child === "string") return undefined;
    if (isSlot(child)) return child.at;
    return child.kind === "section" ? child.at : undefined;
  };

  const renderLayoutChild = (target: HTMLElement, child: MdyDynamicLayoutChild): void => {
    if (typeof child === "string") renderOne(target, child);
    else if (isSlot(child)) renderOne(target, child.ref);
    else renderLayoutNode(target, child);
  };

  function renderLayoutNode(target: HTMLElement, node: MdyDynamicLayoutNode): void {
    // Classes and the column count come from `@modyra/widgets`, so a two-column row is the same row
    // whichever adapter drew it and whichever theme is loaded.
    const attributes = layoutNodeAttributes(node);
    if (node.kind === "section") {
      const section = el("fieldset", attributes.className) as HTMLFieldSetElement;
      section.dataset.layoutId = node.id;
      if (node.label) {
        const legend = el("legend", MDY_LAYOUT_CLASSES.sectionLabel);
        setText(legend, node.label);
        section.appendChild(legend);
      }
      for (const child of node.children) renderLayoutChild(section, child);
      target.appendChild(section);
      return;
    }
    const row = el("div", attributes.className);
    row.dataset.layoutId = node.id;
    for (const [property, value] of Object.entries(attributes.style)) row.style.setProperty(property, value);
    for (const column of node.columns) {
      const cell = el("div", MDY_LAYOUT_CLASSES.column);
      // The column is the grid item, so a placement is applied here rather than to anything inside
      // it — `layoutSlotStyle` explains why. A section carries one too, which is how a group in a
      // row is placed; either way the first child with something to say wins.
      const placement = column.map(placementOf).find((at) => at !== undefined);
      if (placement) {
        for (const [property, value] of Object.entries(layoutSlotStyle(placement))) cell.style.setProperty(property, value);
      }
      for (const child of column) renderLayoutChild(cell, child);
      row.appendChild(cell);
    }
    target.appendChild(row);
  }

  // Layout nodes are spliced in at the position of their first member rather than hoisted to the
  // top: a two-column row built from fields 3 and 4 has to stay between fields 2 and 5, and a
  // layout that only arranges part of the form must leave the rest where the author put it.
  const layoutNodes = options.layout ?? [];
  const firstMemberOf = new Map<string, MdyDynamicLayoutNode>();
  const claimed = new Set<string>();
  const collectNames = (child: MdyDynamicLayoutChild, into: string[]): void => {
    if (typeof child === "string") into.push(child);
    else if (isSlot(child)) into.push(child.ref);
    else if (child.kind === "section") child.children.forEach((c) => collectNames(c, into));
    else child.columns.forEach((column) => column.forEach((c) => collectNames(c, into)));
  };
  for (const node of layoutNodes) {
    const names: string[] = [];
    collectNames(node, names);
    const anchor = names.find((name) => byName.has(name) && !claimed.has(name));
    if (anchor === undefined) continue;
    firstMemberOf.set(anchor, node);
    for (const name of names) claimed.add(name);
  }

  for (const f of fields) {
    const node = firstMemberOf.get(f.name);
    if (node) renderLayoutNode(container, node);
    else if (!claimed.has(f.name)) renderOne(container, f.name);
  }

  let submitButton: HTMLButtonElement | null = null;
  if (options.submitLabel !== null) {
    submitButton = el("button") as HTMLButtonElement;
    submitButton.type = "button";
    setText(submitButton, options.submitLabel ?? "Submit");
    submitButton.addEventListener("click", () => {
      void form.submit(async (value) => options.onSubmit?.(value));
    });
    container.appendChild(submitButton);

    const submitEffect = reactivity.effect(() => {
      if (submitButton) submitButton.disabled = !form.state.canSubmit();
    });
    disposers.push(() => submitEffect.destroy());
  }

  function dispose(): void {
    for (const disposeField of disposers) disposeField();
    submitButton?.remove();
    form.deactivate();
    container.replaceChildren();
    container.classList.remove("mdy-dynamic-form", "mdy-plain-form");
  }

  return { form, reactivity, dispose };
}
