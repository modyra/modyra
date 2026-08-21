/**
 * Renders the "multiselect" kind via createMultiselectFieldController, in the anatomy the catalogue names: the options are chips in a grid in the field, and
 * the header's search button opens a popup holding the same grid over a filter box.
 *
 * The two grids are the same builder, and which classes a chip carries is `multiselectChipClasses`.
 * Nothing here decides what a chip looks like — that is the point of having a chip primitive: the
 * foundation styles `.mdy-chip` and its variants, and a renderer that spelled a variant itself would
 * be the reason a theme's rule silently stopped applying.
 */
import { observerFor, type MdyFieldHandle, type MdyMultiselectMode, type MdyReactivity, type MdySelectOption } from "@modyra/core";
import type { MdyDynamicOptionsField } from "@modyra/core";
import {
  MDY_WIDGET_CONTRACTS,
  createMultiselectFieldController,
  multiselectChipClasses,
  multiselectOverlayAction,
  overlayAnchoringFor,
  shownErrorsOf,
  type MdyElementLookup,
  MDY_I18N_MESSAGES_DEFAULT,
  type MdyI18nMessages,
} from "@modyra/widgets";
import { applyPart, el, setErrors, setText, setIcon } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";
import { withControls, type MdyMountedField } from "../field-controls.js";
import { runCommands } from "../command-runtime.js";
import { dismissOnOutsidePointer, positionOverlay, releaseOverlayPlacement, reflectOverlayOpen, trackOverlay } from "../overlay.js";

