---
"@modyra/vue": patch
---

`@modyra/vue` draws the errors a field reports, and the list they belong in.

The contract declares two parts — `errors` and `errorItem` — and this package drew at most the first.
Six kinds framed an `<ul>` that was always empty; five drew nothing at all while `aria-describedby`
named the id it would have had. A reference to a list that does not exist is worse than silence: it
promises an explanation and delivers none, so a person listening is sent to a message nobody wrote.

All eleven kinds now draw the list and its items through one place, and which errors are *shown* is
the contract's answer rather than each component's: a field nobody has touched is not wrong yet, and
`visibleErrorsOf` is where that rule already lived.

Found by driving the `invalid` state, which this package's conformance config had been declining —
the check that would have caught it has existed all along and was never executed here.
