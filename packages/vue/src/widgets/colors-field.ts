/**
 * The colour field: a native picker, a hex box, and a panel of preset swatches.
 *
 * The second panel here that keeps Tab, and it keeps it for a different reason than the time one.
 * There is a single action beside the choices — the entry for a colour that is not a preset — and
 * the arrows never leave the swatch grid by design, so a Tab that dismissed the panel left that
 * button reachable with a pointer and with nothing else. ADR 0198.
 *
 * **The grid is one stop, not one per swatch.** The arrows are what move within it and Tab is how a
 * person leaves it for the action beside it; a stop per colour would make Tab the way to walk a
 * palette, which is what the arrows are for. It wraps, because a panel that holds the key is a room:
 * walking out of it the way you walk out of a page leaves the action behind. `Escape` is the way
 * out, and it still is.
 */
import { Teleport, defineComponent, h, ref, nextTick, onScopeDispose, shallowRef, triggerRef, watch, type PropType, type VNode } from "vue";
import {
  MDY_WIDGET_CONTRACTS,
  colorPresetsOf,
  createColorsFieldController,
  defaultWidgetIdFactory,
  keyBindingFor,
} from "@modyra/widgets";
import { observerFor } from "@modyra/core";
import type { MdyFieldHandle } from "@modyra/core";
import { partProps, type MdyDeclaredPart } from "./part.js";
import { drawErrors } from "./errors.js";
import { useKeyboardInPlay } from "./keyboard-in-play.js";
import { useCloseWhenFieldLeaves } from "./field-teardown.js";
import { useAnchoredPanel } from "./anchored-panel.js";
import { useLightDismiss } from "./light-dismiss.js";

const CONTRACT = MDY_WIDGET_CONTRACTS.colors;
const declared = CONTRACT.parts as Readonly<Record<string, MdyDeclaredPart | undefined>>;
const classesOf = (part: string): string => declared[part]?.classes.join(" ") ?? "";
const roleOf = (part: string): string | undefined => declared[part]?.role ?? undefined;

