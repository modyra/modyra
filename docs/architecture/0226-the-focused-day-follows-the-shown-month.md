# ADR 0226: The focused day follows the month a calendar shows

Status: Accepted

## Context

A datepicker's or date range's day grid uses a roving tab index. Exactly one cell takes Tab, and it
is the cell whose date equals the controller's `focusedDate`. The arrows move `focusedDate` and bring
the shown month along with it (`moveCalendarFocus`). Three intents move the shown month the other way:
paging with the header buttons (`navigate-month`), choosing a month (`select-month`) and choosing a
year (`select-year`). None of them moved `focusedDate`. After any of them, the focused day could sit
in a month no longer shown. Then no cell in the grid carried a tab stop, and the days could be reached
only with a pointer. Renderers covered for this with their own fallback landings, such as the first
choosable cell, which could be an outside day of the previous month. Those fallbacks only acted when a
renderer happened to move focus itself.

Separately, choosing a year from the keyboard narrows to the month view. The year view is hidden or
torn down in that render, so focus on the pressed year was lost. Lit put the keyboard on the months.
Plain, Vue and Angular dropped it to the document.

The choice of where the focused day goes was put to TypeSafe on 2026-10-11, with three options. The
first moves it on all three intents. The second leaves the state alone and only lets the rendered tab
stop follow the view. The third moves it on month and year picks but not on paging. TypeSafe chose the
first at 97%, against 1% and 2%. The accessibility consultant (`esecutore2`) was not available on the
agent network, so no outside reading of published practice was taken on where focus lands after a
year pick. That question is open, not settled.

## Decision

`focusedDate` follows the shown month in the datepicker and date-range controllers. On
`navigate-month`, `select-month` and `select-year`, the controller shows the new month and sets
`focusedDate` to:

1. the selected day, if it falls in the shown month (for a range, the draft's start, then its end);
2. otherwise, the same day number the focus had, clamped to the shown month's length (the 31st paged
   into February is the 28th).

The rule is one function in `@modyra/widgets` (`showCalendarMonth`, next to `moveCalendarFocus`). It
is internal and not exported. Both controllers call it.

When a year is chosen while the keyboard is on the year view, every renderer moves focus onto the
month view: the shown month, or the first month the bounds allow. A step between views keeps the
landing it already had.

## Consequences

- The day grid shown after any change of month has exactly one tab stop, inside that month. The
  renderers' "first choosable cell" fallbacks no longer fire on these paths. They remain as guards.
- A host reading `state().focusedDate` now sees it change on the three intents where it used to stay.
  `contract:diff` classifies this as patch, because no part, relation or key changed. The changeset
  says so.
- Paging forward and back can change the focused day: the 31st paged to February and back lands on
  the 28th, unless the 31st is the selected day. This is the cost of clamping instead of keeping an
  out-of-month position. Keeping one is what produced the missing tab stop.
- Each renderer carries its own small landing after a year pick: Lit in `updated`, Plain on the
  year button's click, Vue in a post-flush watcher, Angular in `afterNextRender`. These are four
  bodies of one rule. The rule cannot be a widgets command until the contract has a focus command for
  "the view you narrowed to".

## Alternatives rejected

- **Only the rendered tab stop follows the view (state unchanged).** Each renderer would compute the
  fallback stop itself. That is the divergence this record removes, and `focusedDate` would keep
  naming a cell that is not on screen.
- **Follow on picks but not on paging.** Paging with the header buttons strands the tab stop in the
  same way. A rule with a hole in it would be asked about again the first time someone pages and
  Tabs.
- **Land on the first of the month.** This loses the day the person was reading, and it differs from
  how the arrows carry the day across a month boundary.

## Verification

- `packages/widgets/test/a-shown-month-keeps-a-tab-stop.spec.mjs`: for both kinds and all three
  intents, exactly one tab stop exists and it is inside the shown month. It also checks the clamping
  and the return to the selected day. With the fix reverted, 14 of its 16 tests fail.
- `battle-tests/browser/a-view-escape-leaves-first.spec.ts`, case "choosing a year from the keyboard
  leaves the keyboard on the months": on all four hosts, focus lands on the months after Enter on a
  year. After Enter on a month, the grid has one tab stop and holds the keyboard. With the controller
  fix reverted, all four fail on the tab-stop assertion. Verified on Chromium only.
- Not guarded: whether a pointer click on a year also lands on the months. It does in Lit and Vue,
  and in Plain and Angular wherever the browser focuses a clicked button. This is not asserted either
  way.

## Amendment, 2026-10-11: paging keeps the keyboard on the button

