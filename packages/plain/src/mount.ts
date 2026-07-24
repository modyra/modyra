/**
 * Top-level entry point: given a container element and a flat Dynamic
 * Form Contract field list (the same shape `useMdyDynamicForm` in
 * @modyra/react and `<mdy-dynamic-form>` in @modyra/angular already
 * consume), builds a real running @modyra/core form and renders real,
 * interactive DOM for every field — no virtual DOM, no template engine,
 * no framework: pure `document.createElement`/`addEventListener`, wired to
 * @modyra/widgets' headless controllers.
 */
import { vanillaReactivity, type MdyDynamicField, type MdyFieldHandle, type MdyFormSchema, type MdyFormValue, type MdyReactivity, type MdyTypedForm } from "@modyra/core";
import { buildForm } from "./schema.js";
import { renderField } from "./fields/index.js";
import { el, setText } from "./dom.js";

export interface MountMdyFormOptions {
  /** Called on submit once the form is valid; return field-level errors to reject, same contract as `form.submit()`. */
  readonly onSubmit?: (
    value: MdyFormValue<MdyFormSchema>,
  ) => Promise<import("@modyra/core").MdyFormError[] | void> | import("@modyra/core").MdyFormError[] | void;
  /** Text for the generated submit button. Pass `null` to render no submit button (host drives `handle.form.submit()` itself). */
  readonly submitLabel?: string | null;
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

  const reactivity = vanillaReactivity();
  const form = buildForm(fields, reactivity);
  const fieldHandles = form.f as unknown as Record<string, MdyFieldHandle<never>>;

  const disposers: Array<() => void> = [];
  for (const f of fields) {
    const handle = fieldHandles[f.name];
    if (!handle) continue;
    disposers.push(renderField(container, f, handle, reactivity));
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
  }

  return { form, reactivity, dispose };
}
