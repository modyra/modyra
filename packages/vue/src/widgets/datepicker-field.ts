/**
 * The date field: a control you can type into, a button that opens a calendar, and the calendar.
 *
 * **The keyboard is not interpreted here.** The controller takes a `keydown` intent carrying the key
 * and whether the platform's accelerator was held, and answers it — which is why a press means the
 * same thing in every adapter, and why the accelerator has to be forwarded rather than dropped:
 * `Cmd`+ArrowDown reaches the end of a document in half the products people use, and a calendar that
 * reads the press as bare moves a date under a hand that was aiming elsewhere.
 *
 * Typed text is handed over unparsed for the same reason. A renderer that parses a date is a second
 * answer to a question the contract already answers, and two answers is how two renderers come to
 * disagree about what someone typed.
 */
import { defineComponent, h, onScopeDispose, ref, shallowRef, triggerRef, type PropType, type VNode } from "vue";
import {
  MDY_WIDGET_CONTRACTS,
  createDatepickerFieldController,
  defaultWidgetIdFactory,
  keyBindingFor,
} from "@modyra/widgets";
import { observerFor } from "@modyra/core";
import { buildDateLocale } from "@modyra/core/datetime";
import type { MdyFieldHandle } from "@modyra/core";
import { partProps, rootClasses } from "./part.js";
import { drawErrors } from "./errors.js";
import { useKeyboardInPlay } from "./keyboard-in-play.js";
import { useCloseWhenFieldLeaves } from "./field-teardown.js";
import { useDismissOnFocusOutside } from "./dismiss-on-focus-outside.js";
import { useOverlayOpen } from "./overlay-open.js";
import { useAnchoredPanel } from "./anchored-panel.js";
import { useLightDismiss } from "./light-dismiss.js";
import { calendarClassesOf, drawCalendar, followTheReadingPosition, forwardCalendarKeys } from "./calendar.js";
import { useCommands } from "./commands.js";

const CONTRACT = MDY_WIDGET_CONTRACTS.datepicker;
const classesOf = (part: string): string => calendarClassesOf("datepicker", part);

