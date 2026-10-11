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

## Security and privacy

None. This is view state inside a field's popup. No data crosses a boundary, and no value is
committed by any of the three intents.
