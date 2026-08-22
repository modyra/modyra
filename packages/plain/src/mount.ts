/**
 * Top-level entry point: given a container element and a flat Dynamic
 * Form Contract field list (the same shape `useMdyDynamicForm` in
 * other adapters' declarative form entry points already
 * consume), builds a real running @modyra/core form and renders real,
 * interactive DOM for every field — no virtual DOM, no template engine,
 * no framework: pure `document.createElement`/`addEventListener`, wired to
 * @modyra/widgets' headless controllers.
 */
import type {
  MdyDynamicValidation, MdyDraftOptions } from "@modyra/core";
import { reportIdCollision } from "@modyra/widgets";
import { applyDynamicRules, assertSafeDynamicFieldNames, vanillaReactivity, type MdyDynamicCollection, type MdyDynamicField, type MdyDynamicLayoutChild, type MdyDynamicLayoutNode, type MdyDynamicLayoutSlot, type MdyDynamicRule, type MdyFieldHandle, type MdyFormSchema, type MdyReactivity, type MdySubmittedValue, type MdyTypedForm } from "@modyra/core";
import { buildForm } from "./schema.js";
import { formErrorsOf, isValidWidgetId, layoutNodeAttributes, layoutSlotStyle, MDY_FORM_SHELL_CLASSES, MDY_ID_DELIMITER, MDY_LAYOUT_CLASSES } from "@modyra/widgets";
import { renderField } from "./fields/index.js";
import { el, setText } from "./dom.js";

export interface MountMdyFormOptions {
  /**
   * The collections the document declared, as `parseDynamicForm` reports them.
   *
   * A field name is a path, and a path cannot say whether `lines.0` was an array row or the record
   * key `"0"`. Handed these, the form holds the shape the document declared; without them it holds
   * nested groups, which is what a flat list alone can express.
   */
  readonly collections?: ReadonlyArray<MdyDynamicCollection>;
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
  /**
   * Scopes every id this form generates, so two forms can share a page.
   *
   * A widget id is otherwise the field name alone, and every generated id derives from it — the
   * input's own id, `label[for]`, `aria-describedby`, `aria-errormessage`, the popup, and the radio
   * group's `name`. Two forms built from the same field names therefore mint the same ids, and the
   * second form's relationships silently resolve to the first form's elements. Neither form examined
   * alone looks wrong, which is why only a page holding both can detect it.
   *
   * Unset is the default and leaves every id exactly as it would be without this option.
   */
  readonly idPrefix?: string;
  /**
   * Contract v2 `rules`: what a document says a field's presence or availability depends on.
   *
   * The parse returns them beside `fields` and `layout`, and a form built without them behaves as
   * though the array were empty — a document saying "hide the VAT number unless the customer is a
   * business" produced a form that showed it always, and one saying "disable the tax id for a
   * private customer" produced a form that sent it.
   *
   * `visible`/`hidden` take the field out of play, so its value is not submitted and not validated;
   * `enabled`/`disabled` leave it in the form and stop it being answered.
   */
  readonly rules?: ReadonlyArray<MdyDynamicRule>;
  /**
   * The document's cross-field rules, beside `rules` and for the same reason.
   *
   * `rules` decide whether a field is in play; these decide whether the form is answerable. Left
   * out, a document declaring "start and end must differ" drew a form that never said so.
   */
  readonly validations?: ReadonlyArray<MdyDynamicValidation>;
  /**
   * Keep what the user typed, as `createForm` does — a key, or the whole `MdyDraftOptions`.
   *
   * Passed to the form this mount builds. Without a slot for it, a host asking for a draft was
   * accepted without a word and nothing was ever written: the option is the form's, and this
   * renderer builds the form, so there was nowhere for it to go.
   */
  readonly draft?: string | MdyDraftOptions;
}

/**
 * Joins a prefix to a field name to form a widget id.
 *
 * A single character that neither part may contain, which is what makes two distinct prefixes
 * provably unable to collide: the joiner's first occurrence always ends the prefix, so
 * `p1 + name1 === p2 + name2` forces `p1 === p2`. Were the prefix allowed to contain it,
 * `"a" + "b-c"` and `"a-b" + "c"` would be the same id.
 */
const ID_PREFIX_JOINER = "-";

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
 * as the dynamic parser does. The names themselves are core's rule — it owns what a schema key may
 * be — and are checked here rather than inside `buildForm` so a rejected list leaves the container
 * untouched instead of cleared.
 *
 * The prefix is this function's own: it exists only because a host may mount two forms built from
 * the same names, and nothing below this layer knows it was applied.
 */
function assertMountableNames(fields: ReadonlyArray<MdyDynamicField>, idPrefix: string | undefined): void {
  if (idPrefix !== undefined) {
    if (!isValidWidgetId(idPrefix)) {
      throw new Error(
        `mountMdyForm: idPrefix "${idPrefix}" must be non-empty and cannot contain "${MDY_ID_DELIMITER}" — ` +
          `it separates the segments of a generated id.`,
      );
    }
    if (idPrefix.includes(ID_PREFIX_JOINER)) {
      throw new Error(
        `mountMdyForm: idPrefix "${idPrefix}" cannot contain "${ID_PREFIX_JOINER}" — it joins the prefix to ` +
          `the field name, and a prefix carrying it would let two different prefixes produce the same id.`,
      );
    }
  }

  assertSafeDynamicFieldNames(fields);
}

