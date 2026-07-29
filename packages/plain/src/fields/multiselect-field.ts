/**
 * Renders the "multiselect" kind via createMultiselectFieldController — a trigger showing the
 * current selection as chips, and a document-level popup holding the filter field and the option
 * chips (single mode: click toggles membership; multi mode: counter chips with +/-, matching the
 * controller's two selection semantics exactly).
 *
 * The options live in an overlay rather than inline for the same reason select's do: an inline list
 * resizes the field every time it opens and pushes the rest of the form down the page.
 */
import { vanillaReactivity, type MdyFieldHandle, type MdyReactivity, type MdySelectOption } from "@modyra/core";
import type { MdyDynamicOptionsField } from "@modyra/core";
import { MDY_WIDGET_CONTRACTS, createMultiselectFieldController, overlayAnchoringFor, type MdyElementLookup } from "@modyra/widgets";
import { applyPart, el, setErrors, setText } from "../dom.js";
import { buildFieldShell, insertControl } from "../field-shell.js";
import { runCommands } from "../command-runtime.js";
import { dismissOnOutsidePointer, positionOverlay, releaseOverlayPlacement, trackOverlay } from "../overlay.js";

export function renderMultiselectField(
  container: HTMLElement,
  f: MdyDynamicOptionsField,
  handle: MdyFieldHandle<ReadonlyArray<unknown>>,
  reactivity: MdyReactivity = vanillaReactivity(),
  mode: "single" | "multi" = "single",
): () => void {
  // How this popup attaches is the contract's, not this renderer's.
  const anchoring = overlayAnchoringFor("multiselect");
  const options = f.options as ReadonlyArray<MdySelectOption<unknown>>;
  const keyFor = (option: MdySelectOption<unknown>) => String(option.value);
  const controller = createMultiselectFieldController({ widgetId: f.name, handle, options, keyFor, mode }, reactivity);

  const parts = MDY_WIDGET_CONTRACTS.multiselect.parts;
  const shell = buildFieldShell(f.label, "multiselect");

  // ── trigger: what the field shows when the popup is closed ────────────────────────────────
  const trigger = el("button") as HTMLButtonElement;
  trigger.type = "button";
  const chipList = el("span", parts.chips.classes.join(" "));
  const placeholder = el("span", parts.placeholder.classes.join(" "));
  setText(placeholder, f.placeholder ?? "Select…");
  trigger.append(chipList, placeholder);

  // ── popup: the filter field and the option chips ──────────────────────────────────────────
  const popup = el("div", `${parts.popup.classes.join(" ")} mdy-overlay`) as HTMLDivElement;
  const search = el("input", parts.search.classes.join(" ")) as HTMLInputElement;
  search.type = "search";
  search.placeholder = "Filter…";
  const group = el("div", parts.listbox.classes.join(" ")) as HTMLDivElement;
  popup.append(search, group);

  // Both modes draw the contract's chip: a check plus a label when each option is either in or out,
  // and the same chip with two step buttons and a count when an option can be taken several times.
  const optionEls = new Map<string, { chip: HTMLElement; count?: HTMLSpanElement }>();
  for (const option of options) {
    const key = keyFor(option);
    const label = el("span", parts.optionLabel.classes.join(" "));
    setText(label, option.label);

    if (mode === "multi") {
      const chip = el("div", parts.option.classes.join(" "));
      chip.title = option.label;
      const step = (sign: "−" | "+", intent: "decrement" | "increment", describe: string): HTMLButtonElement => {
        const button = el("button", parts.optionStep.classes.join(" ")) as HTMLButtonElement;
        button.type = "button";
        setText(button, sign);
        button.setAttribute("aria-label", `${describe} ${option.label}`);
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          dispatch({ type: intent, optionKey: key });
        });
        return button;
      };
      const count = el("span", parts.optionCount.classes.join(" ")) as HTMLSpanElement;
      chip.append(step("−", "decrement", "Decrease"), label, count, step("+", "increment", "Increase"));
      group.appendChild(chip);
      optionEls.set(key, { chip, count });
    } else {
      const chip = el("button", parts.option.classes.join(" ")) as HTMLButtonElement;
      chip.type = "button";
      chip.title = option.label;
      // Empty: the theme draws the tick for renderers that ship no icon set.
      const check = el("span", parts.optionCheck.classes.join(" "));
      check.setAttribute("aria-hidden", "true");
      chip.append(check, label);
      chip.addEventListener("click", () => dispatch({ type: "toggle", optionKey: key }));
      group.appendChild(chip);
      optionEls.set(key, { chip });
    }
  }

  insertControl(shell, trigger);
  container.appendChild(shell.root);
  // Document-level so no scroll container or renderer frame can clip the popup, exactly as the
  // select renderer portals its own listbox.
  document.body.appendChild(popup);

  // Selection chips are display-only: the interactive option chips live in the popup.
  const selectedChips = new Map<string, HTMLSpanElement>();
  function syncSelectedChips(counts: ReadonlyMap<string, number>): void {
    const shown = new Set<string>();
    for (const option of options) {
      const key = keyFor(option);
      const count = counts.get(key) ?? 0;
      if (count === 0) continue;
      shown.add(key);
      let chip = selectedChips.get(key);
      if (!chip) {
        chip = el("span", parts.chip.classes.join(" "));
        selectedChips.set(key, chip);
        chipList.appendChild(chip);
      }
      setText(chip, mode === "multi" && count > 1 ? `${option.label} ×${count}` : option.label);
    }
    for (const [key, chip] of selectedChips) {
      if (shown.has(key)) continue;
      chip.remove();
      selectedChips.delete(key);
    }
  }

  const lookup: MdyElementLookup = (part, key) => {
    if (part === "trigger") return trigger;
    if (part === "search") return search;
    if (part === "option" && key) return optionEls.get(key)?.chip;
    return undefined;
  };
  function dispatch(intent: Parameters<typeof controller.dispatch>[0]): void {
    runCommands(controller.dispatch(intent), lookup, {
      setOpen: () => undefined, // reflected reactively below, nothing extra to do
      onTouched: () => handle.markAsTouched(),
      onDirty: () => handle.markAsDirty(),
    });
  }

  trigger.addEventListener("click", () => dispatch({ type: "toggleOpen" }));
  search.addEventListener("input", () => dispatch({ type: "search", query: search.value }));
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !controller.state().open) return;
    event.preventDefault();
    dispatch({ type: "close", restoreFocus: true });
  };
  trigger.addEventListener("keydown", onKeydown);
  popup.addEventListener("keydown", onKeydown);

  const undismiss = dismissOnOutsidePointer(
    [trigger, popup],
    () => controller.state().open,
    () => dispatch({ type: "close", restoreFocus: false }),
  );
  const untrack = trackOverlay(popup, shell.wrapper, () => controller.state().open, anchoring);

  const effectRef = reactivity.effect(() => {
    const state = controller.state();
    const view = controller.view();

    applyPart(shell.root, view.root);
    applyPart(shell.label, view.parts.label);
    applyPart(trigger, view.parts.trigger);
    applyPart(chipList, view.parts.chips);
    applyPart(placeholder, view.parts.placeholder);
    applyPart(popup, view.parts.popup);
    applyPart(search, view.parts.search);
    applyPart(group, view.parts.group);
    applyPart(shell.description, view.parts.description);
    applyPart(shell.errorList, view.parts.error);
    setErrors(shell.errorList, handle.errors().map((e) => e.message));
    shell.syncState({
      touched: state.touched,
      disabled: state.disabled,
      hasError: state.invalid,
      filled: state.selectedKeys.size > 0,
      required: state.required,
    });

    syncSelectedChips(state.counts);
    // `hidden` on the popup part is the contract's; positioning only runs while it is showing.
    if (state.open) {
      positionOverlay(popup, shell.wrapper, anchoring);
    } else {
      // The next opening decides its own side and height rather than inheriting this one's.
      releaseOverlayPlacement(popup);
      if (search.value) search.value = "";
    }

    for (const option of options) {
      const key = keyFor(option);
      const entry = optionEls.get(key);
      if (!entry) continue;
      // The part carries `hidden` when the query filters the option out — no second filter here.
      const part = view.parts[key];
      if (part) applyPart(entry.chip, part);
      if (entry.count) setText(entry.count, `×${state.counts.get(key) ?? 0}`);
    }
  });

  return () => {
    undismiss();
    untrack();
    effectRef.destroy();
    controller.destroy();
    popup.remove();
    shell.root.remove();
  };
}