export const MdyColorsField = defineComponent({
  name: "MdyColorsField",
  props: {
    field: { type: Object as PropType<MdyFieldHandle<string>>, required: true },
    label: { type: String, default: "" },
    widgetId: { type: String, required: true },
    /** The name a control has when nothing on the page captions it. */
    ariaLabel: { type: String, default: "" },
    presets: { type: Array as PropType<readonly string[]>, default: undefined },
  },
  setup(props) {
    const reactivity = observerFor(props.field);
    // Two doors composed the way the reference renderer composes them: the palette answers with
    // entries, and the controller is given their values.
    const palette = colorPresetsOf(props.presets);
    const controller = createColorsFieldController({
      handle: props.field,
      widgetId: props.widgetId,
      presets: palette.map((entry) => entry.value),
    }, reactivity);

    // Measured and placed against the control that opens it, and drawn outside the field so it
    // does not inherit an ancestor's `overflow` or stacking. ADR 0130.
    // The branch a dismissal starts from; the contract reaches out to the panel itself.
    const root = ref<HTMLElement | null>(null);
    useKeyboardInPlay(props.field as never, root);
    // And what the field holds open, when the field itself goes. This package draws its panels
    // outside the field, so nothing carries them away with it.
    useCloseWhenFieldLeaves(root, () => controller.dispatch({ type: "close" }));
    const panel = ref<HTMLElement | null>(null);
    const anchor = ref<HTMLElement | null>(null);

    const state = shallowRef(controller.state());
    const view = shallowRef(controller.view());
    useLightDismiss({
      kind: "colors",
      root,
      isOpen: () => state.value.open,
      close: () => controller.dispatch({ type: "close" }),
    });

    useAnchoredPanel({ kind: "colors", panel, anchor, isOpen: () => state.value.open });
    const watching = reactivity.effect(() => {
      state.value = controller.state();
      view.value = controller.view();
      triggerRef(state);
      triggerRef(view);
    });
    onScopeDispose(() => { watching.destroy(); controller.destroy(); });

    // `Array.from`, not a spread: what `querySelectorAll` returns is array-like without being
    // iterable unless the project asks for `DOM.Iterable`, and none of this repository's packages
    // do. Spread here compiles under the compiler this package is built with and fails under the
    // one a consumer may hold, which makes it a portability defect rather than a matter of style.
    const swatches = (): readonly HTMLElement[] =>
      // Inside the *panel*, not inside the field: the panel is drawn outside it (ADR 0130), so a
      // lookup scoped to the field's own element finds nothing and reads as "the control is not
      // there" — which is what it did the moment the panel was moved out.
      Array.from(panel.value?.querySelectorAll(`.${classesOf("swatch").split(" ")[0]}`) ?? [])
        .filter((element): element is HTMLElement => element instanceof HTMLElement);
    const entry = (): HTMLElement | null => {
      const found = panel.value?.querySelector(`.${classesOf("customEntry").split(" ")[0]}`);
      return found instanceof HTMLElement ? found : null;
    };

    watch(() => state.value.open, async (open) => {
      if (!open) return;
      // The panel opens on the choices, which is what a person came to do.
      await nextTick();
      const grid = swatches();
      (grid.find((swatch) => swatch.tabIndex === 0) ?? grid[0])?.focus();
    });

    const onKeydown = (event: KeyboardEvent): void => {
      if (!state.value.open) return;
      // Read from the contract, not from the key's name: this kind declares Tab as a *move* while
      // open, which is what makes it a walk rather than a dismissal. A kind that stopped declaring
      // it would stop being walked here, instead of being walked by a rule written in this file.
      const binding = keyBindingFor("colors", event, true);
      if (event.key === "Tab" && binding?.intent === "move") {
        event.preventDefault();
        const grid = swatches();
        if (document.activeElement === entry()) {
          (grid.find((swatch) => swatch.tabIndex === 0) ?? grid[0])?.focus();
        } else {
          entry()?.focus();
        }
        return;
      }
      if (binding?.intent === "cancel") {
        controller.dispatch({ type: "close", restoreFocus: true });
        event.preventDefault();
      }
    };

    return () => {
      const parts = view.value.parts;
      const children: VNode[] = [];

      if (props.label !== "") {
        children.push(h("label", {
          id: defaultWidgetIdFactory.part(props.widgetId, "label"),
          for: defaultWidgetIdFactory.part(props.widgetId, "hexInput"),
          class: classesOf("label"),
        }, props.label));
      }

      children.push(h("div", { class: classesOf("inputWrapper") }, [
        // The platform's own picker: the button a person presses, carrying the swatch that shows
        // what is held. It is also what opens the panel — the part named `toggle` is the area
        // around it and is declared presentation, so it presses nothing.
        h("button", {
          type: "button",
          ref: anchor,
          class: classesOf("nativePicker"),
          disabled: props.field.disabled(),
          "aria-expanded": String(state.value.open),
          "aria-controls": defaultWidgetIdFactory.part(props.widgetId, "popup"),
          "aria-label": props.label === "" ? "Choose colour" : `Choose ${props.label}`,
          onClick: () => controller.dispatch(state.value.open ? { type: "close" } : { type: "open" }),
        }, [h("span", partProps(parts.preview))]),
        // The native input the platform draws its own picker for, kept for the people who want it.
        // Its projection carries the relations and no classes, so the part's own class is added
        // here — without it the part is on the page and no check can find it.
        h("input", partProps(parts.control, {
          type: "color",
          // The name, where nothing on the page captions the control. Without it the swatch a
          // person operates is announced as nothing at all.
          ...(props.ariaLabel === "" ? {} : { "aria-label": props.ariaLabel }),
          class: classesOf("control"),
          value: state.value.value,
          onInput: (event: Event) =>
            controller.dispatch({ type: "native", value: (event.target as HTMLInputElement).value }),
        })),
        h("input", {
          id: defaultWidgetIdFactory.part(props.widgetId, "hexInput"),
          class: classesOf("hexInput"),
          type: "text",
          value: state.value.text,
          // The box a person types into is the one the caption names, so it is also the one that
          // has to say where its description is: named by a label and described by nothing is a
          // control whose error text is on the page and announced to nobody.
          "aria-describedby": defaultWidgetIdFactory.part(props.widgetId, "description"),
          ...(props.label === "" ? { "aria-label": "Hex colour" } : {}),
          // The states this box is in, announced on it and enforced on it. It is a control the
          // contract names, and a control that says it refuses while accepting what a person types
          // is worse than one that says nothing: the value it takes is one the model will not hold.
          // The verdict the projection already computed for the control beside it, not the raw
          // state: what is *shown* is not what is wrong, and a field nobody has touched is not
          // wrong yet. Read from the state, this box announced an error at rest that no other part
          // of the widget was announcing.
          "aria-invalid": parts.control?.attributes?.["aria-invalid"] ?? "false",
          "aria-disabled": String(props.field.disabled()),
          "aria-readonly": String(props.field.readonly()),
          disabled: props.field.disabled(),
          readonly: props.field.readonly(),
          onChange: (event: Event) =>
            controller.dispatch({ type: "text", value: (event.target as HTMLInputElement).value }),
        }),
        // Declared presentation, so it is a span and not a control: a `<button>` here would be a
        // second thing to press for one act, and the custodian that watches permissive semantics
        // says so — a part whose element is not declared must not be operable.
        h("span", { class: classesOf("toggle") }),
      ]));

      // The panel stays in the document while it is shut, so what names it keeps naming something.
      children.push(h(Teleport, { to: "body" }, [h("div", {
        ref: panel,
        onKeydown,
        id: defaultWidgetIdFactory.part(props.widgetId, "popup"),
        class: classesOf("popup"),
        hidden: !state.value.open,
      }, [
        h("div", partProps(parts.presets, { class: classesOf("presets") }),
          state.value.presets.map((preset, index) => h("button", {
            type: "button",
            class: classesOf("swatch"),
            role: roleOf("swatch"),
            "aria-selected": String(preset.selected),
            "aria-label": preset.value,
            // One stop for the whole grid: the arrows move within it, so exactly one swatch is
            // reachable by Tab and the rest are reached by the keys that mean "next colour".
            tabindex: preset.selected || (index === 0 && !state.value.presets.some((other) => other.selected)) ? 0 : -1,
            onClick: () => controller.dispatch({ type: "preset", value: preset.value }),
            style: { background: preset.value },
          }))),
        // The action the panel holds, and the reason Tab stays inside it.
        h("button", {
          type: "button",
          class: classesOf("customEntry"),
          onClick: () => controller.dispatch({ type: "close", restoreFocus: true }),
        }, [
          // The tint the custom entry shows, and the only place this part belongs.
          h("span", { class: classesOf("customTint") }),
          "Custom…",
        ]),
      ])]));

      children.push(h("p", {
        id: defaultWidgetIdFactory.part(props.widgetId, "description"),
        class: classesOf("supportingText"),
      }));

      // The list the description points at, and what is in it. Absent, `aria-describedby`
      // named an id no element had: a promise of an explanation, kept by nothing.
      if (parts.error !== undefined) children.push(drawErrors(parts.error, props.field, "colors"));

      return h("div", { class: CONTRACT.rootClasses.join(" "), ref: root, onKeydown }, children);
    };
  },
});