export function mountMdyForm(
  container: HTMLElement,
  fields: ReadonlyArray<MdyDynamicField>,
  options: MountMdyFormOptions = {},
): MdyPlainForm {
  assertMountableNames(fields, options.idPrefix);

  // The widget id is the identity a field's DOM is built from; the field name stays the data path.
  // They are the same string unless the host scopes this form.
  const widgetIdFor = (name: string): string =>
    options.idPrefix === undefined ? name : `${options.idPrefix}${ID_PREFIX_JOINER}${name}`;

  container.replaceChildren();
  container.classList.add("mdy-dynamic-form", "mdy-plain-form");

  // The form's own refusals, first, before the fields — a summary a person has to scroll past their
  // whole form to find is one they do not read. A `status` rather than a field's error list: it
  // speaks for the form, it appears in answer to something the person did, and it is announced when
  // it arrives. Empty and hidden until there is something to say.
  const formErrors = el("ul", MDY_FORM_SHELL_CLASSES.formErrors) as HTMLUListElement;
  formErrors.setAttribute("role", "status");
  formErrors.hidden = true;
  container.appendChild(formErrors);

  const reactivity = vanillaReactivity();
  const form = buildForm(fields, reactivity, options.collections, {
    draft: options.draft,
    validations: options.validations,
  });
  // Applied to the form rather than to the markup: what a rule decides is whether the field is in
  // play, which is the form's word and reaches the payload as well as the page.
  if (options.rules && options.rules.length > 0) applyDynamicRules(form, options.rules);
  /**
   * The handle a name points at.
   *
   * A name in this list is a path — a flattened document names a nested field `shipping.city` — and
   * the handle tree has the shape the form has, so the name is walked rather than looked up.
   */
  const handleFor = (name: string): MdyFieldHandle<never> | undefined => {
    let node: unknown = form.f;
    const segments = name.split(".");
    for (let index = 0; index < segments.length; index += 1) {
      if (typeof node !== "object" || node === null) return undefined;
      const holder = node as Record<string, unknown> & {
        rows?: () => ReadonlyArray<unknown>;
        cell?: (key: string, field: string) => unknown;
        row?: (key: string) => unknown;
      };
      const segment = segments[index]!;
      // A collection is walked the way it is addressed rather than as an object: an array's rows are
      // a list, a record's are reached by key, and neither answers to `f.lines["0"]`. Without this a
      // document's collection mounted no controls at all — the value was right and the screen empty.
      // The row goes back through this same loop, because a row may hold a collection of its own:
      // `orders.o1.lines.l1.sku` crosses two of them, and each is walked the way it is addressed.
      if (typeof holder.rows === "function" || typeof holder.cell === "function") {
        const rest = segments.slice(index + 1);
        if (typeof holder.cell === "function" && rest.length === 1) {
          return holder.cell(segment, rest[0]!) as MdyFieldHandle<never>;
        }
        const row = typeof holder.rows === "function"
          ? holder.rows()[Number(segment)]
          : holder.row?.(segment);
        if (rest.length === 0) return row as MdyFieldHandle<never>;
        node = row;
        continue;
      }
      node = holder[segment];
    }
    return node as MdyFieldHandle<never> | undefined;
  };

  const disposers: Array<() => void> = [];
  const byName = new Map(fields.map((f) => [f.name, f]));
  const rendered = new Set<string>();

  const renderOne = (target: HTMLElement, name: string): void => {
    const field = byName.get(name);
    const handle = handleFor(name);
    if (!field || !handle || rendered.has(name)) return;
    rendered.add(name);
    disposers.push(renderField(target, field, handle, reactivity, widgetIdFor(name)));
    // Name the root so a host can find a field's DOM without depending on child order —
    // which stops holding once a layout row nests fields inside it.
    const root = target.lastElementChild;
    if (root instanceof HTMLElement) {
      root.dataset.mdyField = name;
      // Two forms built from one document claim one set of ids unless the host prefixes them. The
      // page still works for one of them, which is what makes it worth saying out loud.
      // After the effect that writes the ids: this renderer's parts take theirs from the projection
      // on the first pass, which is a microtask away, so asking now is asking before the field has
      // published anything to collide with.
      queueMicrotask(() => reportIdCollision(root, "Pass a different `idPrefix` when mounting each form."));
    }
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

  // Field-level refusals reach the person through the field that owns them; these are the ones with
  // no field to reach them through — a failed call, a service that is down — and without this the
  // engine held them and the page said nothing.
  const formErrorsEffect = reactivity.effect(() => {
    const shown = formErrorsOf(form.state.lastSubmitErrors());
    formErrors.replaceChildren(...shown.map((error) => {
      const item = el("li", MDY_FORM_SHELL_CLASSES.formErrorItem);
      setText(item, error.message);
      return item;
    }));
    formErrors.hidden = shown.length === 0;
  });
  disposers.push(() => formErrorsEffect.destroy());

  function dispose(): void {
    for (const disposeField of disposers) disposeField();
    submitButton?.remove();
    form.deactivate();
    container.replaceChildren();
    container.classList.remove("mdy-dynamic-form", "mdy-plain-form");
  }

  return { form, reactivity, dispose };
}
