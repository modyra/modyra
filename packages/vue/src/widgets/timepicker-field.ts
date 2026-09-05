/**
 * The time field, and the first panel in this package that keeps Tab.
 *
 * Every other overlay here lets Tab through: it closes and the browser moves on, because there is
 * nothing inside worth staying for. This one has its own controls — two spin boxes, a mode toggle
 * and two actions — so `popupHoldsAnAction` answers `true`, and Tab has to be swallowed and turned
 * into a walk *inside* the panel. Letting it out would leave a person half-way through setting a
 * time, on a page behind an open dialog, with the confirm button reachable only by pointer.
 *
 * **The ring is declared, not listed here.** `timepickerTabOrder` says which parts are stops and in
 * what order; `timepickerPartSelector` turns each name into the element, composing the wrapper's
 * class with the control's — asked by the control's class alone, the hour and the minute box are
 * the same selector, and a walk that names the minute lands on the hour while looking like it did
 * nothing at all.
 */
import { Teleport, defineComponent, h, ref, nextTick, onScopeDispose, shallowRef, triggerRef, watch, type PropType, type VNode } from "vue";
import {
  MDY_WIDGET_CONTRACTS,
  createTimepickerFieldController,
  defaultWidgetIdFactory,
  timepickerFocusPart,
  timepickerPartSelector,
  timepickerTabOrder,
  keyBindingFor,
} from "@modyra/widgets";
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

const CONTRACT = MDY_WIDGET_CONTRACTS.timepicker;
const declared = CONTRACT.parts as Readonly<Record<string, MdyDeclaredPart | undefined>>;
const classesOf = (part: string): string => declared[part]?.classes.join(" ") ?? "";
const roleOf = (part: string): string | undefined => declared[part]?.role ?? undefined;
/** The class that narrows a repeated part to one of its states, as the ring's names spell it. */
const modifierOf = (part: string, state: string): string => {
  const base = declared[part]?.classes[0];
  return base === undefined ? "" : `${base}--${state}`;
};