export function renderMultiselectField(
  container: HTMLElement,
  f: MdyDynamicOptionsField,
  handle: MdyFieldHandle<ReadonlyArray<unknown>>,
  reactivity?: MdyReactivity,
  mode: MdyMultiselectMode = "single",
  widgetId: string = f.name,
  /**
   * The words this control shows. The engine has no opinion about them, so they arrive from the
   * widget contract's tables rather than being written here — three renderers each spelling
   * "open the calendar" is three answers to one question.
   */
  messages: MdyI18nMessages = MDY_I18N_MESSAGES_DEFAULT,
): MdyMountedField {
  reactivity = observerFor(handle, reactivity);
  // How this popup attaches is the contract's, not this renderer's.
  const anchoring = overlayAnchoringFor("multiselect");
  const options = f.options as ReadonlyArray<MdySelectOption<unknown>>;
  const keyFor = (option: MdySelectOption<unknown>) => String(option.value);
  const controller = createMultiselectFieldController({ widgetId: widgetId, handle, options, keyFor, mode }, reactivity);

  const parts = MDY_WIDGET_CONTRACTS.multiselect.parts;
  const shell = buildFieldShell(f.label, "multiselect", {}, f.ariaLabel, f.name);

  // ── the field: a header with the search button, and the options as chips ──────────────────
  const control = el("div", parts.inputWrapper.classes.join(" "));

  /**
   * What a person presses to open the popup, and what holds what they chose.
   *
   * A button rather than the field's box: the box carries the field's state classes, and a node
   * with both jobs is a node two rules write to. The chips strip lives inside it, so the strip can
   * scroll within its own bounds while the box around it stays the height the host gives a control.
   */
  const trigger = el("button", parts.trigger.classes.join(" ")) as HTMLButtonElement;
  trigger.type = "button";
  const chipStrip = el("div", parts.chips.classes.join(" "));
  const placeholder = el("span", parts.placeholder.classes.join(" "));
  // The affordance at the trailing edge, as the single-choice sibling has. Decorative: the whole
  // control opens the popup, so this says which way it opens rather than being the way.
  const arrow = el("span", parts.arrow.classes.join(" "));
  arrow.setAttribute("aria-hidden", "true");
  // Waiting on its options: the indicator goes on the control, so the field says it is loading
  // without being opened.
  if (f.loading) {
    const loading = el("span", parts.loading.classes.join(" "));
    loading.setAttribute("role", "status");
    trigger.appendChild(loading);
  }
  trigger.append(chipStrip, placeholder, arrow);
  control.append(trigger);

  // ── popup: the filter box over the same grid ──────────────────────────────────────────────
  const popup = el("div", `${parts.popup.classes.join(" ")} mdy-overlay`) as HTMLDivElement;
  const search = el("input", parts.search.classes.join(" ")) as HTMLInputElement;
  search.type = "search";
  search.placeholder = messages.searchPlaceholder;

  /**
   * One option chip, in whichever grid asked for it.
   *
   * Single mode gives a chip that is either taken or not, with room reserved for its tick; multi
   * mode gives the same chip with a count between two steppers. Both are `multiselectChipClasses`:
   * the mode picks the variant, selection is a state on top of it.
   */
  interface ChipHandle { readonly chip: HTMLElement; readonly count?: HTMLSpanElement }
  function buildChip(option: MdySelectOption<unknown>, key: string): ChipHandle {
    const label = el("span", parts.optionLabel.classes.join(" "));
    setText(label, option.label);
    const classes = multiselectChipClasses({ mode }).join(" ");

    if (mode === "multi") {
      const chip = el("div", classes);
      chip.title = option.label;
      const step = (icon: "MINUS" | "PLUS", intent: "decrement" | "increment", describe: string): HTMLButtonElement => {
        const button = el("button", parts.optionStep.classes.join(" ")) as HTMLButtonElement;
        button.type = "button";
        setIcon(button, icon);
        button.setAttribute("aria-label", `${describe} ${option.label}`);
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          dispatch({ type: intent, optionKey: key });
        });
        return button;
      };
      const count = el("span", parts.optionCount.classes.join(" ")) as HTMLSpanElement;
      chip.append(step("MINUS", "decrement", "Decrease"), label, count, step("PLUS", "increment", "Increase"));
      return { chip, count };
    }

    const chip = el("button", classes) as HTMLButtonElement;
    chip.type = "button";
    chip.title = option.label;
    // Empty: the theme draws the tick for renderers that ship no icon set.
    const check = el("span", parts.optionCheck.classes.join(" "));
    check.setAttribute("aria-hidden", "true");
    chip.append(check, label);
    chip.addEventListener("click", () => dispatch({ type: "toggle", optionKey: key }));
    return { chip };
  }

  /** A grid of option chips: the one in the field, and the one in the popup. Filled by `syncGrids`. */
  function buildGrid(extraClasses: readonly string[]): { grid: HTMLElement; chips: Map<string, ChipHandle> } {
    const grid = el("div", [...parts.options.classes, ...extraClasses].join(" "));
    grid.setAttribute("role", "group");
    return { grid, chips: new Map<string, ChipHandle>() };
  }

  // One grid, in the popup. The closed control shows what was *chosen*, in the chips strip; the
  // options are seen where there is room for them. A second copy in the field made every option
  // reachable in two places and made the control's height follow the option count.
  const overlay = buildGrid([]);
  popup.append(search, overlay.grid);

  /** Every chip standing for an option, in both grids: one option, two elements to keep in step. */
  const optionEls = new Map<string, readonly ChipHandle[]>();

  /** A chip per chosen value, in the order they were chosen, drawn in the closed control. */
  const chosenEls = new Map<string, HTMLElement>();

  /**
   * One chip in the strip: what was chosen, how many of it, and the controls for changing that.
   *
   * A container rather than a button, because it holds buttons. Focusable, because a chip a keyboard
   * cannot reach is a chip only a pointer can act on — and it is what the reordering keys will
   * address. Named as one thing, because a label and a count in two spans are read as one run of
   * text with nothing saying which is which.
   *
   * In counter mode the two steppers are here, so making a three into a two does not send a person
   * back into the popup to find the row among the others — the journey the strip exists to remove.
   */
  function buildValueChip(key: string): HTMLElement {
    const chip = el("div", parts.chip.classes.join(" "));
    chip.tabIndex = 0;
    chip.setAttribute("role", "group");
    const step = (delta: -1 | 1, label: string) => {
      const button = el("button", parts.optionStep.classes.join(" ")) as HTMLButtonElement;
      button.type = "button";
      button.setAttribute("aria-label", label);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        dispatch(delta === 1 ? { type: "increment", optionKey: key } : { type: "decrement", optionKey: key });
      });
      return button;
    };
    if (mode === "multi") chip.appendChild(step(-1, messages.chipDecrementLabel));
    chip.appendChild(el("span", parts.optionLabel.classes.join(" ")));
    chip.appendChild(el("span", parts.optionCount.classes.join(" ")));
    if (mode === "multi") chip.appendChild(step(1, messages.chipIncrementLabel));
    const remove = el("button", parts.chipRemove.classes.join(" ")) as HTMLButtonElement;
    remove.type = "button";
    remove.setAttribute("aria-label", messages.chipRemoveLabel);
    remove.addEventListener("click", (event) => {
      // The strip sits inside the trigger, which opens the popup. Taking a value off is not asking
      // to see the options.
      event.stopPropagation();
      dispatch({ type: "toggle", optionKey: key });
    });
    chip.appendChild(remove);
    return chip;
  }

  /**
   * Brings the strip in line with what is chosen.
   *
   * Driven by `selectedValues` rather than by the option list, and never by the *filtered* list: the
   * order the strip shows is the order the value has, and a strip reading what the search matches
   * would empty itself as somebody typed.
   *
   * **A repeated value is a quantity, not a duplicate.** This kind carries counts — `increment`
   * takes `["a"]` to `["a","a","a"]` — so one chip per distinct value with the count beside it,
   * rather than one chip per entry. Three identical chips would be three things to remove one at a
   * time to undo one decision, and a chip with no count at all answers the same for one of
   * something as for three, which is the reading that loses the capability silently.
   */
  function syncChips(state: { readonly selectedValues: readonly unknown[]; readonly options: readonly MdySelectOption<unknown>[] }): void {
    const tally = new Map<string, { readonly label: string; count: number }>();
    for (const value of state.selectedValues) {
      const option = state.options.find((o) => keyFor(o) === keyFor({ value } as MdySelectOption<unknown>));
      const key = keyFor((option ?? { value, label: String(value) }) as MdySelectOption<unknown>);
      const seen = tally.get(key);
      if (seen) seen.count += 1;
      else tally.set(key, { label: option?.label ?? String(value), count: 1 });
    }
    for (const [key, { label, count }] of tally) {
      let chip = chosenEls.get(key);
      if (!chip) {
        chip = buildValueChip(key);
        chosenEls.set(key, chip);
      }
      setText(chip.querySelector(`.${parts.optionLabel.classes[0]}`) as HTMLElement, label);
      const counter = chip.querySelector(`.${parts.optionCount.classes[0]}`) as HTMLElement;
      setText(counter, count > 1 ? String(count) : "");
      counter.hidden = count <= 1;
      // One name for the whole chip: a label and a count in two spans are read as one run of text,
      // so "A 3" arrives with nothing saying which half is which.
      chip.setAttribute("aria-label", count > 1 ? `${label}, ${count}` : label);
      // Appending an element already in the strip moves it, which keeps the order the value's.
      chipStrip.appendChild(chip);
    }
    for (const key of [...chosenEls.keys()]) {
      if (tally.has(key)) continue;
      chosenEls.get(key)?.remove();
      chosenEls.delete(key);
    }
    placeholder.hidden = tally.size > 0;
  }

  /**
   * Brings both grids in line with the list the controller says it paints.
   *
   * That list is not the one this renderer was handed: a held value the options do not contain is
   * painted as an option of its own, so the person who has to correct it can see it and take it
   * off. Building the chips once would leave such a value invisible and impossible to remove.
   */
  function syncGrids(painted: readonly MdySelectOption<unknown>[]): void {
    const wanted = new Set<string>();
    for (const option of painted) {
      const key = keyFor(option);
      wanted.add(key);
      if (!optionEls.has(key)) {
        const handles = [overlay].map((target) => {
          const handle = buildChip(option, key);
          const wrapper = el("div", parts.optionWrapper.classes.join(" "));
          wrapper.appendChild(handle.chip);
          target.grid.appendChild(wrapper);
          target.chips.set(key, handle);
          return handle;
        });
        optionEls.set(key, handles);
      }
      // Appending an element already in a grid moves it, which keeps the order the controller's.
      for (const target of [overlay]) {
        const chip = target.chips.get(key);
        if (chip?.chip.parentElement) target.grid.appendChild(chip.chip.parentElement);
      }
    }
    for (const key of [...optionEls.keys()]) {
      if (wanted.has(key)) continue;
      for (const target of [overlay]) {
        target.chips.get(key)?.chip.parentElement?.remove();
        target.chips.delete(key);
      }
      optionEls.delete(key);
    }
  }
  syncGrids(controller.state().options);

  insertControl(shell, control);
  container.appendChild(shell.root);
  // Document-level so no scroll container or renderer frame can clip the popup, exactly as the
  // select renderer portals its own listbox.
  document.body.appendChild(popup);

  const lookup: MdyElementLookup = (part, key) => {
    // The search button is what opened the popup, so it is what focus goes back to.
    if (part === "trigger") return trigger;
    if (part === "search") return search;
    if (part === "option" && key) return optionEls.get(key)?.[0]?.chip;
    return undefined;
  };
  function dispatch(intent: Parameters<typeof controller.dispatch>[0]): void {
    runCommands(controller.dispatch(intent), lookup, {
      setOpen: () => undefined, // reflected reactively below, nothing extra to do
      onTouched: () => handle.markAsTouched(),
      onDirty: () => handle.markAsDirty(),
    });
  }

  trigger.addEventListener("click", () => dispatch({ type: "toggleOpen" }));
  search.addEventListener("input", () => dispatch({ type: "search", query: search.value }));
  /**
   * The keyboard policy is `multiselectOverlayAction`, not a handler here.
   *
   * This renderer answered **only Escape**: no opening, no Tab, no navigation. A list opened with a
   * pointer could not be left with the keyboard except by Escape.
   *
   * `move` and `select` are **not** dispatched, and that is a real gap rather than an oversight:
   * this renderer's controller has no active option to move — its intents are `toggle`,
   * `increment` and `decrement` over the chips, with no cursor. Arrow-key navigation needs that
   * cursor first, which is a controller change and its own batch. Opening, dismissing and yielding
   * focus are wired now because they map exactly.
   */
  const onKeydown = (event: KeyboardEvent): void => {
    const state = controller.state();
    const action = multiselectOverlayAction({
      key: event.key,
      open: state.open,
      query: search.value,
      activeKey: null,
    });
    if (!action || action.type === "move" || action.type === "select") return;
    // Tab keeps its native meaning: the list closes and focus carries on to the next control.
    if (event.key !== "Tab") event.preventDefault();
    dispatch(action);
  };
  control.addEventListener("keydown", onKeydown);
  popup.addEventListener("keydown", onKeydown);

  const undismiss = dismissOnOutsidePointer(
    [shell.root, popup],
    () => controller.state().open,
    () => dispatch({ type: "close", restoreFocus: false }),
  );
  const untrack = trackOverlay(popup, shell.wrapper, () => controller.state().open, anchoring);

  const effectRef = reactivity.effect(() => {
    const state = controller.state();
    const view = controller.view();

    applyPart(shell.root, view.root);
    applyPart(shell.label, view.parts.label);
    // The label names the control that holds the value, which is the trigger — the same relation the
    // single-choice sibling has. Left on the wrapper, the label named a box rather than a control.
    shell.label.htmlFor = view.parts.trigger.id ?? "";
    // The projection's `trigger` describes the control *area* — its classes are the input wrapper's
    // — and its opener semantics. Here those live on two elements: the wrapper is the area, the
    // button is what opens the popup. Applying the whole part put `mdy-multiselect` on the button
    // as well, so one class named two elements and the catalogue's singular `inputWrapper` had two
    // candidates.
    // The projection's `trigger` describes what opens the popup, and here that is the button the
    // chips sit in. Its classes come from the part; the wrapper around it keeps the field's box.
    applyPart(trigger, view.parts.trigger);
    syncChips(state);
    setText(placeholder, f.placeholder ?? "");
    applyPart(popup, view.parts.popup);
    applyPart(search, view.parts.search);
    applyPart(overlay.grid, view.parts.group);
    syncGrids(state.options);
    applyPart(shell.description, view.parts.description);
    applyPart(shell.errorList, view.parts.error);
    setErrors(shell.errorList, shownErrorsOf(handle).map((e) => e.message));
    shell.syncState({
      open: state.open,
      touched: state.touched,
      disabled: state.disabled,
      readonly: state.readonly,
      hasError: state.invalid,
      filled: state.selectedKeys.size > 0,
      required: state.required,
    });

    // `hidden` on the popup part is the contract's; this re-states it through `reflectOverlayOpen` so
    // the popover state and the attribute cannot disagree. Positioning only runs while it is showing.
    reflectOverlayOpen(popup, state.open, messages);
    if (state.open) {
      positionOverlay(popup, shell.wrapper, anchoring);
      // Focus goes where the user is about to type, exactly as the select does. A search box that
      // opens without focus asks for a second click before a keystroke does anything, and a
      // keyboard user has no way to reach it at all without tabbing into a popup that just appeared.
      // The microtask is because the popup is shown in this same effect: focusing a `hidden` element
      // silently does nothing.
      queueMicrotask(() => search.focus());
    } else {
      // The next opening decides its own side and height rather than inheriting this one's.
      releaseOverlayPlacement(popup);
      if (search.value) search.value = "";
    }

    for (const option of state.options) {
      const key = keyFor(option);
      const handles = optionEls.get(key);
      if (!handles) continue;
      const count = state.counts.get(key) ?? 0;
      // The classes a chip carries — variant and state — are the contract's answer, applied to both
      // grids so the field and the popup can never disagree about what is taken.
      const classes = multiselectChipClasses({ mode, selected: count > 0 });
      const part = view.parts[key];
      // One grid, in the popup, so it takes the part whole: the `hidden` that filtering writes and
      // the id the opener names both belong to it. There is no second copy to withhold either from.
      for (const handle of handles) {
        if (part) applyPart(handle.chip, part);
        handle.chip.className = classes.join(" ");
        if (handle.count) setText(handle.count, `×${count}`);
      }
    }
  });

  return withControls(
    () => {
    undismiss();
    untrack();
    effectRef.destroy();
    controller.destroy();
    popup.remove();
    shell.root.remove();
    },
    // The list can arrive after the field is on screen; the controller is told rather than the
    // field remounted, which would forget the query it was holding.
    { setOptions: (next) => controller.setOptions(next as never) },
  );
}
