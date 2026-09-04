/**
 * The calendar two kinds draw the same way.
 *
 * A date field and a range field disagree about their controls — one box or two with a separator
 * between them — and agree about everything below the panel: the same grid, the same six weeks of
 * seven cells, the same reading position moved by the same keys. Written twice, the two would agree
 * until the first time only one of them was changed.
 *
 * Not exported from this package. It is the shape these components share, and a published name
 * nobody outside can exercise is surface that has to be kept without ever being checked.
 */
import { Teleport, h, nextTick, watch, type Ref, type VNode } from "vue";
import { MDY_WIDGET_CONTRACTS, defaultWidgetIdFactory,
  keyBindingFor,
  type MdyWidgetKind,
} from "@modyra/widgets";
import type { MdyPartContract } from "@modyra/widgets";
import type { MdyDateLocale } from "@modyra/core/datetime";
import { partProps, type MdyDeclaredPart } from "./part.js";

/** Seven per week, and the calendar hands back six weeks of them. */
const DAYS_IN_WEEK = 7;

type MdyCalendarKind = "datepicker" | "daterange";
interface MdyCalendarCell {
  readonly iso: string;
  readonly day: number;
}
type MdyProjectedParts = Readonly<Record<string, MdyPartContract | undefined>>;

const partsOf = (kind: MdyCalendarKind): Readonly<Record<string, MdyDeclaredPart | undefined>> =>
  MDY_WIDGET_CONTRACTS[kind].parts as Readonly<Record<string, MdyDeclaredPart | undefined>>;

export const calendarClassesOf = (kind: MdyCalendarKind, part: string): string =>
  partsOf(kind)[part]?.classes.join(" ") ?? "";

/**
 * The role the contract gives a part, written where the part is drawn.
 *
 * Typed out by hand instead, a role is a copy that agrees with the contract until the contract
 * changes its mind — and the copy that disagrees is the one a person's screen reader believes.
 */
export const calendarRoleOf = (kind: MdyCalendarKind, part: string): string | undefined =>
  partsOf(kind)[part]?.role ?? undefined;

/**
 * The weekday headers, turned to start where the locale's week starts.
 *
 * `dayNamesNarrow` is Sunday-first whatever the locale, and the grid's first cell is the locale's
 * `firstDayOfWeek`. Read straight through, the names therefore agree with the cells only where the
 * week already starts on Sunday — correct in English and wrong in most places, with every column
 * labelled a day out and nothing to show for it but a calendar that reads wrong.
 */
export const weekdayLabels = (locale: MdyDateLocale): readonly string[] => {
  const names = locale.dayNamesNarrow;
  return names.map((_name: string, column: number) => names[(column + locale.firstDayOfWeek) % names.length]);
};

/**
 * Focus follows the reading position, not only the opening.
 *
 * The calendar answers an arrow by moving which cell is the tab stop, and that is the whole of what
 * a contract can do: moving the *focus* is the renderer's half of the same act. Watching only the
 * opening leaves a calendar whose `tabindex` walks and whose focus does not — the grid looks right,
 * the arrows appear to work to anyone reading the markup, and a person using a screen reader is
 * told nothing at all, because focus never left the day they started on.
 */
export const followTheReadingPosition = (
  widgetId: string,
  read: () => { readonly open: boolean; readonly focusedDate: string },
): void => {
  watch(() => [read().open, read().focusedDate], async ([open, focused]) => {
    if (open !== true || typeof focused !== "string") return;
    // The cell has to be drawn before it can take focus, and the controller's signals reach the
    // renderer a beat after the dispatch.
    await nextTick();
    const target = document.getElementById(defaultWidgetIdFactory.item(widgetId, "day", focused));
    if (target instanceof HTMLElement && target !== document.activeElement) target.focus();
  }, { immediate: true });
};

/**
 * The panel, drawn whether it is showing or not.
 *
 * The control names the grid with `aria-controls` on every render, so the grid has to exist while
 * the panel is shut: removed on close, it leaves that reference pointing at nothing.
 */
