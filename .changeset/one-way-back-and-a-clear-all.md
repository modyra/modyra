---
"@modyra/widgets": major
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
"@modyra/styles": minor
---

One way back, and the clear-all it exists for

A multiselect had three destructive acts and no way back from any of them: a chip removed, an order
rearranged, twelve choices gone. It now has **one** reversal covering the last of them whatever it
was — [ADR 0129](docs/architecture/0129-one-way-back-not-three.md) — and the clear-all control that
made the question urgent.

Three undos was the alternative refused, and refusing it is the decision: an undo that covers the
loudest act and not the quiet ones teaches a person the control has a way back and then does not have
one the next time.

**How it behaves.** Depth is one. A destructive act replaces the offer rather than stacking on it, and
a constructive one — choosing again, incrementing — withdraws it, so the reversal never puts back
something the person did not just lose. It is untimed and drawn in the page, never a toast: a message
that takes itself away after five seconds is a time limit under WCAG 2.2.1 Level A, and an undo has no
exception under it. It names the act, because one control covering three needs to say which:
*"Alpha removed — Undo"*, *"Alpha moved — Undo"*, *"12 items cleared — Undo"*.

**The contract.**

- `MdyMultiselectFieldState.wayBack` is new and **required**: `{ act, optionKey, count } | null`. The
  value it would restore stays private — an offer a host can read is one a host can apply to a
  different moment.
- `MdyMultiselectFieldIntent` gains `{ type: "undo" }`.
- Three new optional parts: `clearAll` at the trailing edge, and `wayBack` with `wayBackAction` under
  the control. `clearAll` joins the kind's trailing affordances, so it carries the same hit target as
  every other control in that column.
- `wayBackSentence` is exported: what the offer says, so three renderers cannot word it three ways.
- **Five new required `MdyI18nMessages` members** — `clearSelection`, `wayBackLabel`,
  `wayBackRemoved`, `wayBackMoved`, `wayBackCleared` — supplied in all five built-in locales. A
  consumer passing a hand-written message table must add them.

**Layout.** The closed control is a flex row now: the trigger takes what is left and the clear-all
sits beside it. As a block it had nowhere to go but under the control, where it overflowed the field's
box and the text below painted over it — drawn, and not pressable. For the same reason the way-back
row is positioned: the input wrapper above it is `position: relative`, so it paints over the in-flow
content that follows and takes the pointer with it.
