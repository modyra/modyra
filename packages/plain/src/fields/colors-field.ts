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
import {
  createColorsFieldController, applySubmissionNames,
  colorPresetsOf,
  MDY_WIDGET_CONTRACTS,
  colorValueEquals,
  defaultWidgetIdFactory,
  keyBindingFor,
  overlayAnchoringFor,
  rowRovingIndex,
  projectFieldShellA11y,
  fieldCanBeInvalid,
  visibleErrorsOf,
  MDY_I18N_MESSAGES_DEFAULT,
  type MdyI18nMessages,
} from "@modyra/widgets";
import { applyPart, el, setErrors, setIcon, setText } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";
import { dismissOnFocusOutside } from "../overlay.js";
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

  /**
   * The value, the text being typed and whether the panel is up, from the contract.
   *
   * Three doors and one value, and the reason this needs a controller is that they do not agree on
   * when a value is a decision: choosing a preset answers the question the panel was opened to ask,
   * typing does not — `#0` is on its way to being a colour, and a field that committed or rejected on
   * every keystroke would take a half-typed value away from the person typing it.
   */
  const colors = createColorsFieldController({
    widgetId,
    handle: handle as unknown as MdyFieldHandle<string>,
    presets,
  }, reactivity);
  const isOpen = (): boolean => colors.state().open;
  const setOpen = (up: boolean): void => { colors.dispatch({ type: up ? "open" : "close" }); };

  const shell = buildFieldShell(f.label, "colors", {}, f.ariaLabel, f.name, f.supportingText);
  // The themes lay this control out from the outside in — `.mdy-colors` *contains* the input
  // wrapper (`.mdy-colors .mdy-input-wrapper` is a flex row with no padding), which is how the
  // contract nests it that way too. Building it the other way round collapses the row to nothing.
  const wrapper = el("div", "mdy-colors") as HTMLDivElement;
  shell.root.insertBefore(wrapper, shell.wrapper);
  wrapper.append(shell.wrapper);

  // A button, not a label wrapping the native input. The contract admits both shapes, and the two
  // are not equivalent from the outside: a label opens the platform's chooser, which makes the most
  // recognisable element on the field do one thing here and another where a renderer built a button.
  // The square opens the panel, and the panel is what leads on to every colour.
  const picker = el("button") as HTMLButtonElement;
  picker.type = "button";
  applyPart(picker, definition.parts.nativePicker);
  // What it opens, asked of the contract, and a name of its own: its only content is a tint, which
  // a screen reader cannot read. The name says what pressing it does and never carries the colour —
  // a name that changes under the fingers is read back over the action just taken.
  applyOpenerPromise(picker, "colors");
  picker.setAttribute("aria-label", messages.selectColorPrefix);
  const preview = el("span") as HTMLSpanElement;
  applyPart(preview, definition.parts.preview);
  const control = el("input") as HTMLInputElement;
  control.type = "color";
  // The native colour input is visually hidden behind the swatch, so it has no visible label of its
  // own and axe reported it as a control with no accessible name. The <label> that wraps it is the
  // picker, whose text is the swatch — nothing a screen reader can read — so the name is given here.
  control.setAttribute("aria-label", f.label ? `${f.label} colour value` : "Colour value");
  applyPart(control, definition.parts.control);
  // The tint inside the button; the native input beside it. A focusable control inside a focusable
  // control is `nested-interactive`, and the input's own styling already places it as a sibling that
  // takes no pointer — the button behind it is what a press reaches.
  picker.append(preview);

  const hexInput = el("input") as HTMLInputElement;
  hexInput.type = "text";
  // The field's label points here: the swatch is a colour input with no readable text, so the hex
  // box is the control a `for` can usefully name.
  hexInput.id = `${widgetId}__hex`;
  hexInput.spellcheck = false;
  hexInput.setAttribute("aria-label", `${f.label ?? "Colour"} — hex value`);
  applyPart(hexInput, definition.parts.hexInput);

  // A drawing, not a command: the square beside it opens the same panel, and one act with two
  // commands costs two names, two keyboard stops and two things for a screen reader to describe.
  //
  // Out of both walks or neither. Removing it from the tab order alone would hide it from someone
  // navigating by keyboard and leave it in place for someone reading with assistive technology,
  // which browses the tree rather than that order — hidden from those who see it, present for those
  // who do not.
  const toggle = el("span") as HTMLSpanElement;
  applyPart(toggle, definition.parts.toggle);
  toggle.setAttribute("aria-hidden", "true");
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
  picker.setAttribute("aria-controls", popup.id);
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
   * The door, after the grid and outside it.
   *
   * A button and never a swatch. A set has a total and a position within it, so a button among the
   * options would announce "thirteen of thirteen" over twelve colours, put a thing of another kind
   * into the arrow walk, and claim a place in a listbox that does not admit it. After the grid is
   * where every menu that has a way out puts it: first the room, then the door.
   *
   * **It is always and only a door.** Pressing it opens the full chooser in every state, without
   * exception, and it never carries the selected mark. The tint it shows is not a value: it is a
   * preview of *where the chooser will open*, which is why it is worth showing at all.
   *
   * That costs something, and the cost is real: somebody who picks a free colour, tries a ready one
   * and changes their mind reopens the chooser rather than pressing back. It is a cost on a rare
   * path, taken in preference to an element that does one thing when empty and another when full —
   * which is a cost on every path, and which nobody can predict from looking at it.
   *
   * Where the current colour *is* shown is the filled square on the field, whose only job that is.
   */
  const customEntry = el("button") as HTMLButtonElement;
  customEntry.type = "button";
  applyPart(customEntry, definition.parts.customEntry);
  /**
   * The mark, drawn always — including when the door carries a colour.
   *
   * Shown only while empty, it would be absent in exactly the state where the door looks most like
   * one of the ready colours, which is where it is needed. It is also the only thing that tells the
   * two apart when someone has asked their system to replace every colour with their own: the tints
   * keep theirs because here the colour *is* the content, and a mark that obeys the palette is then
   * the sole remaining difference.
   */
  const customMark = el("span");
  setIcon(customMark, "PLUS");
  customMark.setAttribute("aria-hidden", "true");
  const customTint = el("span");
  applyPart(customTint, definition.parts.customTint);
  customTint.setAttribute("aria-hidden", "true");
  const customLabel = el("span");
  setText(customLabel, messages.colorCustomEntry);
  // Beside the tint, never inside it. A mark drawn over the fill would have to be legible on yellow
  // and on navy at once, which no fixed colour is; outside it, the mark takes the panel's own
  // foreground and stays readable whatever the door is showing — and where a system palette is
  // imposed it obeys that palette, while the tint, which is the content here, keeps its colour.
  customEntry.append(customTint, customMark, customLabel);
  popup.append(customEntry);

  insertControl(shell, picker);
  insertControl(shell, control);
  insertControl(shell, hexInput);
  // Inside the trailing slot, the way every other kind with a caret builds one. Made the slot
  // itself, it took the slot's own width and sat at the slot's own inset — a caret in the right
  // column with the wrong box, which is a second way of leaving the column. What has to be fixed is
  // the slot's padding, and that is the foundation's business rather than this renderer's.
  const suffix = el("div", "mdy-input-suffix") as HTMLDivElement;
  suffix.append(toggle);
  shell.wrapper.append(suffix);
  wrapper.append(popup);
  container.appendChild(shell.root);


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
  control.addEventListener("change", () => colors.dispatch({ type: "native", value: control.value }));
  hexInput.addEventListener("change", () => colors.dispatch({ type: "text", value: hexInput.value }));
  hexInput.addEventListener("blur", () => handle.markAsTouched());
  toggle.addEventListener("click", () => setOpen(!isOpen()));
  // The square is the field's own opener, not a second way into the platform's chooser. Every
  // renderer of this contract answers a press here the same way, and the route to an arbitrary
  // colour is inside the panel this opens.
  picker.addEventListener("click", () => setOpen(!isOpen()));
  // The platform's chooser, reached from the panel. The hidden native input is what opens it, and
  // clicking it from here rather than moving focus into it keeps the panel where it was: on some
  // platforms the chooser is a separate window, and a panel that closed when focus left would take
  // the door with it and leave nothing to come back to.
  customEntry.addEventListener("click", () => control.click());
  for (const { preset, swatch } of swatches) {
    swatch.addEventListener("click", () => colors.dispatch({ type: "preset", value: preset }));
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
    if (!isOpen()) return false;
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
  picker.addEventListener("keydown", (event) => { moveThroughSwatches(event); });

  // Escape closes and hands focus back, from wherever the user is. This overlay does not take focus
  // when it opens, so listening on the popup alone left the palette impossible to dismiss by
  // keyboard from the control that opened it.
  // Escape cancels and Tab lets go: an overlay whose focus has moved on to the next field is a
  // panel floating over a control the user has already left. Both dismiss, and they differ in where
  // focus lands — Escape hands it back to the opener, Tab leaves it where the key was taking it.
  const onEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") { setOpen(false); picker.focus(); }
    // Tab is already carrying focus somewhere; pulling it back to the opener would trap the user in
    // the control they were leaving.
    else if (event.key === "Tab") setOpen(false);
  };
  popup.addEventListener("keydown", onEscape);
  wrapper.addEventListener("keydown", onEscape);

  const effectRef = reactivity.effect(() => {
    const value = typeof handle.value() === "string" ? (handle.value() as string) : "";
    const panelUp = isOpen();
    if (document.activeElement !== hexInput) hexInput.value = value;
    if (value) control.value = value;
    preview.style.setProperty("background-color", value || "transparent");
    // A closed palette offers nothing. The popup stays — built once, alive as long as the field —
    // and its swatches are buttons: a Tab key walks through them and a screen reader counts them as
    // options in a listbox nobody opened. They go back in when it opens.
    if (panelUp) {
      if (presetList.childElementCount === 0) {
        for (const { swatch } of swatches) presetList.appendChild(swatch);
        // Into the row it has just shown. The keys the contract declares for an open colour field
        // are the row's, and `Tab` dismisses the palette — so a palette that left the keyboard on
        // the toggle was one no keyboard could ever reach the presets in.
        const landing = swatches.find(({ preset }) => colorValueEquals(value || null, preset))?.swatch
          ?? swatches[0]?.swatch;
        queueMicrotask(() => { if (isOpen()) landing?.focus(); });
      }
    } else if (presetList.childElementCount > 0) {
      presetList.replaceChildren();
    }
    for (const { preset, swatch } of swatches) {
      const selected = colorValueEquals(value || null, preset);
      swatch.classList.toggle("mdy-color-swatch--selected", selected);
      swatch.setAttribute("aria-selected", String(selected));
    }
    // A colour the ready ones do not hold is the last one picked by hand, and the door shows it: not
    // as a value, but as where the chooser will open. The name stays put whatever it shows — a name
    // carrying the value would say this is a value, which is the confusion the door exists without,
    // and a name that changes under the fingers is read back over the action just taken.
    const isPreset = presets.some((preset) => colorValueEquals(value || null, preset));
    if (value && !isPreset) customEntry.dataset.mdyTint = value;
    const tint = customEntry.dataset.mdyTint;
    // Transparent rather than a second class: the square's own ground shows through when nothing
    // has been picked by hand, and an opaque tint covers it when something has. One value carries
    // both states, so there is no pair to keep in step.
    customTint.style.setProperty("background-color", tint || "transparent");
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
        // The container is pointed at while it is on the page, not only while it holds a message.
        errorsReserved: visibleErrorsOf(handle).length > 0 || fieldCanBeInvalid({
          required: handle.required?.() ?? false,
          constraints: handle.constraints?.() ?? null,
          disabled: handle.disabled?.() ?? false,
        }),
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
    picker.disabled = handle.disabled();
    picker.setAttribute("aria-expanded", String(panelUp));
    reflectOverlayOpen(popup, panelUp, messages);
    wrapper.classList.toggle("mdy-colors--open", panelUp);
    // The themes place the panel from `--mdy-overlay-*`; the widget policy decides them.
    if (panelUp) queueMicrotask(() => positionOverlay(popup, shell.wrapper, anchoring));
    toggleArrow.classList.toggle("mdy-select__arrow--open", panelUp);
    setErrors(shell.errorList, visibleErrorsOf(handle).map((error) => error.message));
    shell.syncState({
      open: panelUp,
      touched: handle.touched(), disabled: handle.disabled(), readonly: handle.readonly(),
      hasError: visibleErrorsOf(handle).length > 0, filled: Boolean(value), required: handle.required(), constraints: handle.constraints?.() ?? null,
    });
    // The key a native submit reads this control's value under, after the parts are applied: the
    // shared control projection writes `name: null` for a field it was not given a name for, and a
    // part carrying `null` removes the attribute.
    applySubmissionNames(shell.root, "colors", f.name);
  });

  const untrack = trackOverlay(popup, shell.wrapper, () => isOpen(), anchoring);
  const undismiss = dismissOnOutsidePointer([wrapper, popup], () => isOpen(), () => setOpen(false));
  // The other half of how this kind says it is dismissed. A palette left open behind a field
  // somebody has tabbed away from covers the next question and answers to a keyboard that has gone.
  const unfocusout = dismissOnFocusOutside("colors", [wrapper, shell.root, popup],
    () => isOpen(),
    () => setOpen(false),
    { pointer: undismiss, markVisited: () => handle.markAsTouched() });

  return () => {
    undismiss();
    unfocusout();
    untrack();
    effectRef.destroy();
    shell.root.remove();
  };
}
