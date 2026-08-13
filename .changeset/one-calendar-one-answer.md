---
"@modyra/core": minor
"@modyra/angular": patch
"@modyra/lit": patch
---

The calendar's questions about its bounds, asked once

`isMonthOutOfRange`, `isYearOutOfRange` and `calendarYearRange` join
`@modyra/core/datetime`. Angular and Lit each carried their own copy of all
three, and Lit carried two copies — its range picker is its date picker,
copied — so four implementations decided which months a picker greys out and
which years it offers.

They are asked of a month and a year rather than of a date, which is the part
that was easy to get wrong: the first of a month can fall before `min` while most
of that month is reachable, so testing the first day hides a month the user is
allowed to pick in.

The Lit calendars also stop recomputing month and weekday names through `Intl`.
`buildDateLocale` has produced both all along.
