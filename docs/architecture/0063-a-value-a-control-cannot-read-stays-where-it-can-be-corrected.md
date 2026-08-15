# ADR 0063: A value a control cannot read stays where it can be corrected

Status: Accepted

## Context

Typing `14:30` into a timepicker erased it. Measured in both browser renderers, on blur:

| typed | into | outcome |
| --- | --- | --- |
| `14:30` | timepicker | text erased, value `null`, `aria-invalid="false"`, nothing said |
| `banana` | timepicker | idem |
| `not a date` | datepicker | idem |
| `31/02/2026` | datepicker | idem |

`14:30` is the case that decides this. It is how most of the world writes a time, the control's
default locale is 12-hour, and the only way to find that out was to guess — `2:30 PM` and `2:30pm`
both work, so this is not a control that reads nothing.

**Nothing erased it.** In `@modyra/plain`, an unparseable entry dispatched *nothing*; the sync effect
then rewrote the input from the field's value, which had not changed. In `@modyra/lit` the input's
value was assigned back explicitly. Two renderers, one absence — the text went because nobody kept
it, and each renderer parsed for itself, which is what let them differ at all.

The rule was already stated one level down. `acceptTimeField`, judging a single segment:

> Returns a rejection rather than a clamp or a `null`. A caller that clamps has answered a different
> question from the one the user asked, and a caller that returns nothing leaves a field that looks
> accepted holding a value it never took.

That is this finding, for the whole entry instead of one segment.

## Decision

**The judgement moves into the controller; only the reading stays with the renderer.** A control
sends `{ type: "type", text }` and the controller decides: empty clears, readable commits through the
same door the calendar or the dial uses, unreadable is kept. The parse is a `parseEntry` dependency
because it is locale-aware and the locale belongs to the host — a control knows what `14/03` means
where it is rendered and this package does not.

**An unreadable entry is kept *and* explained.** The state carries `entryText`, which a control
renders in place of the formatted value, and `entryUnreadable`, which it shows a verdict for.
Keeping without explaining trades one silence for a worse one: an empty field at least said
*something went wrong*; the time still written there says *that worked*, and is wrong.

**An unreadable entry empties the value.** The field holds nothing, because the person is changing it
and what they wrote is not a value. Anything else shows one thing and holds another.

**Any value from anywhere clears the outstanding entry** — a pick, a confirm, a programmatic
`setValue`. There is nothing left unread once the field holds something.

**The sentence is the contract's.** `MdyI18nMessages.entryUnreadable`, in the five shipped locales,
worded for what happened rather than for what the person did wrong: the commonest cause is a control
whose locale writes a time differently from the person reading it, which is not their mistake.

## Consequences

**This is a breaking change to two state contracts and to the message table.** `MdyDatepickerFieldState`
and `MdyTimepickerFieldState` gain two required members, and `MdyI18nMessages` gains one. A renderer
outside this repository that builds a state object, or a host that supplies a complete message table
rather than spreading `MDY_I18N_MESSAGES_DEFAULT`, has to add them. The type-surface audit classifies
it as major and agrees with the reading.

A form can now show text it does not hold. That is the point, and the message is what keeps it
honest — a control rendering `entryText` without `entryUnreadable` would recreate the failure with
extra steps.

`parseEntry` is optional, so a controller built without one leaves typed entries alone, exactly as
before. That keeps the change additive for a host driving the controller headlessly.

**The daterange is not in this batch.** Its entry has two ends and needs a state shape of its own; it
has the same defect — typing an unreadable start clears the range silently — and it is the next
batch, recorded rather than half-done.

## Alternatives rejected

**Keep the text and say nothing.** Half the repair, and the half that leaves the person believing a
value was taken. The battle admits it; `acceptTimeField`'s own comment is why it is not enough.

**Erase and explain.** The other half. It is weaker for the case that matters: `14:30` erased leaves
nothing to correct, so the person retypes from scratch to find out what the control wanted.

**Parse in each renderer and agree by convention.** What existed. It is why one renderer could read a
notation the other could not, and why this defect is identical in two places nobody coordinated.

**Widen the parse so `14:30` is read by a 12-hour control.** It reads one more notation and leaves
every other unreadable entry silently erased, which is the finding rather than the example.

## Verification

- `battle-tests/browser/a-time-that-vanished.spec.ts` — the four entries, with the shapes each picker
  does read as the control, and **the correction guard**: after correcting to `2:30 PM` the control
  holds the correction and nothing of the attempt. A fix that kept every entry passes the first and
  fails that one.
- `battle-tests/browser/a-refusal-in-two-renderers.spec.ts` — the same question asked of Plain and
  Lit, which is what says the repair is in the contract and not in one renderer.
- `packages/widgets/test/` — the controller's entry state, including that a readable entry clears it.

## Security and privacy

None. The text kept is the person's own input, held in the control that received it and in the
controller's state, and it never reaches the form value or a submission — an unreadable entry empties
the value, so nothing unparsed can be submitted.
