/**
 * Top-level entry point: given a container element and a flat Dynamic
 * Form Contract field list (the same shape `useMdyDynamicForm` in
 * @modyra/react and `<mdy-dynamic-form>` in @modyra/angular already
 * consume), builds a real running @modyra/core form and renders real,
 * interactive DOM for every field — no virtual DOM, no template engine,
 * no framework: pure `document.createElement`/`addEventListener`, wired to
 * @modyra/widgets' headless controllers.
 */
import { vanillaReactivity, type MdyDynamicField, type MdyDynamicLayoutChild, type MdyDynamicLayoutNode, type MdyFieldHandle, type MdyFormSchema, type MdyFormValue, type MdyReactivity, type MdyTypedForm } from "@modyra/core";
import { buildForm } from "./schema.js";
import { layoutNodeAttributes, MDY_LAYOUT_CLASSES } from "@modyra/widgets";
import { renderField } from "./fields/index.js";
import { el, setText } from "./dom.js";

export interface MountMdyFormOptions {
  /** Called on submit once the form is valid; return field-level errors to reject, same contract as `form.submit()`. */
  readonly onSubmit?: (
    value: MdyFormValue<MdyFormSchema>,
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
export function mountMdyForm(
  container: HTMLElement,
  fields: ReadonlyArray<MdyDynamicField>,
  options: MountMdyFormOptions = {},
): MdyPlainForm {
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

  const renderLayoutChild = (target: HTMLElement, child: MdyDynamicLayoutChild): void => {
    if (typeof child === "string") renderOne(target, child);
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
