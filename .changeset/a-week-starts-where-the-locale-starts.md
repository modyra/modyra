---
"@modyra/lit": patch
"@modyra/widgets": minor
---

A Lit calendar starts its week where the user's locale starts it.

`mdy-datepicker-field` and `mdy-daterange-field` set `firstDayOfWeek = 1` in their constructors, so
every calendar began on Monday regardless of locale. Angular takes it from `MDY_DATE_LOCALE` and
Plain from `buildDateLocale`; Lit was the only renderer holding a constant. Measured under
`en-US`, with the same schema and the same fixture:

```text
@modyra/plain   S M T W T F S     (correct for en-US)
@modyra/lit     M T W T F S S
```

Nothing about the Lit calendar was malformed — the parts were present, the ARIA correct, the grid a
grid. Only the order was wrong, and only against a locale nobody had run it in, which is why the
conformance and equivalence suites were green.

`first-day-of-week` still overrides, and is now the way to ask for a fixed first day. Unset follows
the locale. A host that was relying on the Monday default in a Sunday-first locale, and wants it
kept, should set the attribute explicitly.

`@modyra/widgets/testing` gains `inspectCalendarWeekStart` and `expectedWeekdayOrder`, so the rule
is stated once for every renderer rather than three times. The expectation is derived from `Intl`,
not from a renderer's own helper, so a renderer cannot satisfy it by agreeing with itself.

The suites now drive **two locales with opposite week starts**. One locale proves nothing: a
renderer with the week start hardcoded is correct in exactly the locale whose value it hardcoded,
and a suite that only ever runs there is measuring its own environment rather than the renderer.
