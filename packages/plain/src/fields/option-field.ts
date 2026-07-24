/**
 * Renders radio/segmented kinds via createOptionFieldController — real
 * native <input type=radio> per option (segmented is the same semantics,
 * a CSS-only visual variant, exactly like Angular's own segmented button
 * reusing the radiogroup pattern).
 */
import { vanillaReactivity, type MdyFieldHandle, type MdyReactivity, type MdySelectOption } from "@modyra/core";
import type { MdyDynamicOptionsField } from "@modyra/core";
import { createOptionFieldController } from "@modyra/widgets";
import { applyPart, el, setErrors, setText } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";

export function renderOptionField(
  container: HTMLElement,
  f: MdyDynamicOptionsField,
  handle: MdyFieldHandle<unknown>,
  reactivity: MdyReactivity = vanillaReactivity(),
): () => void {
  const variant = f.kind === "segmented" ? "segmented" : "radio";
  const options = f.options as ReadonlyArray<MdySelectOption<unknown>>;
  const keyFor = (option: MdySelectOption<unknown>) => String(option.value);
  const controller = createOptionFieldController({ widgetId: f.name, handle, options, variant, keyFor }, reactivity);

  const shell = buildFieldShell(f.label);
  const group = el("div") as HTMLDivElement;
  const rows = options.map((option) => {
    const key = keyFor(option);
    const row = el("label", "mdy-plain-option-row");
    const input = el("input") as HTMLInputElement;
    input.type = "radio";
    input.name = f.name;
    input.value = key;
    row.appendChild(input);
    const text = el("span");
    setText(text, option.label);
    row.appendChild(text);
    group.appendChild(row);
    return { key, input };
  });
  insertControl(shell, group);
  container.appendChild(shell.root);

  for (const { key, input } of rows) {
    input.addEventListener("change", () => controller.dispatch({ type: "select", optionKey: key }));
    input.addEventListener("blur", () => controller.dispatch({ type: "blur" }));
  }

  const effectRef = reactivity.effect(() => {
    const state = controller.state();
    const view = controller.view();
    applyPart(shell.label, view.parts.label);
    applyPart(group, view.parts.group);
    applyPart(shell.description, view.parts.description);
    applyPart(shell.errorList, view.parts.error);
    setErrors(shell.errorList, handle.errors().map((e) => e.message));
    for (const { key, input } of rows) {
      const part = view.parts[key];
      if (part) applyPart(input, part);
      const checked = state.selectedKey === key;
      if (input.checked !== checked) input.checked = checked;
    }
  });

  return () => {
    effectRef.destroy();
    controller.destroy();
    shell.root.remove();
  };
}
