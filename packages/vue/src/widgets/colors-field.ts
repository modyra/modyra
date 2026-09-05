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
import { computed, Teleport, defineComponent, h, ref, nextTick, onScopeDispose, shallowRef, triggerRef, watch, type PropType, type VNode } from "vue";
import {
  MDY_WIDGET_CONTRACTS,
  colorPresetsOf,
  createColorsFieldController,
  defaultWidgetIdFactory,
  keyBindingFor,

  fieldDescribedBy,
  visibleErrorsOf,} from "@modyra/widgets";
import { observerFor } from "@modyra/core";
import type { MdyFieldHandle } from "@modyra/core";
import { partProps, type MdyDeclaredPart, rootClasses } from "./part.js";
import { drawErrors } from "./errors.js";
import { useKeyboardInPlay } from "./keyboard-in-play.js";
import { useCloseWhenFieldLeaves } from "./field-teardown.js";
import { useDismissOnFocusOutside } from "./dismiss-on-focus-outside.js";
import { useOverlayOpen } from "./overlay-open.js";
import { useAnchoredPanel } from "./anchored-panel.js";
import { useLightDismiss } from "./light-dismiss.js";
import { useCommands } from "./commands.js";
import { useMessages } from "./locale.js";
import { widgetIdOf } from "./widget-id.js";

const CONTRACT = MDY_WIDGET_CONTRACTS.colors;
const declared = CONTRACT.parts as Readonly<Record<string, MdyDeclaredPart | undefined>>;
const classesOf = (part: string): string => declared[part]?.classes.join(" ") ?? "";
const roleOf = (part: string): string | undefined => declared[part]?.role ?? undefined;

