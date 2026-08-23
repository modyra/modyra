/**
 * Renders text/textarea/email/password/number/slider kinds — all of these
 * map to the same headless createTextFieldController from @modyra/widgets
 * (per this session's own finding while designing the datepicker/timepicker
 * controllers: "slider" is structurally just a numeric field with
 * <input type=range> markup, not a distinct controller).
 */
import { observerFor, type MdyFieldHandle, type MdyReactivity, MDY_VALUE_CONTRACTS } from "@modyra/core";
import type { MdyDynamicNumberField, MdyDynamicTextField } from "@modyra/core";
import {
  MDY_CSS_PROPERTIES,
  MDY_I18N_MESSAGES_DEFAULT,
  MDY_WIDGET_CONTRACTS,
  blocksValueChange,
  keepKeyboardInPlay,
  type MdyI18nMessages,
  type MdyPartContract,
  createTextFieldController,
  narrowConstraints,
  sliderTrack,
  visibleErrorsOf,
  sliderFillRatio,
} from "@modyra/widgets";
import { applyPart, el, setErrors, setIcon, setText } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";

/**
 * The native control each kind is drawn with.
 *
 * `number` and `slider` are this renderer's own choice of element for a numeric kind; the rest come
 * from the contract, which is where a kind's control type is declared. A private map is how a
 * password ends up rendered in clear text by one adapter and concealed by another.
 */
const NATIVE_INPUT_TYPE: Record<string, string> = {
  number: "number",
  slider: "range",
};

/** What the contract says this kind's control is, or what this renderer draws for it. */
function nativeInputType(kind: string): string {
  const declared = (MDY_WIDGET_CONTRACTS as Record<string, { controlType?: string } | undefined>)[kind];
  return declared?.controlType ?? NATIVE_INPUT_TYPE[kind] ?? "text";
}

