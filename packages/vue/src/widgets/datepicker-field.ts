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
import { defineComponent, h, nextTick, onScopeDispose, shallowRef, triggerRef, watch, type PropType, type VNode } from "vue";
import {
  MDY_WIDGET_CONTRACTS,
  createDatepickerFieldController,
  defaultWidgetIdFactory,
} from "@modyra/widgets";
import { observerFor } from "@modyra/core";
import { buildDateLocale } from "@modyra/core/datetime";
import type { MdyFieldHandle } from "@modyra/core";
import { partProps } from "./part.js";

const CONTRACT = MDY_WIDGET_CONTRACTS.datepicker;
type MdyDeclaredPart = { readonly classes: readonly string[]; readonly role?: string | null };
const declared = CONTRACT.parts as Readonly<Record<string, MdyDeclaredPart | undefined>>;
const classesOf = (part: string): string => declared[part]?.classes.join(" ") ?? "";
/**
 * The role the contract gives a part, written where the part is drawn.
 *
 * Typed out by hand instead, a role is a copy that agrees with the contract until the contract
 * changes its mind — and the copy that disagrees is the one a person's screen reader believes.
 */
const roleOf = (part: string): string | undefined => declared[part]?.role ?? undefined;
/** Seven per week, and the calendar hands back six weeks of them. */
const DAYS_IN_WEEK = 7;

export const MdyDatepickerField = defineComponent({
  name: "MdyDatepickerField",
  props: {
    field: { type: Object as PropType<MdyFieldHandle<string | null>>, required: true },
    label: { type: String, default: "" },
    widgetId: { type: String, required: true },
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
    const state = shallowRef(controller.state());
    const view = shallowRef(controller.view());
    const watching = reactivity.effect(() => {
      state.value = controller.state();
      view.value = controller.view();
      triggerRef(state);
      triggerRef(view);
    });
    onScopeDispose(() => { watching.destroy(); controller.destroy(); });

    /**
     * The weekday headers, turned to start where the locale's week starts.
     *
     * `dayNamesNarrow` is Sunday-first whatever the locale, and the grid's first cell is the
     * locale's `firstDayOfWeek`. Reading the names straight through therefore agrees with the cells
     * only where the week already starts on Sunday — correct in English and wrong in most places,
     * with every column labelled a day out and nothing to show for it but a calendar that reads
     * wrong.
     */
    const weekdayLabels = (): readonly string[] => {
      const names = dateLocale.dayNamesNarrow;
      const first = dateLocale.firstDayOfWeek;
      return names.map((_, column) => names[(column + first) % names.length]);
    };

    /**
     * Focus follows the reading position, not just the opening.
     *
     * The calendar answers an arrow by moving which cell is the tab stop, and that is the whole of
     * what the contract can do: moving the *focus* is the renderer's half of the same act. Watching
     * only the opening leaves a calendar whose `tabindex` walks and whose focus does not — the grid
     * looks right, arrows appear to work to anyone reading the markup, and a person using a screen
     * reader is told nothing at all, because focus never left the day they started on.
     */
    watch(() => [state.value.open, state.value.focusedDate], async ([open, focused]) => {
      if (open !== true || typeof focused !== "string") return;
      // The cell has to be drawn before it can take focus, and the controller's signals reach the
      // renderer a beat after the dispatch.
      await nextTick();
      const target = document.getElementById(defaultWidgetIdFactory.item(props.widgetId, "day", focused));
      if (target instanceof HTMLElement && target !== document.activeElement) target.focus();
    }, { immediate: true });

    const onKeydown = (event: KeyboardEvent): void => {
      const before = state.value.open;
      controller.dispatch({
        type: "keydown",
        key: event.key,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
      });
      // Tab keeps its meaning: this panel holds nothing worth staying for, so it closes and the
      // browser moves on. Every other key the calendar answered is consumed, or it acts twice.
      if (event.key === "Tab") return;
      if (before !== state.value.open || before) event.preventDefault();
    };

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
          type: "text",
          value: state.value.entryText,
          // Handed over as typed. What a date looks like is the contract's question.
          onChange: (event: Event) =>
            controller.dispatch({ type: "type", text: (event.target as HTMLInputElement).value }),
        })),
        h("button", {
          type: "button",
          class: classesOf("toggle"),
          "aria-expanded": String(state.value.open),
          "aria-label": props.label === "" ? "Choose date" : `Choose ${props.label}`,
          onClick: () => controller.dispatch(state.value.open ? { type: "close" } : { type: "open" }),
        }),
      ]));

      {
        const weeks: VNode[] = [];
        for (let start = 0; start < cells.length; start += DAYS_IN_WEEK) {
          weeks.push(h("div", { class: classesOf("row"), role: roleOf("row") },
            cells.slice(start, start + DAYS_IN_WEEK).map((cell) =>
              h("button", partProps(parts[cell.iso], {
                type: "button",
                class: classesOf("gridcell"),
                onClick: () => controller.dispatch({ type: "select-date", iso: cell.iso }),
              }), String(cell.day)))));
        }

        // The grid stays in the document when the calendar is shut: the control names it with
        // `aria-controls` on every render, and a grid that is removed leaves that pointing at
        // nothing.
        children.push(h("div", { class: classesOf("popup"), hidden: !state.value.open }, [
          h("div", { class: classesOf("calendar"), role: roleOf("calendar") }, [
            h("div", partProps(parts.grid, { class: classesOf("grid") }), [
              h("div", { class: classesOf("weekdays"), role: roleOf("weekdays") },
                weekdayLabels().map((name) =>
                  h("span", { class: classesOf("weekday"), role: roleOf("weekday") }, name))),
              ...weeks,
            ]),
          ]),
        ]));
      }

      children.push(h("p", {
        id: defaultWidgetIdFactory.part(props.widgetId, "description"),
        class: classesOf("supportingText"),
      }));

      return h("div", { class: CONTRACT.rootClasses.join(" "), onKeydown }, children);
    };
  },
});
