/**
 * Renders the "select" kind as a real combobox (text trigger + listbox
 * overlay), via createSelectController — the one controller in
 * @modyra/widgets that takes plain snapshot values + an onChange callback
 * instead of a handle directly (see select-controller.ts), so this
 * renderer owns the handle<->controller sync itself (mirrors how
 * packages/lit's select-field.ts does the same thing).
 */
import { vanillaReactivity, type MdyFieldHandle, type MdyReactivity, type MdySelectOption } from "@modyra/core";
import type { MdyDynamicOptionsField } from "@modyra/core";
import { MDY_WIDGET_CONTRACTS, createTypeahead, isTypeaheadCharacter, selectKeyboardAction, typeaheadMatch, createSelectController, fieldShellPartIds, overlayAnchoringFor, type MdyElementLookup } from "@modyra/widgets";
import { applyPart, el, setErrors, setText, setIcon } from "../dom.js";
import { buildFieldShell, insertControl, errorsToShow } from "../field-shell.js";
import { runCommands } from "../command-runtime.js";
import { dismissOnOutsidePointer, positionOverlay, releaseOverlayPlacement, setOverlayOpen, trackOverlay } from "../overlay.js";

export function renderSelectField(
  container: HTMLElement,
  f: MdyDynamicOptionsField,
  handle: MdyFieldHandle<unknown>,
  reactivity: MdyReactivity = vanillaReactivity(),
  widgetId: string = f.name,
): () => void {
  // How this popup attaches is the contract's, not this renderer's.
  const anchoring = overlayAnchoringFor("select");
  const options = f.options as ReadonlyArray<MdySelectOption<unknown>>;
  // The two interaction models the contract declares: a listbox that jumps as you type, or a
  // combobox that filters. Unset is a listbox, which is what a select without a stated opinion is.
  const searchable = (f as { readonly searchable?: boolean }).searchable === true;
  const typeahead = createTypeahead();
  const keyFor = (option: MdySelectOption<unknown>) => String(option.value);

  const controller = createSelectController<unknown>(
    {
      widgetId: widgetId,
      options,
      keyFor,
      value: handle.value(),
      disabled: handle.disabled(),
      invalid: !handle.valid(),
      onChange: (value) => {
        handle.set(value);
        handle.markAsDirty();
      },
    },
    reactivity,
  );

  const parts = MDY_WIDGET_CONTRACTS.select.parts;
  const shell = buildFieldShell(f.label, "select", {}, f.ariaLabel);
  // The trigger displays the committed value; filtering happens in the field at the top of the
  // popup, which is the canonical select anatomy — typing over the display would hide it.
  const trigger = el("button") as HTMLButtonElement;
  trigger.type = "button";
  const valueText = el("span", parts.value.classes.join(" ")) as HTMLSpanElement;
  // The placeholder is its own contract part, not a modifier class on the value: they are two
  // pieces of text with different meanings, and a theme styles them separately.
  const placeholderText = el("span", parts.placeholder.classes.join(" ")) as HTMLSpanElement;
  setText(placeholderText, f.placeholder ?? "Select…");
  // The panel is the `__dropdown` (positioning, frame, shadow); the scroller inside it is the
  // `__list`, and the filter field is its first row — same three parts the contract names.
  const popup = el("div", parts.popup.classes.join(" ")) as HTMLDivElement;
  const search = el("input", parts.search.classes.join(" ")) as HTMLInputElement;
  search.type = "text";
  search.autocomplete = "off";
  search.placeholder = "Search…";
  const listbox = el("ul", parts.listbox.classes.join(" ")) as HTMLUListElement;
  // A filter box only where the field asked for one: drawn unconditionally, a five-option select got
  // a search nobody wanted and focus landed in it rather than on the list.
  popup.append(...(searchable ? [search] : []), listbox);
  const optionEls = new Map<string, HTMLLIElement>();
  /**
   * Brings the list on screen in line with the list the controller says it paints.
   *
   * That list is not fixed: the declared options can be replaced, and a held value the options do
   * not contain is painted as an option of its own so the user can see it and replace it. Building
   * the `<li>`s once would leave both of those invisible.
   */
  function syncOptions(painted: readonly MdySelectOption<unknown>[]): void {
    const wanted = new Set<string>();
    for (const option of painted) {
      const key = keyFor(option);
      wanted.add(key);
      let li = optionEls.get(key);
      if (!li) {
        li = el("li", parts.option.classes.join(" ")) as HTMLLIElement;
        optionEls.set(key, li);
      }
      setText(li, option.label);
      // Appending an element already in the list moves it, which is what keeps the order the
      // controller's rather than the order elements happened to be created in.
      listbox.appendChild(li);
    }
    for (const [key, li] of [...optionEls]) {
      if (wanted.has(key)) continue;
      li.remove();
      optionEls.delete(key);
    }
  }
  syncOptions(controller.state().options);

  // `mdy-select` is what the themes anchor the dropdown against (position: relative).
  const wrapper = el("div", "mdy-select");
  const arrow = el("span", parts.arrow.classes.join(" "));
  setIcon(arrow, "CHEVRON_DOWN");
  arrow.setAttribute("aria-hidden", "true");
  trigger.append(valueText, placeholderText, arrow);
  // Waiting on its options: the indicator sits on the control, where it is visible without opening
  // the list it is waiting for. It replaces the arrow, which has nothing to point at yet.
  if (f.loading) {
    const loading = el("span", parts.loading.classes.join(" "));
    loading.setAttribute("role", "status");
    arrow.replaceWith(loading);
  }
  wrapper.append(trigger);
  insertControl(shell, wrapper);
  container.appendChild(shell.root);

  // The popup is a document-level overlay so scroll containers and renderer frames cannot clip
  // it. `mdy-overlay` is the shared primitive: the foundation positions it from the
  // `--mdy-overlay-*` properties `positionOverlay` writes, so placement is one decision, not one
  // per renderer. Widgets remains responsible for ARIA, keyboard navigation and selection state.
  popup.classList.add("mdy-overlay");
  document.body.appendChild(popup);

  const untrack = trackOverlay(popup, shell.wrapper, () => controller.state().open, anchoring);

  // select-controller's view has no "label"/"description"/"error" parts (only
  // trigger/listbox/options), unlike every other controller here — wire the
  // static bits by hand; the trigger id is stable regardless of state.
  shell.label.htmlFor = controller.view().parts.trigger.id ?? "";
  // The select controller's view has no description/error parts, so the shell's own canonical
  // classes are all these two carry; only the live region needs adding.
  // `role="alert"` on a <ul> is what axe's aria-allowed-role objects to: alert is not a role a list
  // may take, and applying it discards the list semantics without gaining a live region that
  // announces reliably. `aria-live="assertive"` gets the interruption without the role conflict,
  // and the element stays a list.
  shell.errorList.setAttribute("aria-live", "assertive");
  // The ids the trigger names. Every other kind gets these from the shell projection; this one
  // builds its trigger from the select projection, so the two ends of the relation have to be given
  // the same names explicitly or `aria-describedby` points at nothing.
  const shellIds = fieldShellPartIds(widgetId);
  shell.description.id = shellIds.descriptionId;
  shell.errorList.id = shellIds.errorId;

  const lookup: MdyElementLookup = (part, key) => {
    if (part === "trigger") return trigger;
    if (part === "option" && key) return optionEls.get(key);
    return undefined;
  };
  function dispatch(intent: Parameters<typeof controller.dispatch>[0]): void {
    const commands = controller.dispatch(intent);
    runCommands(commands, lookup, {
      setOpen: () => undefined, // reflected reactively below, nothing extra to do
      onTouched: () => handle.markAsTouched(),
      onDirty: () => handle.markAsDirty(),
    });
  }

  trigger.addEventListener("click", () => dispatch(controller.state().open ? { type: "close", restoreFocus: true } : { type: "open", source: "pointer" }));
  // Blur means "focus left the widget", not "focus left this element": opening moves focus into
  // the search field, and treating that as a blur closes the popup as soon as it opens.
  //
  // `dismissOnFocusOutside` is what closes it, and it never outranks a pointer. A drag that began
  // inside the popup moves focus out of it on the way, and closing there would reinstate — through
  // the focus path — exactly the dismissal `dismissOnOutsidePointer` refuses. `touched` still marks:
  // the user has been here either way.
  const onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget as Node | null;
    if (next !== null && typeof next.nodeType === "number" && (wrapper.contains(next) || popup.contains(next))) return;
    if (!MDY_WIDGET_CONTRACTS.select.capabilities.dismissOnFocusOutside) return;
    if (undismiss.interactionFromInside()) {
      handle.markAsTouched();
      return;
    }
    dispatch({ type: "blur" });
  };
  trigger.addEventListener("focusout", onFocusOut);
  popup.addEventListener("focusout", onFocusOut);
  search.addEventListener("input", () => dispatch({ type: "search", query: search.value }));
  /**
   * The keyboard policy is `selectKeyboardAction`, not a switch here.
   *
   * This renderer had its own, and it disagreed with the contract in ways only a user would notice:
   * `ArrowDown` on a closed list advanced an active option nobody could see instead of opening it,
   * and `Tab` left the list hanging open over the next field. A key handler per renderer is three
   * keyboards that happen to agree on the easy keys.
   */
  const onKeydown = (event: KeyboardEvent): void => {
    const state = controller.state();
    // A listbox jumps rather than filters. Handled before the keyboard policy, which has no rule for
    // a printable character and would otherwise let it fall through to nothing.
    if (!searchable && state.open && isTypeaheadCharacter(event.key, event)) {
      const match = typeaheadMatch(controller.state().options, typeahead.push(event.key));
      if (match) {
        event.preventDefault();
        dispatch({ type: "activate", optionKey: keyFor(match) });
      }
      return;
    }
    const action = selectKeyboardAction({
      key: event.key,
      open: state.open,
      searchFocused: event.target === search,
      activeKey: state.activeKey,
      createAvailable: false,
    });
    if (!action) return;
    // Tab must keep its native meaning — the list closes and focus carries on to the next control.
    if (event.key !== "Tab") event.preventDefault();
    // The intent records *how* the list was opened, which the action does not carry: it answers
    // what to do, and this answers who asked. `create` is not offered by this renderer — it has no
    // "add this option" affordance — so the contract never returns it here.
    if (action.type === "create") return;
    dispatch(action.type === "open" ? { type: "open", source: "keyboard" } : action);
  };
  trigger.addEventListener("keydown", onKeydown);
  search.addEventListener("keydown", onKeydown);
  for (const [key, li] of optionEls) {
    li.addEventListener("mousedown", (event) => event.preventDefault()); // keep focus on trigger
    li.addEventListener("click", () => dispatch({ type: "select", optionKey: key }));
  }

  const undismiss = dismissOnOutsidePointer(
    [wrapper, popup],
    () => controller.state().open,
    () => dispatch({ type: "close", restoreFocus: false }),
  );

  const effectRef = reactivity.effect(() => {
    controller.setValue(handle.value());
    controller.setDisabled(handle.disabled());
    controller.setInvalid(!handle.valid());
    // The trigger describes itself by whichever of the two is on screen, and this renderer is what
    // decides that: the error list appears once the field is touched and has something to say.
    const errorsShown = handle.touched() && errorsToShow(handle).length > 0;
    controller.setDescribedBy({ errorsVisible: errorsShown, descriptionVisible: !errorsShown });

    // The shell's own state, which every other kind here reflects and this one did not: the themes
    // key the touched and error treatments off the renderer root and the wrapper.
    shell.syncState({
      touched: handle.touched(),
      disabled: handle.disabled(),
      hasError: errorsToShow(handle).length > 0,
      filled: handle.value() !== null && handle.value() !== undefined,
      required: handle.required(),
    });

    const state = controller.state();
    const view = controller.view();
    applyPart(trigger, view.parts.trigger);
    applyPart(search, view.parts.search);
    applyPart(listbox, view.parts.listbox);
    setErrors(shell.errorList, errorsToShow(handle).map((e) => e.message));
    syncOptions(state.options);

    setOverlayOpen(popup, state.open);
    // The chevron points down when closed and up when open — the stylesheet has always carried the
    // rotation, and the select was the one overlay kind that never asked for it.
    arrow.classList.toggle("mdy-select__arrow--open", state.open);
    if (state.open) {
      positionOverlay(popup, shell.wrapper, anchoring);
      // A combobox takes focus into its input; a listbox keeps it on the trigger and drives the list
      // with `aria-activedescendant`, which this renderer already projects.
      //
      // "Keeps" has to be made true rather than assumed: not every engine focuses a button when it
      // is clicked, so a list opened by pointer could leave focus on the document and every
      // subsequent keystroke went nowhere. Focusing here costs nothing where focus is already there.
      queueMicrotask(() => (searchable ? search : trigger).focus());
    } else {
      // The next opening decides its own side and height rather than inheriting this one's.
      releaseOverlayPlacement(popup);
      if (search.value) search.value = "";
    }
    // The trigger always shows the committed value: nothing the user types can hide it.
    const selected = state.options.find((o) => keyFor(o) === state.selectedKey);
    setText(valueText, selected?.label ?? "");
    valueText.hidden = !selected;
    placeholderText.hidden = Boolean(selected);
    for (const [key, li] of optionEls) {
      // The part carries `hidden` when the query filters the option out — no second filter here.
      const part = view.parts[key];
      if (part) applyPart(li, part);
    }
  });

  return () => {
    undismiss();
    untrack();
    effectRef.destroy();
    controller.destroy();
    popup.remove();
    shell.root.remove();
  };
}