export const MdyColorsField = defineComponent({
  name: "MdyColorsField",
  props: {
    field: { type: Object as PropType<MdyFieldHandle<string>>, required: true },
    label: { type: String, default: "" },
    /**
     * What every part's id is built from. Derived from the field's path when a document says
     * nothing, so two forms built from one document do not both claim `when__label`.
     */
    widgetId: { type: String, required: false, default: undefined },
    /** Which form on the page this widget belongs to, where a host renders more than one. */
    idScope: { type: String, required: false, default: undefined },
    /** The name a control has when nothing on the page captions it. */
    ariaLabel: { type: String, default: "" },
    presets: { type: Array as PropType<readonly string[]>, default: undefined },
  },
  setup(props) {
    // Every part's id comes from here: what the document named, or the field's own path with the
    // form's scope in front — two forms built from one document would otherwise both claim
    // `when__label`, and a reference from the second resolves into the first.
    const widgetId = computed(() => widgetIdOf({ widgetId: props.widgetId, idScope: props.idScope, field: props.field }));
    const reactivity = observerFor(props.field);
    // Two doors composed the way the reference renderer composes them: the palette answers with
    // entries, and the controller is given their values.
    const palette = colorPresetsOf(props.presets);
    const controller = createColorsFieldController({
      handle: props.field,
      widgetId: widgetId.value,
      presets: palette.map((entry) => entry.value),
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
      kind: "colors",
      root,
      panel,
      isOpen: () => state.value.open,
      close: () => run(controller.dispatch({ type: "close" })),
    });
    // The language this widget speaks: the page's, since this kind takes no locale of its own.
    const messages = useMessages(() => undefined);
    const view = shallowRef(controller.view());
    // What the controller answers is half of every interaction, and the half a screenshot does not
    // show: `restore-focus` after a dismissal is what puts the person back on the control they
    // opened. Dropped, the keyboard is left on nothing and the next Tab starts at the top of the page.
    const run = useCommands("colors", view, root, undefined, props.field as never);
    useLightDismiss({
      kind: "colors",
      root,
      isOpen: () => state.value.open,
      close: () => run(controller.dispatch({ type: "close" })),
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
        run(controller.dispatch({ type: "close", restoreFocus: true }));
        event.preventDefault();
      }
    };

    return () => {
      const parts = view.value.parts;
      const children: VNode[] = [];

      if (props.label !== "") {
        children.push(h("label", {
          id: defaultWidgetIdFactory.part(widgetId.value, "label"),
          for: defaultWidgetIdFactory.part(widgetId.value, "hexInput"),
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
          "aria-controls": defaultWidgetIdFactory.part(widgetId.value, "popup"),
          // The act, from the dictionary; see the datepicker's door for why the caption is not it.
          "aria-label": messages.value.selectColorPrefix,
          onClick: () => run(controller.dispatch(state.value.open ? { type: "close" } : { type: "open" })),
        }, [h("span", partProps(parts.preview, {
          // The colour it previews, from the projection. Painted here from the field's own value,
          // this renderer was a fourth opinion about it — and the empty state was a literal chosen
          // in this file rather than the one the contract ships.
          ...(parts.preview?.content?.color === undefined
            ? {}
            : { style: { backgroundColor: parts.preview.content.color } }),
        }))]),
        // The native input the platform draws its own picker for, kept for the people who want it.
        // Its projection carries the relations and no classes, so the part's own class is added
        // here — without it the part is on the page and no check can find it.
        h("input", partProps(parts.control, {
          type: "color",
          // Out of the reading order and out of the tree, as the other renderers draw it and as the
          // contract's own class name says: `mdy-colors__native-hidden`. It is the platform's picker
          // kept for the people who want it, not the control a person is announced. What carries the
          // name is the hex box below, which is what a caption points at.
          "aria-hidden": "true",
          tabindex: -1,
          class: classesOf("control"),
          value: state.value.value,
          onInput: (event: Event) =>
            run(controller.dispatch({ type: "native", value: (event.target as HTMLInputElement).value })),
        })),
        h("input", {
          id: defaultWidgetIdFactory.part(widgetId.value, "hexInput"),
          class: classesOf("hexInput"),
          type: "text",
          value: state.value.text,
          // Errors first, then the description: a reader hears what is wrong with the field before
          // the hint about how to fill it, and hears both. Named through the shared door so the two
          // ids are composed in one place — this control used to name the description alone, so the
          // reason it was rejected sat on the page, correct and announced to nobody.
          "aria-describedby": fieldDescribedBy({
            errorId: defaultWidgetIdFactory.part(widgetId.value, "errors"),
            descriptionId: defaultWidgetIdFactory.part(widgetId.value, "description"),
            errorsPresent: visibleErrorsOf(props.field, "colors").length > 0,
            // This renderer takes no supporting text, so there is never one to point at. Said as
            // `false` rather than left at a default: pointing at the empty element it draws would
            // assert a description that does not exist and send a reader to a text nobody wrote.
            descriptionPresent: false,
          }),
          ...(props.ariaLabel !== "" ? { "aria-label": props.ariaLabel }
            // From the dictionary, which has carried these words in five languages all along and had
            // no reader: a literal here is English on a translated page, and the one place a name is
            // owed from nowhere else is exactly a control with no caption.
            : props.label === "" ? { "aria-label": messages.value.colorHexLabel } : {}),
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
            run(controller.dispatch({ type: "text", value: (event.target as HTMLInputElement).value })),
        }),
        // Declared presentation, so it is a span and not a control: a `<button>` here would be a
        // second thing to press for one act, and the custodian that watches permissive semantics
        // says so — a part whose element is not declared must not be operable.
        //
        // A pointer still opens from it, because the catalogue declares it as this kind's second
        // door (ADR 0177): a door a pointer may use, carrying no relation of its own, because the
        // element that says whether the panel is showing is the opener beside it. Left inert here,
        // the swatch a person aims at did nothing while the same press two pixels away opened the
        // panel.
        h("span", {
          class: classesOf("toggle"),
          onClick: () => run(controller.dispatch(state.value.open ? { type: "close" } : { type: "open" })),
        }),
      ]));

      // The panel stays in the document while it is shut, so what names it keeps naming something.
      children.push(h(Teleport, { to: "body" }, [h("div", {
        ref: panel,
        onKeydown,
        id: defaultWidgetIdFactory.part(widgetId.value, "popup"),
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
            onClick: () => run(controller.dispatch({ type: "preset", value: preset.value })),
            style: { background: preset.value },
          }))),
        // The action the panel holds, and the reason Tab stays inside it.
        h("button", {
          type: "button",
          class: classesOf("customEntry"),
          onClick: () => run(controller.dispatch({ type: "close", restoreFocus: true })),
        }, [
          // The tint the custom entry shows, and the only place this part belongs.
          h("span", { class: classesOf("customTint") }),
          "Custom…",
        ]),
      ])]));

      children.push(h("p", {
        id: defaultWidgetIdFactory.part(widgetId.value, "description"),
        class: classesOf("supportingText"),
      }));

      // The list the description points at, and what is in it. Absent, `aria-describedby`
      // named an id no element had: a promise of an explanation, kept by nothing.
      if (parts.error !== undefined) children.push(drawErrors(parts.error, props.field, "colors"));

      return h("div", { class: rootClasses(CONTRACT, { touched: props.field.touched(), open: state.value.open }), ref: root, onKeydown }, children);
    };
  },
});
