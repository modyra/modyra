/**
 * The date range: two boxes with a separator between them, and the calendar both of them fill.
 *
 * Everything below the panel is the date field's — the same grid, the same six weeks, the same
 * reading position moved by the same keys — and it is drawn by the same code rather than a second
 * copy that would agree until only one of them was changed.
 *
 * What is this kind's own is that a choice takes two presses. The contract carries which end is
 * being picked and what the range would become, so the renderer reports where the pointer is and
 * draws what comes back: a preview computed here would be a second answer to a question the
 * contract already answers, and the two would differ at the edges — the day before the start, a
 * range picked backwards — which is exactly where a person notices.
 */
import { defineComponent, h, onScopeDispose, ref, shallowRef, triggerRef, type PropType, type VNode } from "vue";
import {
  MDY_WIDGET_CONTRACTS,
  createDaterangeFieldController,
  defaultWidgetIdFactory,
} from "@modyra/widgets";
import type { MdyDateRangeValue } from "@modyra/widgets";
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
import { useMessages } from "./locale.js";

const CONTRACT = MDY_WIDGET_CONTRACTS.daterange;
const classesOf = (part: string): string => calendarClassesOf("daterange", part);

export const MdyDaterangeField = defineComponent({
  name: "MdyDaterangeField",
  props: {
    field: { type: Object as PropType<MdyFieldHandle<MdyDateRangeValue>>, required: true },
    label: { type: String, default: "" },
    widgetId: { type: String, required: true },
    locale: { type: String, default: "en" },
    separator: { type: String, default: "–" },
  },
  setup(props) {
    // The runtime the handle already owns. A second instance of the same factory is a different
    // owner and is refused the first's signals, with nothing rendered to show for it.
    const reactivity = observerFor(props.field);
    const dateLocale = buildDateLocale(props.locale);
    const controller = createDaterangeFieldController({
      handle: props.field,
      widgetId: props.widgetId,
      // One value, two readers: the grid the controller lays out and the headers drawn over it.
      firstDayOfWeek: dateLocale.firstDayOfWeek,
    }, reactivity);

    // The panel's state does not live on the field handle, so a `computed` over it would read
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
      kind: "daterange",
      root,
      panel,
      isOpen: () => state.value.open,
      close: () => run(controller.dispatch({ type: "close" })),
    });
    // The language this widget speaks: the document's choice if it made one, the page's otherwise.
    const messages = useMessages(() => props.locale);
    const view = shallowRef(controller.view());
    // What the controller answers is half of every interaction, and the half a screenshot does not
    // show: `restore-focus` after a dismissal is what puts the person back on the control they
    // opened. Dropped, the keyboard is left on nothing and the next Tab starts at the top of the page.
    const run = useCommands("daterange", view, root);
    const watching = reactivity.effect(() => {
      state.value = controller.state();
      view.value = controller.view();
      triggerRef(state);
      triggerRef(view);
    });
    onScopeDispose(() => { watching.destroy(); controller.destroy(); });

    useLightDismiss({
      kind: "daterange",
      root,
      isOpen: () => state.value.open,
      close: () => run(controller.dispatch({ type: "close" })),
    });

    useAnchoredPanel({ kind: "daterange", panel, anchor, isOpen: () => state.value.open });

    followTheReadingPosition(props.widgetId, () => ({
      open: state.value.open,
      focusedDate: state.value.focusedDate,
    }));

    const onKeydown = forwardCalendarKeys(
      "daterange",
      () => state.value.open,
      (press) => run(controller.dispatch(press)),
    );

    /** One end of the range. Both are the same box with a different name for which end it fills. */
    const entry = (end: "start" | "end"): VNode =>
      h("input", partProps(view.value.parts[`${end}Control`], {
        type: "text",
        onChange: (event: Event) =>
          run(controller.dispatch({ type: "type", end, text: (event.target as HTMLInputElement).value })),
      }));

    return () => {
      const parts = view.value.parts;
      const children: VNode[] = [];

      if (props.label !== "") {
        children.push(h("label", {
          id: defaultWidgetIdFactory.part(props.widgetId, "label"),
          // Read from the projection, never spelled here: the part is called `startControl` and its
          // id is `__start`, and a `for` built out of the part name points at nothing.
          for: parts.startControl?.id,
          class: classesOf("label"),
        }, props.label));
      }

      children.push(h("div", { class: classesOf("inputWrapper") }, [
        entry("start"),
        // Between the two boxes and read by nobody: what it means is already said by the two
        // controls having their own names, and a screen reader announcing "en dash" between them
        // says nothing a person needs.
        h("span", { class: classesOf("separator"), "aria-hidden": "true" }, props.separator),
        entry("end"),
        // The projection carries what this button owes: that it opens something, whether it is
        // open, the panel it names and the label it is named by. Written by hand it carried a
        // guess at three of them and the panel relation not at all.
        h("button", partProps(parts.toggle, {
          ref: anchor,
          type: "button",
          // The act, from the dictionary. Named by the field's caption instead, this door announced
          // itself as the field — and a range opener borrowing the calendar's message would say
          // "Toggle calendar" for something that is not one.
          "aria-label": messages.value.daterangeChooseRange,
          // A refusal that is announced and enforced: a toggle that keeps `aria-disabled` while
          // staying pressable opens a panel over a field the model has taken out of play.
          disabled: props.field.disabled(),
          "aria-disabled": String(props.field.disabled()),
          onClick: () => run(controller.dispatch(state.value.open ? { type: "close" } : { type: "open" })),
        })),
      ]));

      children.push(drawCalendar({
        kind: "daterange",
        panel,
        onKeydown,
        open: state.value.open,
        cells: state.value.cells,
        parts,
        locale: dateLocale,
        onPick: (iso) => run(controller.dispatch({ type: "select-date", iso })),
        onPreview: (iso) => run(controller.dispatch({ type: "preview", iso })),
        popupId: defaultWidgetIdFactory.part(props.widgetId, "popup"),
      }));

      children.push(h("p", {
        id: defaultWidgetIdFactory.part(props.widgetId, "description"),
        class: classesOf("supportingText"),
      }));

      // The list the description points at, and what is in it. Absent, `aria-describedby`
      // named an id no element had: a promise of an explanation, kept by nothing.
      if (parts.error !== undefined) children.push(drawErrors(parts.error, props.field, "daterange"));

      return h("div", { class: rootClasses(CONTRACT, { touched: props.field.touched(), open: state.value.open }), ref: root, onKeydown }, children);
    };
  },
});
