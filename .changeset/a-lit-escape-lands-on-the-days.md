---
"@modyra/lit": patch
---

In the datepicker and date range fields, Escape from the month or year view now puts focus on the day grid even when the day it stood on is not in the month shown. That happens after choosing another year. Focus lands on the first choosable day. Before, it was left on the page. ADR 0225.

Migration: none.
