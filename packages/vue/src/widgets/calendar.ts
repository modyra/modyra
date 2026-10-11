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
import { MDY_WIDGET_CONTRACTS, calendarViewOnZoom, defaultWidgetIdFactory,
  keyBindingFor, partClasses, projectCalendarPeriodCellA11y, projectCalendarViewA11y,
  type MdyCalendarViewMode, presentationClass,
} from "@modyra/widgets";
import type { MdyDatepickerFieldCell, MdyDaterangeFieldCell, MdyPartContract } from "@modyra/widgets";
import { calendarYearRange, isMonthOutOfRange, isYearOutOfRange, type CalendarDate, type MdyDateLocale } from "@modyra/core/datetime";
import { partProps, type MdyDeclaredPart } from "./part.js";

/** Seven per week, and the calendar hands back six weeks of them. */
const DAYS_IN_WEEK = 7;

type MdyCalendarKind = "datepicker" | "daterange";
/** What a cell needs to be drawn, read from the cell both date controllers lay out. */
type MdyCalendarCell = Pick<MdyDatepickerFieldCell & MdyDaterangeFieldCell, "iso" | "day" | "disabled">;
type MdyProjectedParts = Readonly<Record<string, MdyPartContract | undefined>>;

const partsOf = (kind: MdyCalendarKind): Readonly<Record<string, MdyDeclaredPart | undefined>> =>
  MDY_WIDGET_CONTRACTS[kind].parts as Readonly<Record<string, MdyDeclaredPart | undefined>>;

export const calendarClassesOf = (kind: MdyCalendarKind, part: string): string =>
  partsOf(kind)[part]?.classes.join(" ") ?? "";

/** A presentation class the catalogue names — the header's furniture, drawn from the same table. */
const presentationOf = (kind: MdyCalendarKind, name: string): string =>
  presentationClass(kind, name) ?? "";

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
 *
 * Only the day view gives the days the focus. With the months or years on screen the grid is
 * hidden, and a press that moves the tab stop underneath it must not pull the focus off the button
 * a person is on into a cell nobody can see.
 */
