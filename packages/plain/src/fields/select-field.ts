/**
 * Renders the "select" kind as a real combobox (text trigger + listbox
 * overlay), via createSelectController — the one controller in
 * @modyra/widgets that takes plain snapshot values + an onChange callback
 * instead of a handle directly (see select-controller.ts), so this
 * renderer owns the handle<->controller sync itself (mirrors how
 * packages/lit's select-field.ts does the same thing).
 */
import { vanillaReactivity, type MdyFieldHandle, type MdyReactivity, type MdySelectOption } from "@modyra/core";
import type { MdyDynamicOptionsField } from "@modyra/core";
import { createSelectController, type MdyElementLookup } from "@modyra/widgets";
import { applyPart, el, setErrors, setText } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";
import { runCommands } from "../command-runtime.js";

export function renderSelectField(
  container: HTMLElement,
  f: MdyDynamicOptionsField,
  handle: MdyFieldHandle<unknown>,
  reactivity: MdyReactivity = vanillaReactivity(),
): () => void {
  const options = f.options as ReadonlyArray<MdySelectOption<unknown>>;
  const keyFor = (option: MdySelectOption<unknown>) => String(option.value);

  const controller = createSelectController<unknown>(
    {
      widgetId: f.name,
      options,
      keyFor,
      value: handle.value(),
      disabled: handle.disabled(),
      invalid: !handle.valid(),
      onChange: (value) => {
        handle.set(value);
        handle.markAsDirty();
      },
    },
    reactivity,
  );

  const shell = buildFieldShell(f.label);
  const trigger = el("input") as HTMLInputElement;
  trigger.type = "text";
  trigger.autocomplete = "off";
  if (f.placeholder) trigger.placeholder = f.placeholder;
  const listbox = el("ul") as HTMLUListElement;
  const optionEls = new Map<string, HTMLLIElement>();
  for (const option of options) {
    const key = keyFor(option);
    const li = el("li") as HTMLLIElement;
    setText(li, option.label);
    listbox.appendChild(li);
    optionEls.set(key, li);
  }

  const wrapper = el("div", "mdy-plain-select");
  wrapper.append(trigger, listbox);
  insertControl(shell, wrapper);
  container.appendChild(shell.root);

  // select-controller's view has no "label"/"description"/"error" parts (only
  // trigger/listbox/options), unlike every other controller here — wire the
  // static bits by hand; the trigger id is stable regardless of state.
  shell.label.htmlFor = controller.view().parts.trigger.id ?? "";
  shell.description.className = "mdy-description";
  shell.errorList.className = "mdy-error";
  shell.errorList.setAttribute("role", "alert");

  const lookup: MdyElementLookup = (part, key) => {
    if (part === "trigger") return trigger;
    if (part === "option" && key) return optionEls.get(key);
    return undefined;
  };
  function dispatch(intent: Parameters<typeof controller.dispatch>[0]): void {
    const commands = controller.dispatch(intent);
    runCommands(commands, lookup, {
      setOpen: () => undefined, // reflected reactively below, nothing extra to do
      onTouched: () => handle.markAsTouched(),
      onDirty: () => handle.markAsDirty(),
    });
  }

  trigger.addEventListener("click", () => dispatch({ type: "open", source: "pointer" }));
  trigger.addEventListener("input", () => dispatch({ type: "search", query: trigger.value }));
  trigger.addEventListener("blur", () => dispatch({ type: "blur" }));
  trigger.addEventListener("keydown", (event) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        dispatch({ type: "move", target: "next" });
        break;
      case "ArrowUp":
        event.preventDefault();
        dispatch({ type: "move", target: "previous" });
        break;
      case "Home":
        event.preventDefault();
        dispatch({ type: "move", target: "first" });
        break;
      case "End":
        event.preventDefault();
        dispatch({ type: "move", target: "last" });
        break;
      case "Enter": {
        const activeKey = controller.state().activeKey;
        if (activeKey) {
          event.preventDefault();
          dispatch({ type: "select", optionKey: activeKey });
        }
        break;
      }
      case "Escape":
        dispatch({ type: "close", restoreFocus: true });
        break;
    }
  });
  for (const [key, li] of optionEls) {
    li.addEventListener("mousedown", (event) => event.preventDefault()); // keep focus on trigger
    li.addEventListener("click", () => dispatch({ type: "select", optionKey: key }));
  }

  const effectRef = reactivity.effect(() => {
    controller.setValue(handle.value());
    controller.setDisabled(handle.disabled());
    controller.setInvalid(!handle.valid());

    const state = controller.state();
    const view = controller.view();
    applyPart(trigger, view.parts.trigger);
    applyPart(listbox, view.parts.listbox);
    // select-controller's contract has no description/error parts (unlike every
    // other controller here) — errors still render, just via a plain static class.
    setErrors(shell.errorList, handle.errors().map((e) => e.message));

    listbox.hidden = !state.open;
    if (!state.open) {
      const selected = options.find((o) => keyFor(o) === state.selectedKey);
      if (document.activeElement !== trigger) trigger.value = selected?.label ?? "";
    }
    for (const [key, li] of optionEls) {
      const part = view.parts[key];
      if (part) applyPart(li, part);
      li.hidden = part?.classes.includes("mdy-select__option--hidden") ?? false;
    }
  });

  return () => {
    effectRef.destroy();
    controller.destroy();
    shell.root.remove();
  };
}