export const MdyDatepickerField = defineComponent({
  name: "MdyDatepickerField",
  props: {
    field: { type: Object as PropType<MdyFieldHandle<string | null>>, required: true },
    label: { type: String, default: "" },
    widgetId: { type: String, required: true },
    /** The name a control has when nothing on the page captions it. */
    ariaLabel: { type: String, default: "" },
    locale: { type: String, default: "en" },
  },
  setup(props) {
    // The runtime the handle already owns. A second instance of the same factory is a different
    // owner and is refused the first's signals, with nothing rendered to show for it.
    const reactivity = observerFor(props.field);
    // Month and weekday names, and where the week starts, come from Intl: a calendar that ships its
    // own names reads in one language on a page that has chosen another.
    const dateLocale = buildDateLocale(props.locale);
    const controller = createDatepickerFieldController({
      handle: props.field,
      widgetId: props.widgetId,
      // One value, two readers: the grid the controller lays out and the headers drawn over it. Left
      // unsaid, the cells start on Sunday whatever the page's language, and the headers above them
      // are then either wrong or right by the accident of the locale being English.
      firstDayOfWeek: dateLocale.firstDayOfWeek,
    }, reactivity);

    // The calendar's own state — which month is in view, where the reading position is, whether the
    // panel is open — does not live on the field handle, so a `computed` over it would read
    // correctly once and be stale from the second render on.
    // The panel is measured and placed against the control that opens it.
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
      kind: "datepicker",
      root,
      panel,
      isOpen: () => state.value.open,
      close: () => run(controller.dispatch({ type: "close" })),
    });
    const view = shallowRef(controller.view());
    // What the controller answers is half of every interaction, and the half a screenshot does not
    // show: `restore-focus` after a dismissal is what puts the person back on the control they
    // opened. Dropped, the keyboard is left on nothing and the next Tab starts at the top of the page.
    const run = useCommands("datepicker", view, root);
    const watching = reactivity.effect(() => {
      state.value = controller.state();
      view.value = controller.view();
      triggerRef(state);
      triggerRef(view);
    });
    onScopeDispose(() => { watching.destroy(); controller.destroy(); });

    useLightDismiss({
      kind: "datepicker",
      root,
      isOpen: () => state.value.open,
      close: () => run(controller.dispatch({ type: "close" })),
    });

    useAnchoredPanel({ kind: "datepicker", panel, anchor, isOpen: () => state.value.open });

    followTheReadingPosition(props.widgetId, () => ({
      open: state.value.open,
      focusedDate: state.value.focusedDate,
    }));

    const onKeydown = forwardCalendarKeys(
      "datepicker",
      () => state.value.open,
      (press) => run(controller.dispatch(press)),
    );

    return () => {
      const parts = view.value.parts;
      const cells = state.value.cells;
      const children: VNode[] = [];

      if (props.label !== "") {
        children.push(h("label", {
          id: defaultWidgetIdFactory.part(props.widgetId, "label"),
          for: defaultWidgetIdFactory.part(props.widgetId, "trigger"),
          class: classesOf("label"),
        }, props.label));
      }

      children.push(h("div", { class: classesOf("inputWrapper") }, [
        // The projection calls this part the trigger and gives it everything the contract asks of
        // the control: the combobox role, the relation to the grid it opens, and the one to the
        // description. Written by hand instead, it carried none of them.
        h("input", partProps(parts.trigger, {
          // The name, where nothing on the page captions the control. The projection names a
          // control against a caption that exists; this is the other case, and without it a
          // captionless control is announced as nothing at all.
          ...(props.ariaLabel === "" ? {} : { "aria-label": props.ariaLabel }),
          type: "text",
          value: state.value.entryText,
          // Handed over as typed. What a date looks like is the contract's question.
          onChange: (event: Event) =>
            run(controller.dispatch({ type: "type", text: (event.target as HTMLInputElement).value })),
          // The door the contract names first. `MDY_POPUP_OPENERS` declares the *control* as this
          // kind's opener and the toggle beside it as a second way in; drawn without a handler, the
          // declared one was dead and a person pressing the field got nothing.
          onClick: () => { if (!state.value.open) run(controller.dispatch({ type: "open" })); },
          // And by key, because a control that only opens under a pointer is one a keyboard cannot
          // reach the calendar through at all. Which key is the contract's answer, not a list here.
          onKeydown: (event: KeyboardEvent) => {
            if (state.value.open) return;
            // Asked *at the part*: this kind declares the key `on: "control"`, and a binding
            // declared on a part is invisible from the widget. Asked without it, the lookup
            // finds nothing and the keyboard never reaches the panel.
            const binding = keyBindingFor("datepicker", event, false, "control");
            if (binding?.intent !== "open") return;
            event.preventDefault();
            // And stopped here. The root forwards keys to the panel once it is open, and this press
            // would arrive there in the same turn — opening and then being read as a move inside the
            // panel it just opened, which left the widget shut again.
            event.stopPropagation();
            run(controller.dispatch({ type: "open" }));
          },
        })),
        h("button", {
          ref: anchor,
          // A refusal that is announced and enforced: a toggle that keeps `aria-disabled` while
          // staying pressable opens a panel over a field the model has taken out of play.
          disabled: props.field.disabled(),
          "aria-disabled": String(props.field.disabled()),
          type: "button",
          class: classesOf("toggle"),
          "aria-expanded": String(state.value.open),
          "aria-label": props.label === "" ? "Choose date" : `Choose ${props.label}`,
          onClick: () => run(controller.dispatch(state.value.open ? { type: "close" } : { type: "open" })),
        }),
      ]));

      children.push(drawCalendar({
        kind: "datepicker",
        panel,
        onKeydown,
        open: state.value.open,
        cells,
        parts,
        locale: dateLocale,
        onPick: (iso) => run(controller.dispatch({ type: "select-date", iso })),
      }));

      children.push(h("p", {
        id: defaultWidgetIdFactory.part(props.widgetId, "description"),
        class: classesOf("supportingText"),
      }));

      // The list the description points at, and what is in it. Absent, `aria-describedby`
      // named an id no element had: a promise of an explanation, kept by nothing.
      if (parts.error !== undefined) children.push(drawErrors(parts.error, props.field, "datepicker"));

      return h("div", { class: rootClasses(CONTRACT, { touched: props.field.touched(), open: state.value.open }), ref: root, onKeydown }, children);
    };
  },
});
