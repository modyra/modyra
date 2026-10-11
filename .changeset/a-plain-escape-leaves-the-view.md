---
"@modyra/plain": patch
---

In the datepicker and date range fields, Escape in the month or year view now goes back to the days and puts focus on the day grid, and a second Escape closes the calendar. Before, Escape closed the calendar from any view. The press is consumed, so listeners above the field do not see it. ADR 0225.

Migration: none. A person in the month or year view now presses Escape twice to close the calendar.
