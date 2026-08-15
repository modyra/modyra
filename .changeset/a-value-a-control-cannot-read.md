---
"@modyra/widgets": major
"@modyra/plain": minor
"@modyra/lit": minor
---

A date or time a control cannot read is kept where it can be corrected, and explained

Typing `14:30` into a timepicker erased it. The value went `null`, `aria-invalid` stayed `false`, and
nothing was said — in both browser renderers, for a date and for a time alike:

```
typed        into         outcome
14:30        timepicker   text erased, value null, nothing said
banana       timepicker   idem
not a date   datepicker   idem
31/02/2026   datepicker   idem
```

`14:30` is the case that decides it: it is how most of the world writes a time, the control's default
locale is 12-hour, and the only way to learn that was to guess. Nothing erased the text — an
unparseable entry committed nothing, and the next sync rewrote the input from a value that had not
changed.

A control now hands the text to its controller as text (`{ type: "type", text }`) and the controller
decides: empty clears, readable commits through the same door the calendar or the dial uses,
unreadable is **kept and explained**. Keeping without explaining would leave a field that looks
accepted holding a value it never took — which is what `acceptTimeField` already refuses one level
down.

**Breaking.** `MdyDatepickerFieldState` and `MdyTimepickerFieldState` gain `entryText` and
`entryUnreadable`; `MdyI18nMessages` gains `entryUnreadable`, shipped in all five locales. A renderer
that builds one of those state objects, or a host that supplies a complete message table instead of
spreading `MDY_I18N_MESSAGES_DEFAULT`, adds them:

```ts
const messages = { ...MDY_I18N_MESSAGES_DEFAULT, noResults: "Nessun risultato" };
```

`parseEntry` is optional, so a controller built without one leaves typed entries alone as before.

The daterange is unchanged and has the same defect: its entry has two ends and needs a state shape of
its own. Recorded as
[ADR 0063](../docs/architecture/0063-a-value-a-control-cannot-read-stays-where-it-can-be-corrected.md).
