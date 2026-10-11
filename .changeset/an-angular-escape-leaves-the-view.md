---
"@modyra/angular": patch
---

In the datepicker and date range calendars, Escape in the month or year view now goes back to the days and keeps the calendar open, and a second Escape closes it. Before, the overlay's own Escape listener closed the calendar from any view. The press is consumed, so listeners above the calendar do not see it. Focus lands on the day grid, on its first choosable day when the day it stood on is not in the month shown. ADR 0225.

Migration: none. A person in the month or year view now presses Escape twice to close the calendar.
