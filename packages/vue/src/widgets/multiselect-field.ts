/**
 * The multiselect: chips for what is held, and a panel of chips for what can be.
 *
 * The largest kind in the catalogue, and the one where every rule this package learned has to hold
 * at once — the variant read from the mode, the repetition inherited from the parent, the reading
 * position announced through the projection, and the per-row key for the quantity.
 *
 * **The mode is the shape, and it is a closed set.** `single` is a set of toggles; `multi` is a bag
 * where a choice can be taken more than once, and it owes a stepper and a count on every row. The
 * contract names both, and a mode outside the two produces a variant name the catalogue does not
 * declare — which downstream means *no* variant requirements rather than a refusal, so the checks
 * for the shape quietly stop applying. That is why this component takes the declared type rather
 * than a string.
 */
import { Teleport, defineComponent, h, ref, nextTick, onScopeDispose, shallowRef, triggerRef, watch, type PropType, type VNode } from "vue";
import {
  MDY_WIDGET_CONTRACTS,
  createMultiselectFieldController,
  defaultWidgetIdFactory,
  focusPartOnOpen,
  keyBindingFor,
} from "@modyra/widgets";
import { observerFor } from "@modyra/core";
import type { MdyFieldHandle, MdyMultiselectMode, MdySelectOption } from "@modyra/core";
import { partProps, type MdyDeclaredPart, rootClasses } from "./part.js";
import { drawErrors } from "./errors.js";
import { useKeyboardInPlay } from "./keyboard-in-play.js";
import { useCloseWhenFieldLeaves } from "./field-teardown.js";
import { useDismissOnFocusOutside } from "./dismiss-on-focus-outside.js";
import { useOverlayOpen } from "./overlay-open.js";
import { useAnchoredPanel } from "./anchored-panel.js";
import { useLightDismiss } from "./light-dismiss.js";
import { useCommands } from "./commands.js";

const CONTRACT = MDY_WIDGET_CONTRACTS.multiselect;
const declared = CONTRACT.parts as Readonly<Record<string, MdyDeclaredPart | undefined>>;
const classesOf = (part: string): string => declared[part]?.classes.join(" ") ?? "";
const roleOf = (part: string): string | undefined => declared[part]?.role ?? undefined;

