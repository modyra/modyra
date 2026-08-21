---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

The chip strip pays the conditions its scrolling was allowed under

ADR 0127 let the row scroll rather than wrap — a control must be the same height as every other
control in the form, and a wrapping row grows with what is put in it — but the departure was
**conditional**, and two of its conditions were unpaid.

**The count is in the field's own description.** "12 selected", stated rather than announced: somebody
arriving at a field whose chips have scrolled out of sight had no way to learn there were more. This
is the state, asked for; the live region carries events.

**A wheel reaches what has scrolled out.** A cue is not a mechanism, and many desktop mice have no
horizontal axis at all — a strip that answers only `deltaX` is a strip a large number of people cannot
move. `chipStripWheelDelta` takes the larger of the two deltas, so a vertical wheel drives the strip
and a trackpad's horizontal gesture still behaves as its owner expects. It answers zero when nothing
is hidden, so a wheel over a strip with nowhere to go still scrolls the page.

The other two conditions were already paid: `aria-setsize`/`aria-posinset` on every chip, and every
chip reachable by keyboard with the focused one scrolled into view.
