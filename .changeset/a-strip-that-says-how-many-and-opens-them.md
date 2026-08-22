---
"@modyra/widgets": major
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
"@modyra/styles": patch
---

A strip that says how many are hidden, and the same control opens them

ADR 0127 lets a multiselect's chip row scroll only where something reaches what leaves it. The
gradient added earlier says *there is more* and names no number; the trigger reveals everything and
mentions none of it. A person was told a fact by one thing and offered an action by another.

One affordance does both now: a trailing button reading `+10`, named *"10 more not shown"*, which
opens the list where every chosen value is. A pointer with no horizontal axis — most desktop mice —
has a way through that is not a scroll.

- **`overflowCount`** is a new optional part, and it joins the kind's trailing affordances, so it
  carries the same hit target as every other control in that column.
- **`hiddenChipCount`** is exported: how many chips the strip is not showing, measured from what the
  browser laid out. How many fit depends on the labels, the theme's spacing and the width the host
  gave the field, so it is a measurement and not a count.
- **`MdyI18nMessages` gains `chipsHiddenShort` and `chipsHidden`** — required, in all five locales.

**A keyboard trap came with it, and `keepFocusedChipInView` is the fix.** The browser scrolls a
focused element into view once, at the moment focus lands. An affordance that appears on the same
beat takes its width out of the scrollport *afterwards*, and the chip the browser had just brought in
was outside again by about the width of the control that appeared — measured at 97px of overhang,
with `scrollLeft` unchanged. Nothing scrolls a second time on its own. Every renderer now brings the
focused chip back after the paint that may have moved the box.

**The chip's controls are drawn with a mask** rather than with borders and a background colour
(ADR 0133): a mask takes the system's own colour under `forced-colors`, where a painted shape is
dropped entirely — and the readers most likely to be zoomed into a control this small are the ones
that mode is for.

**lit and Angular listed only the options nobody had chosen.** The contract gives every option a
`selected` state and, in toggle mode, `aria-pressed` — both unreachable in a list that removes what
was taken, and it made the new affordance's promise false, because the values it says are out of
sight are exactly the ones such a list omitted. Both list every option now, as plain always did.

**Angular's popup held its options while it was closed** — twelve option chips in the document of a
control that looks shut, countable by anything walking the field. The panel's contents exist only
while it is open.
