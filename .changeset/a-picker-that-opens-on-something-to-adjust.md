---
"@modyra/vue": patch
---

The time picker opens on something to adjust, and says what it expects

Reported by a person using the demo, and confirmed by putting the two renderers side by side: this
one's picker opened on two empty boxes.

- **The segments held nothing.** The draft behind them had an hour and a minute the whole time — the
  projection publishes them as `aria-valuenow` — and the boxes were drawn without a value, so opening
  the picker showed nothing to adjust.
- **They were text boxes.** Now `number`, as every other renderer draws them: a numeric keypad on a
  phone, and the platform's own stepping.
- **The field said nothing about its format.** It now carries the placeholder the shared door states
  — `HH:mm` or `hh:mm AM/PM` according to the format — rather than leaving a person to guess at a
  shape the field will refuse.
- **A button offered a clock face that does not exist.** This renderer draws no dial, and the toggle
  had no handler: pressing it taught a person the widget was broken rather than that the face was
  missing. The button is gone and the missing face is recorded as the gap it is.
