/**
 * Renders the "multiselect" kind via createMultiselectFieldController, in the anatomy the catalogue names: the options are chips in a grid in the field, and
 * the header's search button opens a popup holding the same grid over a filter box.
 *
 * The two grids are the same builder, and which classes a chip carries is `multiselectChipClasses`.
 * Nothing here decides what a chip looks like — that is the point of having a chip primitive: the
 * foundation styles `.mdy-chip` and its variants, and a renderer that spelled a variant itself would
 * be the reason a theme's rule silently stopped applying.
 */
import { vanillaReactivity, type MdyFieldHandle, type MdyReactivity, type MdySelectOption } from "@modyra/core";
import type { MdyDynamicOptionsField } from "@modyra/core";
import { MDY_WIDGET_CONTRACTS, multiselectOverlayAction, createMultiselectFieldController, multiselectChipClasses, overlayAnchoringFor, type MdyElementLookup } from "@modyra/widgets";
import { applyPart, el, setErrors, setText } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";
import { runCommands } from "../command-runtime.js";
import { dismissOnOutsidePointer, positionOverlay, releaseOverlayPlacement, setOverlayOpen, trackOverlay } from "../overlay.js";

export function renderMultiselectField(
  container: HTMLElement,
  f: MdyDynamicOptionsField,
  handle: MdyFieldHandle<ReadonlyArray<unknown>>,
  reactivity: MdyReactivity = vanillaReactivity(),
  mode: "single" | "multi" = "single",
): () => void {
  // How this popup attaches is the contract's, not this renderer's.
  const anchoring = overlayAnchoringFor("multiselect");
  const options = f.options as ReadonlyArray<MdySelectOption<unknown>>;
  const keyFor = (option: MdySelectOption<unknown>) => String(option.value);
  const controller = createMultiselectFieldController({ widgetId: f.name, handle, options, keyFor, mode }, reactivity);

  const parts = MDY_WIDGET_CONTRACTS.multiselect.parts;
  const shell = buildFieldShell(f.label, "multiselect");

  // ── the field: a header with the search button, and the options as chips ──────────────────
  const control = el("div", parts.inputWrapper.classes.join(" "));
  const header = el("div", parts.header.classes.join(" "));
  const searchButton = el("button", parts.searchButton.classes.join(" ")) as HTMLButtonElement;
  searchButton.type = "button";
  searchButton.setAttribute("aria-label", "Search the options");
  setText(searchButton, "⌕");
  // Waiting on its options: the indicator goes on the search button, which is the control here, so
  // the field says it is loading without being opened.
  if (f.loading) {
    const loading = el("span", parts.loading.classes.join(" "));
    loading.setAttribute("role", "status");
    setText(searchButton, "");
    searchButton.appendChild(loading);
  }
  header.appendChild(searchButton);
  control.appendChild(header);

  // ── popup: the filter box over the same grid ──────────────────────────────────────────────
  const popup = el("div", `${parts.popup.classes.join(" ")} mdy-overlay`) as HTMLDivElement;
  const search = el("input", parts.search.classes.join(" ")) as HTMLInputElement;
  search.type = "search";
  search.placeholder = "Filter…";

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
      const step = (sign: "−" | "+", intent: "decrement" | "increment", describe: string): HTMLButtonElement => {
        const button = el("button", parts.optionStep.classes.join(" ")) as HTMLButtonElement;
        button.type = "button";
        setText(button, sign);
        button.setAttribute("aria-label", `${describe} ${option.label}`);
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          dispatch({ type: intent, optionKey: key });
        });
        return button;
      };
      const count = el("span", parts.optionCount.classes.join(" ")) as HTMLSpanElement;
      chip.append(step("−", "decrement", "Decrease"), label, count, step("+", "increment", "Increase"));
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

  /** A grid of option chips: the one in the field, and the one in the popup. */
  function buildGrid(extraClasses: readonly string[]): { grid: HTMLElement; chips: Map<string, ChipHandle> } {
    const grid = el("div", [...parts.options.classes, ...extraClasses].join(" "));
    grid.setAttribute("role", "group");
    const chips = new Map<string, ChipHandle>();
    for (const option of options) {
      const key = keyFor(option);
      const handle = buildChip(option, key);
      const wrapper = el("div", parts.optionWrapper.classes.join(" "));
      wrapper.appendChild(handle.chip);
      grid.appendChild(wrapper);
      chips.set(key, handle);
    }
    return { grid, chips };
  }

  const field = buildGrid([]);
  // The popup's grid carries the overlay class on top of the shared one, as the contract declares.
  const overlay = buildGrid(parts.listbox.classes.filter((cls) => !parts.options.classes.includes(cls)));
  popup.append(search, overlay.grid);

  /** Every chip standing for an option, in both grids: one option, two elements to keep in step. */
  const optionEls = new Map<string, readonly ChipHandle[]>(
    options.map((option) => {
      const key = keyFor(option);
      return [key, [field.chips.get(key)!, overlay.chips.get(key)!]];
    }),
  );

  insertControl(shell, control);
  // The grid sits directly after the control and before the supporting text, which is the order the
  // contract declares — appending it to the root would put the options below the error line.
  shell.wrapper.after(field.grid);
  container.appendChild(shell.root);
  // Document-level so no scroll container or renderer frame can clip the popup, exactly as the
  // select renderer portals its own listbox.
  document.body.appendChild(popup);

  const lookup: MdyElementLookup = (part, key) => {
    // The search button is what opened the popup, so it is what focus goes back to.
    if (part === "trigger") return searchButton;
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

  searchButton.addEventListener("click", () => dispatch({ type: "toggleOpen" }));
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
    // The projection's `trigger` describes the control *area* — its classes are the input wrapper's
    // — and its opener semantics. Here those live on two elements: the wrapper is the area, the
    // button is what opens the popup. Applying the whole part put `mdy-multiselect` on the button
    // as well, so one class named two elements and the catalogue's singular `inputWrapper` had two
    // candidates.
    applyPart(searchButton, { ...view.parts.trigger, classes: [] });
    applyPart(popup, view.parts.popup);
    applyPart(search, view.parts.search);
    applyPart(overlay.grid, view.parts.group);
    applyPart(shell.description, view.parts.description);
    applyPart(shell.errorList, view.parts.error);
    setErrors(shell.errorList, handle.errors().map((e) => e.message));
    shell.syncState({
      touched: state.touched,
      disabled: state.disabled,
      hasError: state.invalid,
      filled: state.selectedKeys.size > 0,
      required: state.required,
    });

    // `hidden` on the popup part is the contract's; this re-states it through `setOverlayOpen` so
    // the popover state and the attribute cannot disagree. Positioning only runs while it is showing.
    setOverlayOpen(popup, state.open);
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

    for (const option of options) {
      const key = keyFor(option);
      const handles = optionEls.get(key);
      if (!handles) continue;
      const count = state.counts.get(key) ?? 0;
      // The classes a chip carries — variant and state — are the contract's answer, applied to both
      // grids so the field and the popup can never disagree about what is taken.
      const classes = multiselectChipClasses({ mode, selected: count > 0 });
      const part = view.parts[key];
      for (const [index, handle] of handles.entries()) {
        // The part carries `hidden` when the query filters the option out, and an `id`. Only the
        // popup's grid filters — the field shows every option, which is what makes it a picker
        // rather than a list — and only one of the two grids can own the id.
        //
        // Taking nothing at all for the field grid was too blunt: everything else the part says is
        // true of both chips, so a disabled multiselect left two operable buttons behind. The field
        // grid now takes the part with the id and the filtering dropped.
        if (part && index === 1) applyPart(handle.chip, part);
        else if (part) {
          const { id: _ownedByThePopup, ...shared } = part;
          applyPart(handle.chip, { ...shared, attributes: { ...part.attributes, hidden: false } });
        }
        handle.chip.className = classes.join(" ");
        if (handle.count) setText(handle.count, `×${count}`);
      }
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
