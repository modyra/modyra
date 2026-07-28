/**
 * TEMPORARY. Gives `file` and `colors` catalog coverage — a value that round-trips through the
 * widget controller and a shell that carries the canonical classes — but not the anatomy those
 * kinds actually own (file list, preset swatches). Each kind leaves this file as its real renderer
 * lands; the file goes with the last one.
 */
import { vanillaReactivity, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import type { MdyDynamicColorsField, MdyDynamicFileField } from "@modyra/core";
import { createValueWidgetController } from "@modyra/widgets";
import { applyPart, el, setErrors } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";

type CatalogField = MdyDynamicFileField | MdyDynamicColorsField;

export function renderCatalogField(
  container: HTMLElement,
  field: CatalogField,
  handle: MdyFieldHandle<unknown>,
  reactivity: MdyReactivity = vanillaReactivity(),
): () => void {
  const kind = field.kind;
  const controller = createValueWidgetController<unknown>(
    { kind, value: handle.value(), disabled: handle.disabled(), invalid: !handle.valid(), onChange: (value) => handle.set(value) },
    reactivity,
  );
  const shell = buildFieldShell(field.label, kind);

  const control = el("input") as HTMLInputElement;
  control.type = kind === "colors" ? "color" : "file";
  if (kind === "file") {
    control.multiple = Boolean(field.multiple);
    if (field.accept) control.accept = field.accept;
  }
  insertControl(shell, control);
  container.appendChild(shell.root);

  const currentValue = (): unknown => (kind === "file" ? Array.from(control.files ?? []) : control.value);
  control.addEventListener("change", () => controller.dispatch({ type: "input", value: currentValue() }));
  control.addEventListener("blur", () => controller.dispatch({ type: "blur" }));

  const effect = reactivity.effect(() => {
    const view = controller.view();
    applyPart(shell.root, view.root);
    const part = view.parts.control;
    if (part) applyPart(control, part);
    setErrors(shell.errorList, handle.errors().map((error) => error.message));
  });

  return () => { effect.destroy(); controller.destroy(); shell.root.remove(); };
}
