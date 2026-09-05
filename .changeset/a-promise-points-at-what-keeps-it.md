---
"@modyra/widgets": major
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/vue": patch
---

A promise points at what keeps it, and a stepper appears where the field counts

**`aria-controls` names the part carrying the role `aria-haspopup` promises** (ADR 0210). Measured
across all six kinds that make a promise, not the two that surfaced: four already did this, and two
pointed past the element carrying the role at the panel containing it — so an opener saying *this
opens a grid* sent a reader to a container with no role at all. A date range now points at its
`grid`, a colour field at its `presets`. No promise changes and no part's role changes: only the
reference moves, onto what was already keeping it.

The renderers follow, and the move exposed something worth naming: `overlayControlledId` had been
doing double duty as *the panel's id* and *the id the opener points at*, which were the same thing
only while the promise pointed at the panel. Splitting them means the panel keeps an id of its own
and the sub-region carries the controlled one — **and the reference must survive the panel being
shut**, or it dangles for as long as the widget is closed, which is most of the time.

**A chip's stepper is owed only where the field counts.** Declared with a presence condition and no
precondition, it was owed of every filled multiselect, and three renderers that correctly draw none
in toggle mode were reported as missing it. Its twin `chipMove` had carried a precondition since it
was written; this one was declared without.

The capability is `countable`, named beside `reorderable` in one exported table rather than as a
literal on each side. `offers` takes any string, so a misspelling is not a failure but a capability
nobody has — the part silently stops being owed, and nothing says so. The four keys that step a
quantity are gated on the same word: with one of something and no quantity those keys mean nothing,
and a gesture offered where there is nothing to do is a promise the widget cannot keep. That is what
makes them `major` — a binding that was unconditional now asks the field for something.
