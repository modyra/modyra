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
import { createSelectController, MDY_WIDGET_CONTRACTS, type MdyElementLookup } from "@modyra/widgets";
import { applyPart, el, setErrors, setText } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";
import { runCommands } from "../command-runtime.js";
import { dismissOnOutsidePointer } from "../overlay.js";

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

  const parts = MDY_WIDGET_CONTRACTS.select.parts;
  const shell = buildFieldShell(f.label, "select");
  // The trigger displays the committed value; filtering happens in the field at the top of the
  // popup, which is the canonical select anatomy — typing over the display would hide it.
  const trigger = el("button") as HTMLButtonElement;
  trigger.type = "button";
  const valueText = el("span", parts.value.classes.join(" ")) as HTMLSpanElement;
  const placeholder = f.placeholder ?? "";
  // The panel is the `__dropdown` (positioning, frame, shadow); the scroller inside it is the
  // `__list`, and the filter field is its first row — same three parts the contract names.
  const popup = el("div", parts.popup.classes.join(" ")) as HTMLDivElement;
  const search = el("input", parts.search.classes.join(" ")) as HTMLInputElement;
  search.type = "text";
  search.autocomplete = "off";
  search.placeholder = "Search…";
  const listbox = el("ul", parts.listbox.classes.join(" ")) as HTMLUListElement;
  popup.append(search, listbox);
  const optionEls = new Map<string, HTMLLIElement>();
  for (const option of options) {
    const key = keyFor(option);
    const li = el("li", parts.option.classes.join(" ")) as HTMLLIElement;
    setText(li, option.label);
    listbox.appendChild(li);
    optionEls.set(key, li);
  }

  // `mdy-select` is what the themes anchor the dropdown against (position: relative); the
  // `mdy-plain-*` class stays as the renderer's own hook.
  const wrapper = el("div", "mdy-select mdy-plain-select");
  const arrow = el("span", parts.arrow.classes.join(" "));
  arrow.setAttribute("aria-hidden", "true");
  trigger.append(valueText, arrow);
  wrapper.append(trigger);
  insertControl(shell, wrapper);
  container.appendChild(shell.root);

  // The popup is a document-level overlay so scroll containers and renderer frames cannot clip
  // it. Widgets remains responsible for ARIA, keyboard navigation and selection state.
  popup.classList.add("mdy-overlay", "mdy-plain-select__portal");
  document.body.appendChild(popup);

  const positionListbox = (): void => {
    if (popup.hidden || !trigger.isConnected) return;
    const rect = trigger.getBoundingClientRect();
    const viewportGap = 8;
    const popupGap = 6;
    const below = window.innerHeight - rect.bottom - viewportGap;
    const above = rect.top - viewportGap;
    const openAbove = below < 180 && above > below;
    popup.dataset.placement = openAbove ? "top" : "bottom";
    popup.style.position = "fixed";
    popup.style.zIndex = "2147483000";
    popup.style.left = `${Math.max(viewportGap, rect.left)}px`;
    popup.style.width = `${Math.max(rect.width, 160)}px`;
    popup.style.maxHeight = `${Math.max(96, Math.min(320, (openAbove ? above : below) - popupGap))}px`;
    popup.style.top = openAbove ? "auto" : `${rect.bottom + popupGap}px`;
    popup.style.bottom = openAbove ? `${window.innerHeight - rect.top + popupGap}px` : "auto";
  };
  const reposition = (): void => positionListbox();
  window.addEventListener("resize", reposition);
  window.addEventListener("scroll", reposition, true);

  // select-controller's view has no "label"/"description"/"error" parts (only
  // trigger/listbox/options), unlike every other controller here — wire the
  // static bits by hand; the trigger id is stable regardless of state.
  shell.label.htmlFor = controller.view().parts.trigger.id ?? "";
  // The select controller's view has no description/error parts, so the shell's own canonical
  // classes are all these two carry; only the live region needs adding.
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

  trigger.addEventListener("click", () => dispatch(controller.state().open ? { type: "close", restoreFocus: true } : { type: "open", source: "pointer" }));
  // Blur means "focus left the widget", not "focus left this element": opening moves focus into
  // the search field, and treating that as a blur closed the popup as soon as it opened.
  const onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget as Node | null;
    if (next !== null && typeof next.nodeType === "number" && (wrapper.contains(next) || popup.contains(next))) return;
    dispatch({ type: "blur" });
  };
  trigger.addEventListener("focusout", onFocusOut);
  popup.addEventListener("focusout", onFocusOut);
  search.addEventListener("input", () => dispatch({ type: "search", query: search.value }));
  const onKeydown = (event: KeyboardEvent): void => {
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
  };
  trigger.addEventListener("keydown", onKeydown);
  search.addEventListener("keydown", onKeydown);
  for (const [key, li] of optionEls) {
    li.addEventListener("mousedown", (event) => event.preventDefault()); // keep focus on trigger
    li.addEventListener("click", () => dispatch({ type: "select", optionKey: key }));
  }

  const undismiss = dismissOnOutsidePointer(
    [wrapper, popup],
    () => controller.state().open,
    () => dispatch({ type: "close", restoreFocus: false }),
  );

  const effectRef = reactivity.effect(() => {
    controller.setValue(handle.value());
    controller.setDisabled(handle.disabled());
    controller.setInvalid(!handle.valid());

    const state = controller.state();
    const view = controller.view();
    applyPart(trigger, view.parts.trigger);
    applyPart(search, view.parts.search);
    applyPart(listbox, view.parts.listbox);
    // select-controller's contract has no description/error parts (unlike every
    // other controller here) — errors still render, just via a plain static class.
    setErrors(shell.errorList, handle.errors().map((e) => e.message));

    popup.hidden = !state.open;
    if (state.open) {
      queueMicrotask(positionListbox);
      queueMicrotask(() => search.focus());
    } else if (search.value) {
      search.value = "";
    }
    // The trigger always shows the committed value: nothing the user types can hide it.
    const selected = options.find((o) => keyFor(o) === state.selectedKey);
    setText(valueText, selected?.label ?? placeholder);
    valueText.classList.toggle(parts.placeholder.classes[0], !selected);
    for (const [key, li] of optionEls) {
      // The part carries `hidden` when the query filters the option out — no second filter here.
      const part = view.parts[key];
      if (part) applyPart(li, part);
    }
  });

  return () => {
    undismiss();
    effectRef.destroy();
    controller.destroy();
    window.removeEventListener("resize", reposition);
    window.removeEventListener("scroll", reposition, true);
    popup.remove();
    shell.root.remove();
  };
}