Because `focusedDate` now moves on `navigate-month`, a renderer that answers a new focused day by
focusing its cell takes the keyboard off Next or Previous on the first press. The second press then
lands in the grid. Measured on Chromium with a click, all four renderers did this after Next and
Previous. On the base commit, Previous already did it whenever the open day stayed drawn as an
outside day of the earlier month.

Rule: in the day view, a new focused day takes the keyboard only when no visible control of the
calendar outside the grid holds it. A control the render has just hidden, such as a year that was
chosen, holds nothing. The render that brings the days back from the months or years takes the
keyboard as it did before, in the renderers that already took it there. Each renderer carries the
check next to its own landing: Plain in its render, Vue in `followTheReadingPosition`, Lit in
`heldOffTheDays` (`updated`), Angular in `heldOffTheDays` (`afterNextRender`).

Verification: `battle-tests/browser/a-page-turn-keeps-the-button.spec.ts` presses Next and Previous
twice on every host. After each press the keyboard is still on the button, and the grid has exactly
one visible tab stop. All 8 cases pass with the rule and all 8 fail without it. Chromium only, and
the press is a click. A keyboard press is not asserted, because Enter and Space on these buttons
already misbehave in Vue, Angular and Lit on the base commit, for reasons unrelated to this rule.

## Amendment, 2026-10-11: the day keys are the grid's

The keyboard cases left out above. In Lit, Vue and Angular the calendar's key listener covers the
whole panel, header included. Enter or Space on Next was therefore read as a day key: its default (the
button's click) was prevented, so the page did not turn, and the focused day was committed, so the
popup closed. Measured on Chromium on the base commit, 12 of the 16 datepicker keyboard cases failed,
11 of them because the popup closed. Plain passed because it listens on the grid only.

Rule: the keys that move and commit a day (arrows, paging keys, Home/End, Enter, Space) reach the
controller only when pressed inside the day grid. Elsewhere in the panel a press keeps its native
meaning, with three exceptions that are unchanged: Escape, Tab (where a renderer already forwarded
it) and the step between views. This is the rule Vue already applied to the month and year views,
extended to the header. Lit gates the day section of `calendarGridKey`, Vue `forwardCalendarKeys`,
and Angular both calendars' `onKeydown` through `withinTheGrid`.

One consequence is visible: an arrow pressed on a header button no longer moves the focused day,
which matches Plain.

Verification: `a-page-turn-keeps-the-button.spec.ts` presses Enter and Space twice on Next and
Previous of a datepicker and a daterange on every host. The popup stays open, the page turns, the
grid keeps one tab stop and the keyboard stays on the button. 32 cases pass with the rule. Reverting
it in Lit and in Angular's range calendar alone turned exactly those 12 cases red (8 Lit, 4 Angular
daterange). Chromium only.

Not changed: Tab from a header button. In Lit it is a panel-wide dismissal and closes the popup.

## Amendment, 2026-10-12: the title that brings the days back lands on the day

The first amendment left the return from the months or years "as it did before, in the renderers
that already took it there". That covered choosing a month and Escape, which land on the day in every
renderer. It did not cover the third way back, the header title. Measured on Chromium on the base
commit (`battle-tests/browser/the-title-returns-to-the-days.spec.ts`, click and Enter): Lit (datepicker
and daterange) and the Plain datepicker landed on the day. The Plain daterange, Vue and Angular left
the keyboard on the title, which failed 10 of 16 cases.

Rule: the render that brings the days back from the months or years puts the keyboard on the grid's
tab stop, whichever control brought them back, including the title. The title that leaves the days
for the years keeps the keyboard, as before. Plain's daterange lands in its render, as its datepicker
already did. Vue's `followTheReadingPosition` lifts the held-control guard on the render whose
previous view was not the days. Angular's `onToggleView` lands with `afterNextRender(landOnTheDays)`
when the toggle reaches the days and the calendar held the keyboard.

Why not the opposite: the title is still on screen after the toggle, and the paging rule above keeps
the keyboard on a visible header control. The paging rule covers presses that stay in the day view,
where a person pressing Next again means another month. A return from another view is different: the
person went back to the days to choose one, and the other two ways back already land there. Leaving
the title holding focus would make it the only way back that costs a Tab. Asked through TypeSafe
`scegli` with both options stated: it chose landing on the day, 84% to 16%. That is a citation, not
the rationale above.

Verification: the spec presses the title twice, by click and by Enter, on a datepicker and a daterange
on every host. After the first press the years show and the keyboard is on the title. After the second
the days show and the keyboard is on a day. 16 cases pass with the rule. Reverting it in Vue and in
Angular's range calendar alone turned exactly those 6 cases red (4 Vue, 2 Angular daterange).
Chromium only.

## Security and privacy

None. This is view state inside a field's popup. No data crosses a boundary, and no value is
committed by any of the three intents.
