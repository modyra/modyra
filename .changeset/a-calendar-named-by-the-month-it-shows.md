---
"@modyra/widgets": major
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": major
"@modyra/vue": minor
---

The calendar grid is named by the month it shows, and the header is anatomy the contract can see

**What a calendar is called (ADR 0212).** The day grid of a date and a date-range field is named by
referring to the visible heading that says the month — `aria-labelledby` to the title, one copy of
the text on the page — and by nothing else. It used to be named four different ways across the
renderers, and where a written label sat beside a reference the reference won the name computation
and the caption a renderer had computed reached nobody. `datepickerFieldPartIds` and
`daterangeFieldPartIds` gain `headingId`; the projected grid points at it.

**The header is declared.** `headerPrevious`, `viewToggle`, `headerTitle` and `headerNext` are parts
of `datepicker` and `daterange`, in that order inside `dialogHeader`, with the title *inside* the
view toggle: the toggle carries a name of its own ("change view, currently …"), so a reference
crossing into the button would name the grid with the way out. The two nav buttons carry a modifier
naming their direction (`--previous`, `--next`) because a part lookup cannot tell two parts apart by
a class they both carry. `mdy-datepicker__header-label` and `mdy-datepicker__header-nav` are no
longer emitted by any renderer; the header's children are three sibling buttons.

**An act a key already performs does not keep the Tab.** A part may declare the act it `performs`
(`headerPrevious`/`headerNext` page; `viewToggle` switches view), and `popupHoldsAnAction` exempts
such a part when the kind declares an open-phase key of that intent and size. Both calendar kinds
therefore let Tab leave the panel (`cancel`, `restoresFocus: false`) instead of holding it. The
per-part half of that rule is published as `partIsReachedByAKey` from `@modyra/widgets/testing`.
`MdyKeyIntent` names the intent vocabulary; `popupHoldsAnAction` takes the bindings to judge as an
optional second argument.

**Every renderer, both kinds.** Plain's date range gains the month and year views its sibling had,
the header toggle that opens them and the accelerated arrows that step between them; lit's date
range is restructured to the three-sibling header; Angular's range grid refers to the heading; Vue
takes the view state from the controller.

**Why major on `@modyra/widgets`.** `contract:diff --since HEAD` reports 8 minor (new optional
parts) and 28 major, every one of the 28 a *reading-order position* shift on the parts that follow
the four insertions. Their order relative to one another is unchanged, and on the page nothing moved
— the buttons were already there and are now declared — but `structure.nodes[i].order` is public
and the tool records absolute position. The verdict is followed; the disagreement is stated here.

**Why major on `@modyra/angular`.** `test:type-surface` reports the removal of the `protected`
`gridName` member from `MdyCalendarGridComponent` and `MdyRangeCalendarGridComponent`, replaced by
`headingId`. Only a subclass reading that member is affected.