export const MdyMultiselectField = defineComponent({
  name: "MdyMultiselectField",
  props: {
    field: { type: Object as PropType<MdyFieldHandle<readonly string[]>>, required: true },
    options: { type: Array as PropType<readonly MdySelectOption<string>[]>, required: true },
    label: { type: String, default: "" },
    widgetId: { type: String, required: true },
    mode: { type: String as PropType<MdyMultiselectMode>, default: "single" },
    searchable: { type: Boolean, default: false },
  },
  setup(props) {
    const reactivity = observerFor(props.field);
    const controller = createMultiselectFieldController<string>({
      handle: props.field,
      widgetId: props.widgetId,
      options: props.options,
      mode: props.mode,
    }, reactivity);

    // Measured and placed against the control that opens it, and drawn outside the field so it
    // does not inherit an ancestor's `overflow` or stacking. ADR 0130.
    // The branch a dismissal starts from; the contract reaches out to the panel itself.
    const root = ref<HTMLElement | null>(null);
    useKeyboardInPlay(props.field as never, root);
    // And what the field holds open, when the field itself goes. This package draws its panels
    // outside the field, so nothing carries them away with it.
    useCloseWhenFieldLeaves(root, () => run(controller.dispatch({ type: "close" })));
    const panel = ref<HTMLElement | null>(null);
    const anchor = ref<HTMLElement | null>(null);

    const state = shallowRef(controller.state());
    // And when the keyboard settles somewhere else: every kind with a popup declares it, and this
    // package honoured it nowhere.
    // Shown through the door that also makes it a popover, which is what the foundation reads
    // to lay it out against the viewport — the system `anchorOverlay` measured in.
    useOverlayOpen(panel, () => state.value.open);

    useDismissOnFocusOutside({
      kind: "multiselect",
      root,
      panel,
      isOpen: () => state.value.open,
      close: () => run(controller.dispatch({ type: "close" })),
    });
    const view = shallowRef(controller.view());
    // What the controller answers is half of every interaction, and the half a screenshot does not
    // show: `restore-focus` after a dismissal is what puts the person back on the control they
    // opened. Dropped, the keyboard is left on nothing and the next Tab starts at the top of the page.
    const run = useCommands("multiselect", view, root);
    useLightDismiss({
      kind: "multiselect",
      root,
      isOpen: () => state.value.open,
      close: () => run(controller.dispatch({ type: "close", restoreFocus: false })),
    });

    useAnchoredPanel({ kind: "multiselect", panel, anchor, isOpen: () => state.value.open });
    const watching = reactivity.effect(() => {
      state.value = controller.state();
      view.value = controller.view();
      triggerRef(state);
      triggerRef(view);
    });
    onScopeDispose(() => { watching.destroy(); controller.destroy(); });

    watch(() => state.value.open, async (open) => {
      if (!open) return;
      // The panel's primary unit: the filter box where there is one, and otherwise the first thing
      // that can be chosen. The contract answers which, per instance.
      const part = focusPartOnOpen("multiselect", { searchable: props.searchable });
      if (part === null) return;
      await nextTick();
      // Found through the panel element rather than a selector built from its id: an id needs
      // escaping to be a selector, `CSS.escape` is not everywhere, and the panel is already
      // addressable by the id the contract spells.
      const panel = document.getElementById(defaultWidgetIdFactory.part(props.widgetId, "popup"));
      const first = panel?.querySelector(`.${classesOf(part).split(" ")[0]}`);
      if (first instanceof HTMLElement) first.focus();
    });

    const onKeydown = (event: KeyboardEvent): void => {
      // Asked at the row first, then at the control. A binding declared `on` a part is invisible
      // from the control and is the only answer from that part, which is how one key means two
      // things without either declaration shadowing the other: ArrowLeft and ArrowRight step the
      // quantity of the row a person is on, and mean nothing at the control at all.
      const binding = keyBindingFor("multiselect", event, state.value.open, "option")
        ?? keyBindingFor("multiselect", event, state.value.open);
      if (!binding) return;
      switch (binding.intent) {
        case "open":
          run(controller.dispatch({ type: "open" }));
          break;
        case "cancel":
          // This panel holds nothing worth staying for, so Tab closes it and is left to the
          // browser; Escape closes it and is consumed.
          run(controller.dispatch({ type: "close", restoreFocus: event.key !== "Tab" }));
          if (event.key === "Tab") return;
          break;
        case "move":
          run(controller.dispatch({ type: "move", target: (binding.by ?? 1) > 0 ? "next" : "previous" }));
          break;
        case "toggle":
          run(controller.dispatch({ type: "select" }));
          break;
        case "step": {
          // The per-row quantity, and the reason this key exists: the steppers sit on a row, so a
          // tab stop cannot name which row it reaches — only a key pressed on the active one can.
          const active = state.value.activeKey;
          if (active === null) return;
          run(controller.dispatch((binding.by ?? 1) > 0
            ? { type: "increment", optionKey: active }
            : { type: "decrement", optionKey: active }));
          break;
        }
        default:
          return;
      }
      event.preventDefault();
    };

    /** One row in the panel. What it owes beyond its label is the variant's answer, not this file's. */
    const optionRow = (option: MdySelectOption<string>): VNode => {
      const key = String(option.value);
      const count = state.value.counts.get(key) ?? 0;
      return h("div", { class: classesOf("optionWrapper") }, [
        // The element is the variant's answer: a set of toggles draws each choice as a button,
        // while a bag draws a container with its own controls inside — and a button inside a button
        // is not a thing a browser will render.
        h(props.mode === "single" ? "button" : "div", partProps(view.value.parts[key], {
          ...(props.mode === "single" ? { type: "button" } : {}),
          onClick: () => run(controller.dispatch({ type: "toggle", optionKey: key })),
        }), [
          ...(props.mode === "single"
            ? [h("span", { class: classesOf("optionCheck"), "aria-hidden": "true" })]
            : [
              h("button", {
                type: "button", class: classesOf("optionStep"), "aria-label": `One fewer ${option.label}`,
                onClick: (event: Event) => {
                  event.stopPropagation();
                  run(controller.dispatch({ type: "decrement", optionKey: key }));
                },
              }, "−"),
              h("button", {
                type: "button", class: classesOf("optionStep"), "aria-label": `One more ${option.label}`,
                onClick: (event: Event) => {
                  event.stopPropagation();
                  run(controller.dispatch({ type: "increment", optionKey: key }));
                },
              }, "+"),
            ]),
          h("span", { class: classesOf("optionLabel") }, option.label),
          ...(props.mode === "multi" ? [h("span", { class: classesOf("optionCount") }, String(count))] : []),
        ]),
      ]);
    };

    return () => {
      const parts = view.value.parts;
      const children: VNode[] = [];

      if (props.label !== "") {
        children.push(h("label", {
          id: defaultWidgetIdFactory.part(props.widgetId, "label"),
          for: parts.trigger?.id,
          class: classesOf("label"),
        }, props.label));
      }

      // The controller's list, for the same reason: a chip is how a held value is seen and removed,
      // and a value missing from the declared options would otherwise be held with no chip at all.
      const held = state.value.options.filter((option) => state.value.selectedKeys.has(String(option.value)));
      children.push(h("div", { class: classesOf("inputWrapper") }, [
        h("div", { class: classesOf("box") }, [
          // What is held, as a grid: one row of cells, which is how a screen reader counts them and
          // how the arrows walk them.
          h("div", partProps(parts.chips, { class: classesOf("chips"), role: roleOf("chips") }), [
            h("div", { class: classesOf("chipRow"), role: roleOf("chipRow") },
              held.map((option) => h("span", { class: classesOf("chip"), role: roleOf("chip") }, [
                h("button", { type: "button", class: classesOf("chipMove"), "aria-label": `Move ${option.label}` }),
                h("span", option.label),
                h("button", {
                  type: "button", class: classesOf("chipRemove"), "aria-label": `Remove ${option.label}`,
                  onClick: () => run(controller.dispatch({ type: "toggle", optionKey: String(option.value) })),
                }),
              ]))),
          ]),
          // A button, not a text box: the placeholder lives *inside* it, and an `<input>` cannot
          // hold anything. What a person types goes in the panel's filter, not here.
          h("button", partProps(parts.trigger, {
            ref: anchor,
            type: "button",
            onClick: () => run(controller.dispatch({ type: "toggleOpen" })),
          }), [
            h("span", partProps(parts.placeholder, { class: classesOf("placeholder") }), "Choose…"),
          ]),
          // The way back from a destructive act, and the one control that must exist whether or not
          // there is anything to undo: a button that appears only once something is lost is a
          // button nobody knows is there.
          h("button", {
            type: "button", class: classesOf("wayBackAction"),
            // Drawn at all times, so it has to say whether it can act — and say it with
            // `aria-disabled`, which leaves it in the tree and announced, rather than with
            // `disabled`, which takes it out of the reading order the moment there is nothing to
            // undo. A control that comes and goes moves the one beside it under the hands of
            // somebody aiming at it.
            "aria-disabled": String(state.value.wayBack === null),
            onClick: () => run(controller.dispatch({ type: "undo" })),
          }, "Undo"),
          h("button", {
            type: "button", class: classesOf("clearAll"), "aria-label": "Clear all",
            "aria-disabled": String(state.value.selectedKeys.size === 0),
            onClick: () => run(controller.dispatch({ type: "clear" })),
          }),
          h("span", { class: classesOf("arrow"), "aria-hidden": "true" }),
          h("span", partProps(parts.announcement, { class: classesOf("announcement") }),
            (parts.announcement as { readonly text?: string } | undefined)?.text ?? ""),
        ]),
      ]));

      children.push(h(Teleport, { to: "body" }, [h("div", partProps(parts.popup, { ref: panel, class: classesOf("popup"), onKeydown }), [
        ...(props.searchable
          ? [h("input", partProps(parts.search, {
            type: "text",
            value: state.value.query,
            onInput: (event: Event) =>
              run(controller.dispatch({ type: "search", query: (event.target as HTMLInputElement).value })),
          }))]
          : []),
        h("div", partProps(parts.group, { class: classesOf("options"), role: roleOf("options") }),
          state.value.options.map(optionRow)),
      ])]));

      children.push(h("p", {
        id: defaultWidgetIdFactory.part(props.widgetId, "description"),
        class: classesOf("supportingText"),
      }));

      // The list the description points at, and what is in it. Absent, `aria-describedby`
      // named an id no element had: a promise of an explanation, kept by nothing.
      if (parts.error !== undefined) children.push(drawErrors(parts.error, props.field, "multiselect"));

      return h("div", { class: rootClasses(CONTRACT, { touched: props.field.touched(), open: state.value.open }), ref: root, onKeydown }, children);
    };
  },
});
