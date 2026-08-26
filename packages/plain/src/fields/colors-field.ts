/**
 * Renders the "colors" kind: a native colour input behind a preview swatch, a hex field beside it,
 * and a preset palette in a popup.
 *
 * What counts as a colour, and whether picking one should close the popup, is
 * `colorValueTransition` in `@modyra/widgets` — this renderer asks and obeys.
 */
import { applyOpenerPromise } from "../opener-promise.js";
import { observerFor, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import type { MdyDynamicColorsField } from "@modyra/core";
import { applySubmissionNames,
  colorPresetsOf,
  MDY_WIDGET_CONTRACTS,
  colorValueEquals,
  colorValueTransition,
  defaultWidgetIdFactory,
  keyBindingFor,
  overlayAnchoringFor,
  rowRovingIndex,
  projectFieldShellA11y,
  visibleErrorsOf,
  type MdyColorValueIntent,
  MDY_I18N_MESSAGES_DEFAULT,
  type MdyI18nMessages,
} from "@modyra/widgets";
import { applyPart, el, setErrors, setIcon, setText } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";
import { dismissOnOutsidePointer, positionOverlay, reflectOverlayOpen, trackOverlay } from "../overlay.js";



export function renderColorsField(
  container: HTMLElement,
  f: MdyDynamicColorsField,
  handle: MdyFieldHandle<unknown>,
  reactivity?: MdyReactivity,
  widgetId: string = f.name,
  /**
   * The words this control shows. The engine has no opinion about them, so they arrive from the
   * widget contract's tables rather than being written here — three renderers each spelling
   * "open the calendar" is three answers to one question.
   */
  messages: MdyI18nMessages = MDY_I18N_MESSAGES_DEFAULT,
): () => void {
  reactivity = observerFor(handle, reactivity);
  // How this popup attaches is the contract's, not this renderer's.
  const anchoring = overlayAnchoringFor("colors");
  const definition = MDY_WIDGET_CONTRACTS.colors;
  const palette = colorPresetsOf(f.presets);
  const presets = palette.map((entry) => entry.value);
  const open = reactivity.signal(false);

  const shell = buildFieldShell(f.label, "colors", {}, f.ariaLabel, f.name, f.supportingText);
  // The themes lay this control out from the outside in — `.mdy-colors` *contains* the input
  // wrapper (`.mdy-colors .mdy-input-wrapper` is a flex row with no padding), which is how the
  // contract nests it that way too. Building it the other way round collapses the row to nothing.
  const wrapper = el("div", "mdy-colors mdy-plain-colors") as HTMLDivElement;
  shell.root.insertBefore(wrapper, shell.wrapper);
  wrapper.append(shell.wrapper);

  const picker = el("label") as HTMLLabelElement;
  applyPart(picker, definition.parts.nativePicker);
  const preview = el("span") as HTMLSpanElement;
  applyPart(preview, definition.parts.preview);
  const control = el("input") as HTMLInputElement;
  control.type = "color";
  // The native colour input is visually hidden behind the swatch, so it has no visible label of its
  // own and axe reported it as a control with no accessible name. The <label> that wraps it is the
  // picker, whose text is the swatch — nothing a screen reader can read — so the name is given here.
  control.setAttribute("aria-label", f.label ? `${f.label} colour value` : "Colour value");
  applyPart(control, definition.parts.control);
  picker.append(preview, control);

  const hexInput = el("input") as HTMLInputElement;
  hexInput.type = "text";
  // The field's label points here: the swatch is a colour input with no readable text, so the hex
  // box is the control a `for` can usefully name.
  hexInput.id = `${widgetId}__hex`;
  hexInput.spellcheck = false;
  hexInput.setAttribute("aria-label", `${f.label ?? "Colour"} — hex value`);
  applyPart(hexInput, definition.parts.hexInput);

  const toggle = el("button") as HTMLButtonElement;
  toggle.type = "button";
  applyPart(toggle, definition.parts.toggle);
  // Asked of the contract rather than written here — see the same call in the daterange field.
  applyOpenerPromise(toggle, "colors");
  toggle.setAttribute("aria-label", messages.selectColorPrefix);
  // The themes draw the caret on `.mdy-select__arrow`, which is where the contract nests it
  // inside this toggle — an empty button would have no size at all.
  const toggleArrow = el("span", "mdy-select__arrow");
  setIcon(toggleArrow, "CHEVRON_DOWN");
  toggleArrow.setAttribute("aria-hidden", "true");
  toggle.append(toggleArrow);

  // `mdy-overlay` is the portal variant of the shared container: positioned from the
  // `--mdy-overlay-*` properties `positionOverlay` writes, exactly as the select's popup is.
  const popup = el("div", "mdy-overlay") as HTMLDivElement;
  // Same relation the select has always declared: the toggle says it opens a listbox and whether
  // it is showing, so it has to say which one.
  popup.id = defaultWidgetIdFactory.part(widgetId, "popup");
  toggle.setAttribute("aria-controls", popup.id);
  applyPart(popup, definition.parts.popup);
  const presetList = el("div") as HTMLDivElement;
  applyPart(presetList, definition.parts.presets);
  presetList.setAttribute("role", "listbox");
  // A listbox with no name is announced as an unlabelled container, and the user has to guess what
  // they have landed in.
  presetList.setAttribute("aria-label", messages.colorPresetsHeader);
  popup.append(presetList);

  const swatch = (label: string): HTMLButtonElement => {
    const one = el("button") as HTMLButtonElement;
    one.type = "button";
    applyPart(one, definition.parts.swatch);
    one.setAttribute("role", "option");
    one.setAttribute("aria-label", label);
    presetList.appendChild(one);
    return one;
  };

  const swatches = palette.map(({ value, label }) => {
    const one = swatch(label);
    one.style.setProperty("background-color", value);
    return { preset: value, swatch: one };
  });

  /**
   * The colour picked by hand, as a swatch of exactly the same kind as the twelve.
   *
   * Selectable and re-selectable: a person who tries a preset and changes their mind returns to
   * their own colour without going back through the chooser, which is the behaviour a colour picker
   * exists for. It is drawn only once there is one — a set is what it holds.
   *
   * Its name is poor and honest: nobody has named `#4361EE`, so this is the one value in the panel
   * that cannot be described to somebody who cannot see it. An approximated colour name would be
   * worse than the hexadecimal, because it would claim a meaning it does not have.
   */
  const custom = swatch("");
  custom.hidden = true;

  /**
   * The door, after the grid and outside it.
   *
   * A button and never a swatch. A set has a total and a position within it, so a button among the
   * options would announce "thirteen of thirteen" over twelve colours, put a thing of another kind
   * into the arrow walk, and claim a place in a listbox that does not admit it. After the grid is
   * where every menu that has a way out puts it: first the room, then the door.
   *
   * It never carries a tint and never carries the selected mark, because it is not a value.
   */
  const customEntry = el("button") as HTMLButtonElement;
  customEntry.type = "button";
  applyPart(customEntry, definition.parts.customEntry);
  setText(customEntry, messages.colorCustomEntry);
  popup.append(customEntry);

  insertControl(shell, picker);
  insertControl(shell, hexInput);
  const suffix = el("div", "mdy-input-suffix") as HTMLDivElement;
  suffix.append(toggle);
  shell.wrapper.append(suffix);
  wrapper.append(popup);
  container.appendChild(shell.root);

  function commit(intent: MdyColorValueIntent): void {
    const transition = colorValueTransition(intent);
    if (transition.value === undefined) return;
    handle.set(transition.value);
    handle.markAsDirty();
    if (transition.touched) handle.markAsTouched();
    // The policy decides this, not the renderer: choosing a preset answers the question the popup
    // was opened to ask, typing a hex value does not.
    if (transition.close) open.set(false);
  }

  /**
   * The platform's chooser reports the choice, not the dragging.
   *
   * A colour control fires `input` at every step of a drag through the platform's chooser and
   * `change` when the person settles. Taking the value on `input` records colours nobody chose, and
   * abandoning the chooser leaves whichever one the pointer was passing over — a field that keeps a
   * choice the person walked away from.
   *
   * There is nothing to restore afterwards because nothing was taken: the page follows the value the
   * person settled on, and the colour they are dragging past is shown by the chooser itself, which
   * is where they are looking. ADR 0158.
   */
  control.addEventListener("change", () => commit({ type: "native", value: control.value }));
  hexInput.addEventListener("change", () => commit({ type: "text", value: hexInput.value }));
  hexInput.addEventListener("blur", () => handle.markAsTouched());
  toggle.addEventListener("click", () => open.set(!open()));
  // The platform's chooser, reached from the panel. The hidden native input is what opens it, and
  // clicking it from here rather than moving focus into it keeps the panel where it was: on some
  // platforms the chooser is a separate window, and a panel that closed when focus left would take
  // the door with it and leave nothing to come back to.
  customEntry.addEventListener("click", () => control.click());
  custom.addEventListener("click", () => {
    const tint = custom.dataset.mdyTint;
    if (tint) commit({ type: "preset", value: tint });
  });
  for (const { preset, swatch } of swatches) {
    swatch.addEventListener("click", () => commit({ type: "preset", value: preset }));
  }
  /**
   * Walking the swatches, which are a listbox and answer like one.
   *
   * The row is real buttons, so the reading position is the focus itself — one stop moves with the
   * arrows rather than a Tab per colour. The keys and the direction are the catalogue's: a row runs
   * in the writing direction, and a renderer reading `ArrowLeft` as "back" would be wrong in a
   * right-to-left document.
   */
  const moveThroughSwatches = (event: KeyboardEvent): boolean => {
    if (!open()) return false;
    const binding = keyBindingFor("colors", event.key, true);
    if (!binding || binding.intent !== "move") return false;
    const order = swatches.map(({ swatch }) => swatch);
    const to = rowRovingIndex(event.key, order.indexOf(document.activeElement as HTMLButtonElement), order.length, binding.by);
    if (to === null) return false;
    event.preventDefault();
    order[to]?.focus();
    return true;
  };
  presetList.addEventListener("keydown", (event) => { moveThroughSwatches(event); });
  toggle.addEventListener("keydown", (event) => { moveThroughSwatches(event); });

  // Escape closes and hands focus back, from wherever the user is. This overlay does not take focus
  // when it opens, so listening on the popup alone left the palette impossible to dismiss by
  // keyboard from the control that opened it.
  // Escape cancels and Tab lets go: an overlay whose focus has moved on to the next field is a
  // panel floating over a control the user has already left. Both dismiss, and they differ in where
  // focus lands — Escape hands it back to the opener, Tab leaves it where the key was taking it.
  const onEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") { open.set(false); toggle.focus(); }
    // Tab is already carrying focus somewhere; pulling it back to the opener would trap the user in
    // the control they were leaving.
    else if (event.key === "Tab") open.set(false);
  };
  popup.addEventListener("keydown", onEscape);
  wrapper.addEventListener("keydown", onEscape);

  const effectRef = reactivity.effect(() => {
    const value = typeof handle.value() === "string" ? (handle.value() as string) : "";
    const isOpen = open();
    if (document.activeElement !== hexInput) hexInput.value = value;
    if (value) control.value = value;
    preview.style.setProperty("background-color", value || "transparent");
    // A closed palette offers nothing. The popup stays — built once, alive as long as the field —
    // and its swatches are buttons: a Tab key walks through them and a screen reader counts them as
    // options in a listbox nobody opened. They go back in when it opens.
    if (isOpen) {
      if (presetList.childElementCount === 0) {
        for (const { swatch } of swatches) presetList.appendChild(swatch);
        // Last among the options, because it is the newest of them and because a set a person walks
        // should not renumber itself when they pick a colour.
        presetList.appendChild(custom);
        // Into the row it has just shown. The keys the contract declares for an open colour field
        // are the row's, and `Tab` dismisses the palette — so a palette that left the keyboard on
        // the toggle was one no keyboard could ever reach the presets in.
        const landing = swatches.find(({ preset }) => colorValueEquals(value || null, preset))?.swatch
          ?? swatches[0]?.swatch;
        queueMicrotask(() => { if (open()) landing?.focus(); });
      }
    } else if (presetList.childElementCount > 0) {
      presetList.replaceChildren();
    }
    for (const { preset, swatch } of swatches) {
      const selected = colorValueEquals(value || null, preset);
      swatch.classList.toggle("mdy-color-swatch--selected", selected);
      swatch.setAttribute("aria-selected", String(selected));
    }
    // A colour the presets do not hold is the one picked by hand, so the panel keeps it: the tint
    // stays after a preset is tried, and going back to it is one press instead of the whole chooser
    // again. Two colours are then lit in the sense that both are on the page — one carries the
    // selected mark and the other is merely present, which eleven of twelve already are.
    const isPreset = presets.some((preset) => colorValueEquals(value || null, preset));
    if (value && !isPreset) custom.dataset.mdyTint = value;
    const tint = custom.dataset.mdyTint;
    custom.hidden = !tint;
    if (tint) {
      custom.style.setProperty("background-color", tint);
      custom.setAttribute("aria-label", messages.colorCustomValue.replace("{value}", tint));
      const selected = colorValueEquals(value || null, tint);
      custom.classList.toggle("mdy-color-swatch--selected", selected);
      custom.setAttribute("aria-selected", String(selected));
    }
    // The state-driven half of the contract. `definition.parts` is static — classes and shape — so
    // on its own it never said the colour was invalid, required, disabled or described by its
    // errors. Merged into the static part rather than applied after it, because a second
    // `applyPart` on the same element recomputes classes from the base it captured first.
    const a11y = projectFieldShellA11y(
      { disabled: handle.disabled(), required: handle.required() },
      handle.errors(),
      {
        widgetId: widgetId,
        controlId: hexInput.id,
        // What is shown, not what is wrong. This renderer projects the shell itself rather than
        // through the controller's view, and passed the errors already filtered — so the shell had
        // no way to tell "there are none" from "the person is not being told yet", and marked the
        // control wrong over a rule nobody had answered.
        errorsVisible: visibleErrorsOf(handle).length > 0,
      },
    );
    applyPart(shell.label, a11y.label);
    applyPart(shell.description, a11y.description);
    applyPart(shell.errorList, a11y.error);
    // The hex field is the one a user types into, so it is the control the state is about. The
    // native swatch keeps its own name and follows the same state.
    for (const [element, part] of [
      [hexInput, definition.parts.hexInput],
      [control, definition.parts.control],
    ] as const) {
      applyPart(element, { ...part, attributes: { ...part.attributes, ...a11y.control.attributes } });
    }
    control.disabled = handle.disabled();
    hexInput.disabled = handle.disabled();
    // The element the state is about: the swatch beside it is a picker with no readable text.
    hexInput.readOnly = handle.readonly();
    hexInput.setAttribute("aria-readonly", String(handle.readonly()));
    toggle.disabled = handle.disabled();
    toggle.setAttribute("aria-expanded", String(isOpen));
    reflectOverlayOpen(popup, isOpen, messages);
    wrapper.classList.toggle("mdy-colors--open", isOpen);
    // The themes place the panel from `--mdy-overlay-*`; the widget policy decides them.
    if (isOpen) queueMicrotask(() => positionOverlay(popup, shell.wrapper, anchoring));
    toggleArrow.classList.toggle("mdy-select__arrow--open", isOpen);
    setErrors(shell.errorList, visibleErrorsOf(handle).map((error) => error.message));
    shell.syncState({
      open: isOpen,
      touched: handle.touched(), disabled: handle.disabled(), readonly: handle.readonly(),
      hasError: visibleErrorsOf(handle).length > 0, filled: Boolean(value), required: handle.required(),
    });
    // The key a native submit reads this control's value under, after the parts are applied: the
    // shared control projection writes `name: null` for a field it was not given a name for, and a
    // part carrying `null` removes the attribute.
    applySubmissionNames(shell.root, "colors", f.name);
  });

  const untrack = trackOverlay(popup, shell.wrapper, () => open(), anchoring);
  const undismiss = dismissOnOutsidePointer([wrapper, popup], () => open(), () => open.set(false));

  return () => {
    undismiss();
    untrack();
    effectRef.destroy();
    shell.root.remove();
  };
}
