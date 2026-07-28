/**
 * TEMPORARY. Gives `daterange`, `file` and `colors` catalog coverage — a value that round-trips
 * through the widget controller and a shell that carries the canonical classes — but not the
 * anatomy those kinds actually own (calendar popup, file list, preset swatches). Each kind leaves
 * this file as its real renderer lands; the file goes with the last one.
 */
import { vanillaReactivity, type MdyDateRange, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import type { MdyDynamicColorsField, MdyDynamicDaterangeField, MdyDynamicFileField } from "@modyra/core";
import { createValueWidgetController } from "@modyra/widgets";
import { applyPart, el, setErrors } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";

type CatalogField = MdyDynamicDaterangeField | MdyDynamicFileField | MdyDynamicColorsField;

function input(type: string, className?: string): HTMLInputElement {
  const control = el("input", className) as HTMLInputElement;
  control.type = type;
  return control;
}

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

  // A daterange owns two endpoints, so even the placeholder renderer emits both: dispatching a
  // single string here would put a value of the wrong shape into the form.
  const start = input(kind === "daterange" ? "date" : kind === "colors" ? "color" : "file");
  const end = kind === "daterange" ? input("date") : null;
  if (kind === "file") {
    start.multiple = Boolean(field.multiple);
    if (field.accept) start.accept = field.accept;
  }
  insertControl(shell, start);
  if (end) insertControl(shell, end);
  container.appendChild(shell.root);

  const currentValue = (): unknown => {
    if (kind === "file") return Array.from(start.files ?? []);
    if (kind === "daterange") return { start: start.value || null, end: end?.value || null } satisfies MdyDateRange;
    return start.value;
  };
  const onInput = () => controller.dispatch({ type: "input", value: currentValue() });
  const onBlur = () => controller.dispatch({ type: "blur" });
  for (const control of [start, end]) {
    if (!control) continue;
    control.addEventListener("change", onInput);
    control.addEventListener("blur", onBlur);
  }

  const controlPart = kind === "daterange" ? "startControl" : "control";
  const effect = reactivity.effect(() => {
    const view = controller.view();
    applyPart(shell.root, view.root);
    const part = view.parts[controlPart];
    if (part) applyPart(start, part);
    const endPart = view.parts.endControl;
    if (end && endPart) applyPart(end, endPart);
    setErrors(shell.errorList, handle.errors().map((error) => error.message));
  });

  return () => { effect.destroy(); controller.destroy(); shell.root.remove(); };
}
