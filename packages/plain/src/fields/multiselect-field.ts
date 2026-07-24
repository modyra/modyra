/**
 * Renders the "multiselect" kind via createMultiselectFieldController —
 * a search input plus toggle chips (single mode: click toggles
 * membership) or counter chips with +/- (multi mode), matching the
 * controller's own two selection semantics exactly.
 */
import { vanillaReactivity, type MdyFieldHandle, type MdyReactivity, type MdySelectOption } from "@modyra/core";
import type { MdyDynamicOptionsField } from "@modyra/core";
import { createMultiselectFieldController } from "@modyra/widgets";
import { applyPart, el, setErrors, setText } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";

export function renderMultiselectField(
  container: HTMLElement,
  f: MdyDynamicOptionsField,
  handle: MdyFieldHandle<ReadonlyArray<unknown>>,
  reactivity: MdyReactivity = vanillaReactivity(),
  mode: "single" | "multi" = "single",
): () => void {
  const options = f.options as ReadonlyArray<MdySelectOption<unknown>>;
  const keyFor = (option: MdySelectOption<unknown>) => String(option.value);
  const controller = createMultiselectFieldController({ widgetId: f.name, handle, options, keyFor, mode }, reactivity);

  const shell = buildFieldShell(f.label);
  const search = el("input") as HTMLInputElement;
  search.type = "search";
  search.placeholder = "Filter…";
  const group = el("div") as HTMLDivElement;

  const chips = new Map<string, { chip: HTMLButtonElement; count?: HTMLSpanElement; dec?: HTMLButtonElement; inc?: HTMLButtonElement }>();
  function buildChip(option: MdySelectOption<unknown>): void {
    const key = keyFor(option);
    if (chips.has(key)) return;
    const chip = el("button") as HTMLButtonElement;
    chip.type = "button";
    const label = el("span");
    setText(label, option.label);
    chip.appendChild(label);

    if (mode === "multi") {
      const dec = el("button") as HTMLButtonElement;
      dec.type = "button";
      setText(dec, "−");
      dec.setAttribute("aria-label", `Decrease ${option.label}`);
      dec.addEventListener("click", (event) => {
        event.stopPropagation();
        controller.dispatch({ type: "decrement", optionKey: key });
      });
      const count = el("span");
      const inc = el("button") as HTMLButtonElement;
      inc.type = "button";
      setText(inc, "+");
      inc.setAttribute("aria-label", `Increase ${option.label}`);
      inc.addEventListener("click", (event) => {
        event.stopPropagation();
        controller.dispatch({ type: "increment", optionKey: key });
      });
      chip.append(dec, count, inc);
      chips.set(key, { chip, count, dec, inc });
    } else {
      chip.addEventListener("click", () => controller.dispatch({ type: "toggle", optionKey: key }));
      chips.set(key, { chip });
    }
    group.appendChild(chip);
  }
  for (const option of options) buildChip(option);

  const wrapper = el("div", "mdy-plain-multiselect");
  wrapper.append(search, group);
  insertControl(shell, wrapper);
  container.appendChild(shell.root);

  search.addEventListener("input", () => controller.dispatch({ type: "search", query: search.value }));
  search.addEventListener("blur", () => controller.dispatch({ type: "blur" }));

  const effectRef = reactivity.effect(() => {
    const state = controller.state();
    const view = controller.view();
    const visibleKeys = new Set(controller.filteredOptions().map(keyFor));
    applyPart(shell.label, view.parts.label);
    applyPart(group, view.parts.group);
    applyPart(shell.description, view.parts.description);
    applyPart(shell.errorList, view.parts.error);
    setErrors(shell.errorList, handle.errors().map((e) => e.message));

    for (const option of options) {
      const key = keyFor(option);
      const entry = chips.get(key);
      if (!entry) continue;
      const part = view.parts[key];
      if (part) applyPart(entry.chip, part);
      entry.chip.hidden = !visibleKeys.has(key);
      if (entry.count) setText(entry.count, String(state.counts.get(key) ?? 0));
    }
  });

  return () => {
    effectRef.destroy();
    controller.destroy();
    shell.root.remove();
  };
}
