---
"@modyra/widgets": major
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/vue": minor
"@modyra/angular": minor
---

A date range submits the two dates it holds, not the text its boxes show (ADR 0227)

A native form submit of a date range sent each end as the box displayed it — `r.start=January 2, 2026` —
which a receiver cannot read back without knowing the sender's locale. The range now submits the ISO
dates it holds from hidden inputs, under the same keys: `r.start=2026-01-02`, `r.end=2026-02-01`. Both
keys are always present while the field is enabled, empty for an end not yet chosen.

The Lit datepicker no longer sends its key twice (the displayed text, then the date): no date box carries
a `name` any more.

**Contract.** `submissionFor("daterange")` is now `{ form: "hidden", repeats: false, keys: ["start", "end"] }`
instead of the `split` shape, and `submissionNames("daterange", path)` is `{}`. The `hidden` shape gains
an optional `keys`. New: `submissionEntries(kind, path, value)` returns the `[key, value]` pairs a field
submits, and `syncSubmission(host, kind, path, value, disabled)` keeps the hidden inputs in step for any
kind (it does nothing for kinds whose control carries the value).

**Migration.**
- A server that parsed the localized text of a range's ends now receives `YYYY-MM-DD`.
- Text typed into a range box that the field could not parse is no longer submitted; the end arrives
  empty.
- Code that switches on `submissionFor(kind).form` and handles `hidden` by sending the value under the
  path must read `keys` when present, or call `submissionEntries`.
- A query for every `input` inside a range now also finds its two hidden inputs; ask for
  `input:not([type="hidden"])` to get the boxes.