export const drawCalendar = (options: {
  readonly kind: MdyCalendarKind;
  readonly open: boolean;
  readonly cells: readonly MdyCalendarCell[];
  readonly parts: MdyProjectedParts;
  readonly locale: MdyDateLocale;
  readonly onPick: (iso: string) => void;
  readonly onPreview?: (iso: string | null) => void;
  /** The id whatever opens this panel points `aria-controls` at, where it names the panel itself. */
  readonly popupId?: string;
  /** Where the drawn panel lands, so it can be measured and placed against its control. */
  readonly panel?: Ref<HTMLElement | null>;
  /**
   * The field's key handler, attached to the panel as well as to the field.
   *
   * A teleported panel bubbles its events through the document, not through the field it belongs
   * to, so a handler that sits only on the field stops hearing every key pressed inside the panel —
   * silently, and only once the panel has been moved out.
   */
  readonly onKeydown?: (event: KeyboardEvent) => void;
}): VNode => {
  const { kind, cells, parts } = options;
  const cls = (part: string): string => calendarClassesOf(kind, part);
  const role = (part: string): string | undefined => calendarRoleOf(kind, part);

  const weeks: VNode[] = [];
  for (let start = 0; start < cells.length; start += DAYS_IN_WEEK) {
    weeks.push(h("div", { class: cls("row"), role: role("row") },
      cells.slice(start, start + DAYS_IN_WEEK).map((cell) =>
        h("button", partProps(parts[cell.iso], {
          type: "button",
          class: cls("gridcell"),
          onClick: () => options.onPick(cell.iso),
          // A range shows what it would take before it takes it, and that answer belongs to the
          // contract: the renderer reports where the pointer is and draws what comes back.
          ...(options.onPreview === undefined ? {} : {
            onMouseenter: () => options.onPreview?.(cell.iso),
            onMouseleave: () => options.onPreview?.(null),
          }),
        }), String(cell.day)))));
  }

  // Out of the field, against the control. Inside, a calendar inherits the `overflow` and the
  // stacking of every ancestor, and one clipped by a scrolling pane loses the rows a person is
  // reaching for. ADR 0130.
  return h(Teleport, { to: "body" }, [h("div", {
    class: cls("popup"),
    hidden: !options.open,
    ...(options.panel === undefined ? {} : { ref: options.panel }),
    ...(options.onKeydown === undefined ? {} : { onKeydown: options.onKeydown }),
    ...(options.popupId === undefined ? {} : { id: options.popupId }),
  }, [
    h("div", { class: cls("calendar"), role: role("calendar") }, [
      h("div", partProps(parts.grid, { class: cls("grid") }), [
        h("div", { class: cls("weekdays"), role: role("weekdays") },
          weekdayLabels(options.locale).map((name) =>
            h("span", { class: cls("weekday"), role: role("weekday") }, name))),
        ...weeks,
      ]),
    ]),
  ])]);
};

/**
 * Forwards a press to whichever calendar is asking, and consumes it if the calendar answered.
 *
 * The key is not interpreted here. Both controllers take a `keydown` intent and decide what the
 * press means, which is why a press means the same thing in every adapter — and why the platform's
 * accelerator has to travel with it: `Cmd`+ArrowDown reaches the end of a document in half the
 * products people use, and a calendar reading it as a bare arrow moves a date under a hand that was
 * aiming somewhere else.
 *
 * Tab is the exception, and it is the contract's exception rather than this file's: neither of these
 * panels holds an action of its own, so Tab closes the panel and is left to the browser. Swallowing
 * it would make the field a place a person can enter and not leave.
 */
export const forwardCalendarKeys = (
  kind: MdyWidgetKind,
  isOpen: () => boolean,
  dispatch: (press: {
    readonly type: "keydown";
    readonly key: string;
    readonly shiftKey: boolean;
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
  }) => void,
) => (event: KeyboardEvent): void => {
  /**
   * A key declared on a part belongs to that part.
   *
   * This handler serves both the field and the panel, and it forwarded everything: a key the
   * catalogue declares `on: "gridcell"` was taken from the control as well. `Space` is that key —
   * it commits the day a calendar is on, and on the field it means nothing the contract states, so
   * pressing it there consumed the press and closed the panel.
   *
   * Inside the panel every declared key is the calendar's, and the press is forwarded. Outside it,
   * only what the widget itself declares is taken; `.mdy-popup` is the primitive class every popup
   * part carries, so this asks where the press came from rather than naming a kind's own panel.
   */
  const target = event.target;
  const insidePanel = target instanceof Element && target.closest(".mdy-popup") !== null;
  if (!insidePanel && keyBindingFor(kind, event, isOpen()) === null) return;

  const before = isOpen();
  dispatch({
    type: "keydown",
    key: event.key,
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
  });
  if (event.key === "Tab") return;
  // Consumed when the calendar was open to answer it, or when the press opened it: anything else
  // was aimed past this field and acts twice if taken here too.
  if (before !== isOpen() || before) event.preventDefault();
};