export const MdyTimepickerField = defineComponent({
  name: "MdyTimepickerField",
  props: {
    field: { type: Object as PropType<MdyFieldHandle<string | null>>, required: true },
    label: { type: String, default: "" },
    widgetId: { type: String, required: true },
    /** The name a control has when nothing on the page captions it. */
    ariaLabel: { type: String, default: "" },
  },
  setup(props) {
    const reactivity = observerFor(props.field);
    const controller = createTimepickerFieldController({
      handle: props.field,
      widgetId: props.widgetId,
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
    // And when the keyboard settles somewhere else: every kind with a popup declares it, and this
    // package honoured it nowhere.
    // Shown through the door that also makes it a popover, which is what the foundation reads
    // to lay it out against the viewport — the system `anchorOverlay` measured in.
    useOverlayOpen(panel, () => state.value.open);

    useDismissOnFocusOutside({
      kind: "timepicker",
      root,
      panel,
      isOpen: () => state.value.open,
      close: () => controller.dispatch({ type: "close" }),
    });
    const view = shallowRef(controller.view());
    useLightDismiss({
      kind: "timepicker",
      root,
      isOpen: () => state.value.open,
      close: () => controller.dispatch({ type: "close" }),
    });

    useAnchoredPanel({ kind: "timepicker", panel, anchor, isOpen: () => state.value.open });
    const watching = reactivity.effect(() => {
      state.value = controller.state();
      view.value = controller.view();
      triggerRef(state);
      triggerRef(view);
    });
    onScopeDispose(() => { watching.destroy(); controller.destroy(); });

    /** The stops that are on the page, in the order the contract puts them. */
    const stops = (): readonly HTMLElement[] => {
      // Inside the *panel*, not inside the field: the panel is drawn outside it (ADR 0130), so a
      // lookup scoped to the field's own element finds nothing and reads as "the control is not
      // there" — which is what it did the moment the panel was moved out.
      const host = panel.value;
      if (host === null) return [];
      // The format decides the ring: a twelve-hour field has an AM/PM stop and a
      // twenty-four-hour one does not. Asked without it, the answer is the same list both times,
      // which is a ring missing a control a person has to reach.
      return timepickerTabOrder(state.value.format)
        .map((part) => timepickerPartSelector(part))
        .map((selector) => (selector === null ? null : host.querySelector(selector)))
        .filter((element): element is HTMLElement => element instanceof HTMLElement);
    };

    watch(() => state.value.open, async (open) => {
      if (!open) return;
      // Where the panel opens is the field being edited, and that question has its own answer.
      await nextTick();
      const selector = timepickerPartSelector(timepickerFocusPart(state.value.focusedField));
      const target = selector === null ? null : panel.value?.querySelector(selector);
      if (target instanceof HTMLElement) target.focus();
    });

    const onKeydown = (event: KeyboardEvent): void => {
      if (!state.value.open) return;
      if (event.key === "Escape") {
        controller.dispatch({ type: "cancel" });
        event.preventDefault();
        return;
      }
      if (event.key !== "Tab") return;
      const ring = stops();
      if (ring.length === 0) return;
      // Swallowed, and turned into a step inside. The wrap is what makes it a ring rather than a
      // dead end: without it the last stop hands focus to the page behind an open dialog.
      event.preventDefault();
      const here = ring.indexOf(document.activeElement as HTMLElement);
      const step = event.shiftKey ? -1 : 1;
      const next = here === -1 ? 0 : (here + step + ring.length) % ring.length;
      ring[next]?.focus();
    };

    /** One spin box. Both are the same control with a different segment around them. */
    const segment = (part: "hour" | "minute"): VNode =>
      h("span", { class: classesOf(part) }, [
        h("input", partProps(view.value.parts[`${part}Control`], {
          type: "text",
          onChange: (event: Event) => {
            const typed = Number.parseInt((event.target as HTMLInputElement).value, 10);
            if (Number.isNaN(typed)) return;
            controller.dispatch(part === "hour" ? { type: "set-hour", hour: typed } : { type: "set-minute", minute: typed });
          },
        })),
      ]);

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

      children.push(h("div", { class: classesOf("inputWrapper") }, [
        h("input", partProps(parts.trigger, {
          // The name, where nothing on the page captions the control. The projection names a
          // control against a caption that exists; this is the other case, and without it a
          // captionless control is announced as nothing at all.
          ...(props.ariaLabel === "" ? {} : { "aria-label": props.ariaLabel }),
          type: "text",
          value: state.value.entryText,
          onChange: (event: Event) =>
            controller.dispatch({ type: "set-time", time: (event.target as HTMLInputElement).value }),
          // The door the contract names first. `MDY_POPUP_OPENERS` declares the *control* as this
          // kind's opener and the toggle beside it as a second way in; drawn without a handler, the
          // declared one was dead and a person pressing the field got nothing.
          onClick: () => { if (!state.value.open) controller.dispatch({ type: "open" }); },
          // And by key, because a control that only opens under a pointer is one a keyboard cannot
          // reach the dial through at all. Which key is the contract's answer, not a list here.
          onKeydown: (event: KeyboardEvent) => {
            if (state.value.open) return;
            // Asked *at the part*: this kind declares the key `on: "control"`, and a binding
            // declared on a part is invisible from the widget. Asked without it, the lookup
            // finds nothing and the keyboard never reaches the panel.
            const binding = keyBindingFor("timepicker", event, false, "control");
            if (binding?.intent !== "open") return;
            event.preventDefault();
            // And stopped here. The root forwards keys to the panel once it is open, and this press
            // would arrive there in the same turn — opening and then being read as a move inside the
            // panel it just opened, which left the widget shut again.
            event.stopPropagation();
            controller.dispatch({ type: "open" });
          },
        })),
        h("button", {
          type: "button",
          ref: anchor,
        class: classesOf("toggle"),
          // A refusal that is announced and enforced: a toggle that keeps `aria-disabled` while
          // staying pressable opens a panel over a field the model has taken out of play.
          disabled: props.field.disabled(),
          "aria-disabled": String(props.field.disabled()),
          "aria-expanded": String(state.value.open),
          "aria-label": props.label === "" ? "Choose time" : `Choose ${props.label}`,
          onClick: () => controller.dispatch(state.value.open ? { type: "close" } : { type: "open" }),
        }),
      ]));

      // The panel stays in the document while it is shut: the control names it with `aria-controls`
      // on every render, and a panel that is removed leaves that pointing at nothing.
      // The popup *is* the dialog: one element carrying both parts' classes, the dialog's role and
      // its modal relation. Drawn as two, the panel a person is inside and the panel the contract
      // calls a dialog are different elements, and the one announced is the empty one.
      children.push(h(Teleport, { to: "body" }, [h("div", partProps(parts.dialog, {
        ref: panel,
        onKeydown,
        id: defaultWidgetIdFactory.part(props.widgetId, "popup"),
        class: classesOf("popup"),
        hidden: !state.value.open,
      }), [
        h("div", { class: classesOf("container") }, [
          h("div", { class: classesOf("content") }, [
            h("div", { class: classesOf("header") }, [
              segment("hour"),
              segment("minute"),
              // Drawn only where the format has one, which is the same condition the ring is built
              // from: a stop with nothing under it is a hole in the walk.
              ...(state.value.format === "12h" ? [h("span", { class: classesOf("period") }, [
                h("button", {
                  type: "button", class: classesOf("periodOption"),
                  onClick: () => controller.dispatch({ type: "set-period", period: state.value.display.includes("PM") ? "AM" : "PM" }),
                }, state.value.display.includes("PM") ? "PM" : "AM"),
              ])] : []),
            ]),
          ]),
          h("div", { class: classesOf("actions"), role: roleOf("actions") }, [
            h("button", { type: "button", class: classesOf("modeToggle") }, "Clock"),
            h("button", {
              type: "button", class: classesOf("action"),
              onClick: () => controller.dispatch({ type: "cancel" }),
            }, "Cancel"),
            h("button", {
              type: "button", class: `${classesOf("action")} ${modifierOf("action", "confirm")}`,
              onClick: () => controller.dispatch({ type: "confirm" }),
            }, "OK"),
          ]),
        ]),
      ])]));

      children.push(h("p", {
        id: defaultWidgetIdFactory.part(props.widgetId, "description"),
        class: classesOf("supportingText"),
      }));

      // The list the description points at, and what is in it. Absent, `aria-describedby`
      // named an id no element had: a promise of an explanation, kept by nothing.
      if (parts.error !== undefined) children.push(drawErrors(parts.error, props.field, "timepicker"));

      return h("div", { class: rootClasses(CONTRACT, { touched: props.field.touched(), open: state.value.open }), ref: root, onKeydown }, children);
    };
  },
});
