---
"@modyra/widgets": minor
"@modyra/angular": patch
"@modyra/lit": patch
"@modyra/plain": patch
---

Where a calendar's header goes, decided once

`calendarViewOnToggle` states it: from the days the header opens the **years**,
because someone reaching for it wants a date far from the month on screen — a
birth date, a maturity — and walking through the months to get there is the
paging the views exist to avoid. From anywhere else it goes back to the days.

Two renderers had agreed on that by accident. A third, written later against the
same contract, chose the other order — which is the same defect this batch exists
to close, committed while closing it. All three ask now.

The renderers also stop keeping their own three strings for which view is
showing. `MdyCalendarViewMode` is the vocabulary, so the translation between it
and a local `"calendar" | "month" | "year"` — written four times, and the whole of
what those four copies were — is gone.
