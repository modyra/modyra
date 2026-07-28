---
"@modyra/widgets": minor
"@modyra/plain": minor
---

Render `daterange` for real in the framework-free renderer: two endpoints, a separator, a toggle and
a calendar popup driven by the widgets range policy, committing and closing as soon as the second
endpoint is picked. The calendar body is shared with the datepicker and now carries the contract's
full anatomy — a weekday header and one row per week — with month and weekday names, and the first
day of the week, taken from Intl via `buildDateLocale`. Selecting a date in the datepicker likewise
closes the overlay and restores focus to the trigger.