export const followTheReadingPosition = (
  widgetId: string,
  read: () => { readonly open: boolean; readonly focusedDate: string; readonly mode: MdyCalendarViewMode },
): void => {
  watch(() => [read().open, read().focusedDate, read().mode], async ([open, focused, mode]) => {
    if (open !== true || typeof focused !== "string" || mode !== "days") return;
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
  /**
   * The month the grid is showing, and the ways out of it.
   *
   * The controller has held `viewMonth`, `viewYear` and `viewMode` all along, with the intents that
   * page a month and switch views. This renderer drew a panel of bare grids and never asked, so a
   * person saw a month with nothing saying which and could reach another only from the keyboard.
   * The anatomy is the catalogue's: three siblings, the middle one named for the act it performs.
   */
  readonly heading?: {
    readonly title: string;
    readonly headingId: string;
    readonly onPreviousMonth: () => void;
    readonly onNextMonth: () => void;
    readonly onToggleView: () => void;
    readonly previousLabel: string;
    readonly nextLabel: string;
    readonly toggleLabel: string;
  };
  /**
   * Which of the three views is showing, and what choosing in the other two asks of the controller.
   *
   * The months and the years replace the day grid rather than sitting beside it, so the header's
   * press lands somewhere a person can see. Both views are drawn whether they are showing or not:
   * an element that only exists while shown is one no theme and no test can name while it is not.
   * The year and month are the ones on screen, so a choice lands where the person was looking.
   */
  readonly view?: {
    readonly mode: MdyCalendarViewMode;
    readonly widgetId: string;
    readonly year: number;
    readonly month: number;
    readonly min: CalendarDate | null;
    readonly max: CalendarDate | null;
    readonly onPickMonth: (month: number) => void;
    readonly onPickYear: (year: number) => void;
  };
  readonly onPick: (iso: string) => void;
  readonly onPreview?: (iso: string | null) => void;
  /** The id whatever opens this panel points `aria-controls` at, where it names the panel itself. */
  readonly popupId?: string;
  /**
   * What the calendar is called, for the reader who lands in it.
   *
   * A `dialog` is one of the roles that must be named: unnamed it is announced as "dialog" and
   * nothing else, which is the first thing somebody using a screen reader meets when the panel
   * opens. The other three renderers name it after the field it belongs to and this one named it
   * nothing at all.
   */
  readonly name?: string;
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
  const pres = (name: string): string => presentationOf(kind, name);
  const mode: MdyCalendarViewMode = options.view?.mode ?? "days";
  // Paging belongs to the day view: in the other two the arrows would move a month nobody is
  // looking at.
  const inDays = mode === "days";

  const weeks: VNode[] = [];
  for (let start = 0; start < cells.length; start += DAYS_IN_WEEK) {
    weeks.push(h("div", { class: cls("row"), role: role("row") },
      cells.slice(start, start + DAYS_IN_WEEK).map((cell) =>
        h("button", partProps(parts[cell.iso], {
          type: "button",
          class: cls("gridcell"),
          // A day the limits refuse is a button that cannot be pressed, not one that ignores it.
          disabled: cell.disabled,
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
    h("div", {
      class: cls("calendar"),
      role: role("calendar"),
      ...(options.name === undefined || options.name === "" ? {} : { "aria-label": options.name }),
    }, [
      ...(options.heading === undefined ? [] : [h("div", { class: cls("dialogHeader") }, [
        h("button", {
          type: "button", class: `${pres("navButton")} ${pres("navButton")}--previous`, hidden: !inDays,
          "aria-label": options.heading.previousLabel, onClick: options.heading.onPreviousMonth,
        }),
        h("button", {
          type: "button", class: pres("viewToggle"),
          "aria-label": options.heading.toggleLabel, onClick: options.heading.onToggleView,
        }, [h("span", { class: pres("title"), id: options.heading.headingId }, options.heading.title)]),
        h("button", {
          type: "button", class: `${pres("navButton")} ${pres("navButton")}--next`, hidden: !inDays,
          "aria-label": options.heading.nextLabel, onClick: options.heading.onNextMonth,
        }),
      ])]),
      h("div", partProps(parts.grid, { class: cls("grid"), hidden: !inDays }), [
        h("div", { class: cls("weekdays"), role: role("weekdays") },
          weekdayLabels(options.locale).map((name) =>
            h("span", { class: cls("weekday"), role: role("weekday") }, name))),
        ...weeks,
      ]),
      ...(options.view === undefined ? [] : drawPeriodViews(kind, options.locale, options.view)),
    ]),
  ])]);
};

/**
 * The month and year views, drawn from the contract's projection: which cells there are, which is
 * chosen, which the bounds refuse and what each announces are its answers, not this renderer's.
 *
 * Only the view on screen holds cells. The years run to two centuries where no bound narrows them,
 * and two hundred buttons kept in a hidden view are two hundred buttons rebuilt on every render.
 */
const drawPeriodViews = (
  kind: MdyCalendarKind,
  locale: MdyDateLocale,
  view: NonNullable<Parameters<typeof drawCalendar>[0]["view"]>,
): VNode[] => (["months", "years"] as const).map((own) => {
  const shown = view.mode === own;
  const values = !shown ? [] : own === "months"
    ? Array.from({ length: 12 }, (_, index) => index + 1)
    : [...calendarYearRange(view.year, view.min, view.max)];
  const current = own === "months" ? view.month : view.year;
  return h("div", partProps(projectCalendarViewA11y(own, { kind, widgetId: view.widgetId }) ?? undefined, { hidden: !shown }),
    values.map((value) => {
      const label = own === "months" ? (locale.monthNamesShort[value - 1] ?? String(value)) : String(value);
      return h("button", partProps(projectCalendarPeriodCellA11y(own, {
        value,
        label,
        selected: value === current,
        disabled: own === "months"
          ? isMonthOutOfRange(view.year, value, view.min, view.max)
          : isYearOutOfRange(value, view.min, view.max),
      }, { kind, widgetId: view.widgetId }), {
        type: "button",
        onClick: () => (own === "months" ? view.onPickMonth(value) : view.onPickYear(value)),
      }), label);
    }));
});

/**
 * The chosen year, brought into sight when the years open.
 *
 * The run is two centuries long where nothing bounds it, and it opens scrolled to its top: without
 * this, a person who pressed the header to change the year meets 1926 and has to hunt for the one
 * they were on.
 *
 * And the keyboard, when a chosen year narrows to its months. The years hold no cells once hidden, so
 * focus on the pressed year falls to the page; it lands on the shown month, or the first the bounds
 * allow. Only when the keyboard has left the calendar: a step between views lands on its own, and a
 * landing taken regardless would pull focus back from wherever it went.
 */
export const followTheChosenYear = (
  kind: MdyCalendarKind,
  widgetId: string,
  read: () => { readonly open: boolean; readonly mode: MdyCalendarViewMode },
): void => {
  watch(() => [read().open, read().mode], async ([open, mode]) => {
    if (open !== true || mode !== "years") return;
    await nextTick();
    const host = document.getElementById(`${widgetId}__years`);
    // Guarded: a document without layout has no `scrollIntoView`.
    host?.querySelector<HTMLElement>(`.${partClasses(kind, "yearCell", { selected: true }).join(".")}`)
      ?.scrollIntoView?.({ block: "center" });
  });
  watch(() => read().mode, (mode, was) => {
    if (!read().open || mode !== "months" || was !== "years") return;
    const host = document.getElementById(`${widgetId}__months`);
    const panel = host?.parentElement;
    const active = document.activeElement;
    if (panel == null || (active !== null && active !== document.body && panel.contains(active))) return;
    (host?.querySelector<HTMLElement>('[aria-selected="true"]:not([disabled])')
      ?? host?.querySelector<HTMLElement>("button:not([disabled])"))?.focus();
  }, { flush: "post" });
};

/**
 * Steps between the three views on the key the catalogue declares for it, and back to the days on a
 * dismissal, and answers whether the press was one of those.
 *
 * The controllers hold the view but leave a press with the accelerator held unanswered, so the step
 * is the renderer's to take. It is asked from every view, not only the days: two of the three views
 * are not the grid, and a step answered only there would work once and then be stuck in the view it
 * reached.
 *
 * The keyboard follows the eye. The view a step leaves is hidden, and focus left there sits on an
 * element in no accessibility tree, so focus lands on the chosen cell of the view reached, or its
 * first choosable one, once that view is drawn: a view only holds cells while it is shown. Only a
 * step moves the focus — a header press leaves it on the header, which stays on screen — and the days
 * are `followTheReadingPosition`'s to focus.
 */
export const stepBetweenViews = (
  kind: MdyCalendarKind,
  widgetId: string,
  read: () => { readonly open: boolean; readonly mode: MdyCalendarViewMode },
  show: (mode: MdyCalendarViewMode) => void,
): ((event: KeyboardEvent) => boolean) => {
  let landingIn: MdyCalendarViewMode | null = null;
  watch(() => read().mode, (mode) => {
    // Disarmed by any change of view, so a step overtaken by a header press lands nowhere later.
    const stepped = mode === landingIn;
    landingIn = null;
    if (!stepped) return;
    // The days are a grid with one tab stop; the months and years are buttons, one of them chosen.
    // Either may be off screen — a year chosen elsewhere shows a month without the day being read —
    // and the first choosable cell is then where the keyboard can start.
    const host = document.getElementById(`${widgetId}__${mode === "days" ? "grid" : mode}`);
    const landing = host?.querySelector<HTMLElement>(mode === "days" ? '[tabindex="0"]' : '[aria-selected="true"]:not([disabled])')
      ?? host?.querySelector<HTMLElement>("button:not([disabled])");
    landing?.focus();
  }, { flush: "post" });
  return (event) => {
    const { open, mode } = read();
    if (!open) return false;
    const step = keyBindingFor(kind, event, true);
    // A dismissal that keeps the key leaves the view it is in: a month or year view gives way to the
    // days, and only the days give way to a closed panel. `Tab` is a dismissal too, but it carries
    // the keyboard onward and is not this view's to take.
    if (step?.intent === "cancel" && step.restoresFocus === true && mode !== "days") {
      event.preventDefault();
      landingIn = "days";
      show("days");
      return true;
    }
    if (step?.intent !== "view" || step.by === undefined) return false;
    event.preventDefault();
    const reached = calendarViewOnZoom(mode, step.by);
    if (reached !== mode) {
      landingIn = reached;
      show(reached);
    }
    return true;
  };
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
  kind: MdyCalendarKind,
  isOpen: () => boolean,
  dispatch: (press: {
    readonly type: "keydown";
    readonly key: string;
    readonly shiftKey: boolean;
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
  }) => void,
  /** The step between views, answered before anything else so it reaches every view. */
  stepView?: (event: KeyboardEvent) => boolean,
) => (event: KeyboardEvent): void => {
  if (stepView?.(event) === true) return;
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
  /**
   * A month or a year is a native button, and its keys are the button's.
   *
   * The calendar's keys move and commit the days. Taken from a month or year, Enter and Space
   * would be read as committing the day underneath and their default — the click that chooses the
   * period — prevented, leaving those views reachable from the keyboard and choosable by nobody.
   * Escape from there is `stepView`'s, and has already been answered by the time a press gets here.
   */
  const inPeriodView = target instanceof Element && (["monthPicker", "yearPicker"] as const)
    .some((part) => target.closest(`.${partClasses(kind, part).join(".")}`) !== null);
  if (inPeriodView && event.key !== "Escape") return;

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
