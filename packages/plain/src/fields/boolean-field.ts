/**
 * Renders checkbox/toggle kinds via createBooleanFieldController.
 */
import { vanillaReactivity, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import type { MdyDynamicBooleanField } from "@modyra/core";
import { createBooleanFieldController } from "@modyra/widgets";
import { applyPart, el, setErrors } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";

export function renderBooleanField(
  container: HTMLElement,
  f: MdyDynamicBooleanField,
  handle: MdyFieldHandle<boolean>,
  reactivity: MdyReactivity = vanillaReactivity(),
): () => void {
  const variant = f.kind === "toggle" ? "switch" : "checkbox";
  const controller = createBooleanFieldController({ widgetId: f.name, handle, variant }, reactivity);

  const shell = buildFieldShell(f.label);
  const input = el("input") as HTMLInputElement;
  input.type = "checkbox";
  insertControl(shell, input);
  container.appendChild(shell.root);

  input.addEventListener("change", () => controller.dispatch({ type: input.checked ? "check" : "uncheck" }));
  input.addEventListener("blur", () => controller.dispatch({ type: "blur" }));

  const effectRef = reactivity.effect(() => {
    const state = controller.state();
    const view = controller.view();
    applyPart(shell.label, view.parts.label);
    applyPart(input, view.parts.input);
    applyPart(shell.description, view.parts.description);
    applyPart(shell.errorList, view.parts.error);
    setErrors(shell.errorList, handle.errors().map((e) => e.message));
    // The "checked" content attribute (set by applyPart above) only sets the initial
    // state; the live IDL property is what the browser actually renders/toggles after
    // the first user interaction, so it needs setting explicitly, same reasoning as
    // text-field.ts's separate `input.value` sync.
    if (input.checked !== state.checked) input.checked = state.checked;
  });

  return () => {
    effectRef.destroy();
    controller.destroy();
    shell.root.remove();
  };
}