export function renderTextField(
  container: HTMLElement,
  f: MdyDynamicTextField | MdyDynamicNumberField,
  handle: MdyFieldHandle<string | number>,
  reactivity?: MdyReactivity,
  widgetId: string = f.name,
  messages: MdyI18nMessages = MDY_I18N_MESSAGES_DEFAULT,
): () => void {
  reactivity = observerFor(handle, reactivity);
  const isTextarea = f.kind === "textarea";
  // Which kinds hold a number is the value contract's answer, not a list repeated here: a renderer
  // that decides it again is a renderer that can disagree with the engine about what it stores.
  const isNumeric = MDY_VALUE_CONTRACTS[f.kind].shape === "number";

  // What this control asks for on top of the field's rules. The projection composes the two and
  // puts the attributes on the control part, so nothing here places them on the element.
  const ranged = f.kind === "number" || f.kind === "slider" ? f : null;
  const narrowing = ranged
    ? { min: ranged.min ?? null, max: ranged.max ?? null, step: ranged.step ?? null }
    : undefined;

  /** What the description will hold, so the control does not name it while it is empty. */
  const describedText = (): string =>
    [f.supportingText ?? "", shell.description.textContent ?? ""].join("").trim();

  const controller = createTextFieldController<string | number | null>(
    {
      widgetId: widgetId,
      handle,
      describes: () => describedText() !== "",
      inputType: isTextarea ? undefined : nativeInputType(f.kind),
      kind: f.kind,
      constraints: () => narrowing ?? {},
    },
    reactivity,
  );

  const shell = buildFieldShell(f.label, f.kind, { prefix: f.prefix, suffix: f.suffix }, f.ariaLabel, f.name, f.supportingText);
  const input = (isTextarea ? el("textarea") : el("input")) as HTMLInputElement | HTMLTextAreaElement;
  if (f.placeholder) input.placeholder = f.placeholder;
  // A slider is not a bare input: the contract gives it a container and a displayed value, and
  // the themes lay both out. Every class here comes from the catalog, none from this file.
  const slider = f.kind === "slider" ? MDY_WIDGET_CONTRACTS.slider : null;
  // The same range the attributes carry, so the painted fill and the handle agree about where the
  // track starts and ends. A slider must span something to be drawn at all, so where neither the
  // config nor the field's rules say, it is what a bare `<input type="range">` assumes.
  const offered = () => narrowConstraints(handle.constraints(), narrowing);
  // The track the contract draws, which spans what the field holds where nothing declared a bound —
  // both renderers used to default to 0–100 here and put the thumb at 100 for a value of 150.
  const track = () => sliderTrack(offered(), typeof handle.value() === "number" ? handle.value() as number : null);
  // Read inside the effect, not once here: the track spans what the field holds, so a value
  // arriving from a draft or a server moves it.
  const sliderMin = () => (f.kind === "slider" ? track().min : 0);
  const sliderMax = () => (f.kind === "slider" ? track().max : 100);
  let sliderValue: HTMLSpanElement | null = null;
  /** The two steppers, held so the effect can take them out of play with the field. */
  const spinButtons: HTMLButtonElement[] = [];
  if (slider) {
    const track = el("div") as HTMLDivElement;
    applyPart(track, slider.parts.track);
    sliderValue = el("span") as HTMLSpanElement;
    applyPart(sliderValue, slider.parts.value);
    input.className = slider.parts.control.classes.join(" ");
    track.append(input, sliderValue);
    insertControl(shell, track);
  } else if (f.kind === "number") {
    /**
     * The two controls a number field is declared to have.
     *
     * The catalogue names `increment` and `decrement` at the trailing edge of this kind and no
     * renderer here built them, so a promise a theme styles and an audit counts was kept by the
     * platform's own spinner or by nothing, depending on the browser. They step through the same
     * intent typing does, so a stepped value meets the field's rules on the way in.
     */
    const number = MDY_WIDGET_CONTRACTS.number;
    const spinner = el("span", "mdy-number-spinner");
    const step = (direction: 1 | -1, part: MdyPartContract, label: string): HTMLButtonElement => {
      const button = el("button", part.classes.join(" ")) as HTMLButtonElement;
      button.type = "button";
      // Out of the tab order: the box itself takes the arrows, and a keyboard user reaching two more
      // stops per number field pays for an affordance the pointer needed.
      button.tabIndex = -1;
      button.setAttribute("aria-label", label);
      setIcon(button, direction === 1 ? "SPIN_UP" : "SPIN_DOWN");
      button.addEventListener("click", () => {
        if (blocksValueChange(controller.state().interactivity)) return;
        const rules = offered();
        const by = typeof rules.step === "number" && rules.step > 0 ? rules.step : 1;
        const from = numberIn(input) ?? 0;
        const next = from + by * direction;
        const min = typeof rules.min === "number" ? rules.min : -Infinity;
        const max = typeof rules.max === "number" ? rules.max : Infinity;
        controller.dispatch({ type: "input", value: Math.min(max, Math.max(min, next)) });
      });
      return button;
    };
    spinButtons.push(
      step(1, number.parts.increment, messages.increase),
      step(-1, number.parts.decrement, messages.decrease),
    );
    spinner.append(input, ...spinButtons);
    insertControl(shell, spinner);
  } else {
    insertControl(shell, input);
  }
  container.appendChild(shell.root);

  /**
   * The number in the box, or nothing.
   *
   * Read from the text rather than from `valueAsNumber`: the property is unimplemented in some DOM
   * implementations this renderer is asked to run in, and there it answers `NaN` for a box that
   * plainly holds a number — turning every typed digit into an empty field.
   */
  const numberIn = (element: HTMLInputElement | HTMLTextAreaElement): number | null => {
    const text = element.value.trim();
    if (text === "") return null;
    const parsed = Number(text);
    return Number.isNaN(parsed) ? null : parsed;
  };

  input.addEventListener("input", () => {
    const raw = input.value;
    // `Number("")` is `0`, and `MDY_VALUE_CONTRACTS.number` says a numeric field is nullable: empty
    // is a value it can hold and the one it starts from. Read through `Number`, clearing the box
    // supplied a quantity nobody typed — shown in the field and carried to the wire, where a
    // quantity is an order line of zero, a price is free and a discount is all of it.
    //
    // Empty is nothing, text that is not a number is nothing, and a number is itself — never a value
    // the person did not write.
    controller.dispatch({
      type: "input",
      value: isNumeric ? numberIn(input) : raw,
    });
  });
  input.addEventListener("focus", () => controller.dispatch({ type: "focus" }));
  input.addEventListener("blur", () => controller.dispatch({ type: "blur" }));

  const effectRef = reactivity.effect(() => {
    const state = controller.state();
    // Out of play with the field: a stepper that still answers beside a disabled box is disabled in
    // appearance only, and the platform's own spinner disappears with the control it belongs to.
    for (const button of spinButtons) button.disabled = blocksValueChange(state.interactivity);
    const view = controller.view();
    applyPart(shell.label, view.parts.label);
    // Before the part takes the control out of play: disabling a focused element blurs it, and by
    // then there is nothing left to say where the keyboard was.
    if (state.disabled) keepKeyboardInPlay(input, shell.root.parentElement);
    applyPart(input, view.parts.input);
    if (sliderValue) {
      setText(sliderValue, String(state.value ?? ""));
      // On the control, not the track: the gradient is composed on the element that carries the
      // property, or it freezes at the fallback (modyra.css:266-269).
      input.style.setProperty(
        MDY_CSS_PROPERTIES.control.sliderFill,
        String(sliderFillRatio(state.value, sliderMin(), sliderMax())),
      );
      // The attributes carry the same track, so the drawn fill and what the control accepts agree.
      input.setAttribute("min", String(sliderMin()));
      input.setAttribute("max", String(sliderMax()));
      const step = track().step;
      if (step === null) input.removeAttribute("step");
      else input.setAttribute("step", String(step));
    }
    applyPart(shell.description, view.parts.description);
    applyPart(shell.errorList, view.parts.error);
    setErrors(shell.errorList, visibleErrorsOf(handle, f.kind).map((e) => e.message));
    // The themes style these state classes, the contract's own base element toggles.
    shell.syncState({
      touched: handle.touched(),
      disabled: handle.disabled(),
      // The same question the control answers with `aria-invalid`, so the two cannot disagree: the
      // error list appears once the field is touched, and whether the field *is* wrong does not wait
      // for that. A control marked wrong beside a label that says nothing is the field telling two
      // different stories about itself.
      hasError: visibleErrorsOf(handle).length > 0,
      filled: Boolean(handle.value()),
      required: handle.required(),
    });
    const stringValue = state.value === undefined || state.value === null ? "" : String(state.value);
    if (input.value !== stringValue) input.value = stringValue;
  });

  return () => {
    effectRef.destroy();
    controller.destroy();
    shell.root.remove();
  };
}
