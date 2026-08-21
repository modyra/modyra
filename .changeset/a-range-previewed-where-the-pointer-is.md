---
"@modyra/plain": patch
---

The daterange previews the range under the pointer

The contract has carried this since the kind existed: `{ type: "preview", iso }` is an intent, the
controller publishes `previewed`, and the `gridcell` part declares `inRange`, `rangeStart` and
`rangeEnd`. This renderer already painted all three from `state.previewed` — and never told the
controller where the pointer was, so the highlight could only ever show a range already committed.

It dispatches `preview` on cell hover and on keyboard focus, and `iso: null` when the pointer leaves
the grid. Measured: after picking a start and hovering six days later, five cells light up as
in-range where none did before.

Nothing was added to the contract. The intent, the published state and the cell flags were all
already there; only the dispatch was missing.
