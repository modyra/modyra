/**
 * Renders the "datepicker" kind via createDatepickerFieldController — a
 * trigger button that opens a real calendar grid popup (prev/next month,
 * arrow-key navigation via the shared calendarKeyboardTarget the
 * controller already wires up).
 */
import { vanillaReactivity, type MdyFieldHandle, type MdyReactivity } from "@modyra/core";
import type { MdyDynamicDateField } from "@modyra/core";
import { createDatepickerFieldController, type MdyElementLookup } from "@modyra/widgets";
import { applyPart, el, setErrors, setText } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";
import { runCommands } from "../command-runtime.js";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function renderDatepickerField(
  container: HTMLElement,
  f: MdyDynamicDateField,
  handle: MdyFieldHandle<string | null>,
  reactivity: MdyReactivity = vanillaReactivity(),
  options: { readonly minDate?: string | null; readonly maxDate?: string | null; readonly firstDayOfWeek?: number } = {},
): () => void {
  const controller = createDatepickerFieldController({ widgetId: f.name, handle, ...options }, reactivity);

  const shell = buildFieldShell(f.label);
  const trigger = el("button") as HTMLButtonElement;
  trigger.type = "button";
  const popup = el("div") as HTMLDivElement;
  const header = el("div") as HTMLDivElement;
  const prevButton = el("button") as HTMLButtonElement;
  prevButton.type = "button";
  setText(prevButton, "‹");
  prevButton.setAttribute("aria-label", "Previous month");
  const monthLabel = el("span");
  const nextButton = el("button") as HTMLButtonElement;
  nextButton.type = "button";
  setText(nextButton, "›");
  nextButton.setAttribute("aria-label", "Next month");
  header.append(prevButton, monthLabel, nextButton);
  const grid = el("div") as HTMLDivElement;
  popup.append(header, grid);

  const wrapper = el("div", "mdy-plain-datepicker");
  wrapper.append(trigger, popup);
  insertControl(shell, wrapper);
  container.appendChild(shell.root);

  const cellEls = new Map<string, HTMLButtonElement>();
  let renderedYear: number | null = null;
  let renderedMonth: number | null = null;

  const lookup: MdyElementLookup = (part) => (part === "trigger" ? trigger : undefined);
  function dispatch(intent: Parameters<typeof controller.dispatch>[0]): void {
    const commands = controller.dispatch(intent);
    runCommands(commands, lookup, {
      setOpen: () => undefined,
      onTouched: () => handle.markAsTouched(),
      onDirty: () => handle.markAsDirty(),
    });
  }

  trigger.addEventListener("click", () => dispatch(controller.state().open ? { type: "close", restoreFocus: false } : { type: "open" }));
  trigger.addEventListener("blur", () => dispatch({ type: "blur" }));
  prevButton.addEventListener("click", () => dispatch({ type: "navigate-month", delta: -1 }));
  nextButton.addEventListener("click", () => dispatch({ type: "navigate-month", delta: 1 }));
  grid.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", "Enter", " ", "Escape"].includes(event.key)) {
      event.preventDefault();
      dispatch({ type: "keydown", key: event.key, shiftKey: event.shiftKey });
    }
  });

  const effectRef = reactivity.effect(() => {
    const state = controller.state();
    const view = controller.view();
    applyPart(shell.label, view.parts.label);
    applyPart(trigger, view.parts.trigger);
    applyPart(grid, view.parts.grid);
    applyPart(shell.description, view.parts.description);
    applyPart(shell.errorList, view.parts.error);
    setErrors(shell.errorList, handle.errors().map((e) => e.message));

    setText(trigger, state.selectedDate ?? f.placeholder ?? "Select a date");
    popup.hidden = !state.open;
    setText(monthLabel, `${MONTH_NAMES[state.viewMonth - 1]} ${state.viewYear}`);

    if (renderedYear !== state.viewYear || renderedMonth !== state.viewMonth) {
      grid.replaceChildren();
      cellEls.clear();
      for (const cell of state.cells) {
        const button = el("button") as HTMLButtonElement;
        button.type = "button";
        setText(button, String(cell.day));
        button.addEventListener("click", () => dispatch({ type: "select-date", iso: cell.iso }));
        grid.appendChild(button);
        cellEls.set(cell.iso, button);
      }
      renderedYear = state.viewYear;
      renderedMonth = state.viewMonth;
    }
    for (const cell of state.cells) {
      const button = cellEls.get(cell.iso);
      if (!button) continue;
      const part = view.parts[cell.iso];
      if (part) applyPart(button, part);
      button.disabled = cell.disabled;
      if (cell.focused && state.open && document.activeElement !== button) button.focus();
    }
  });

  return () => {
    effectRef.destroy();
    controller.destroy();
    shell.root.remove();
  };
}
