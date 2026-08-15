# ADR 0073: A verdict a person can see is one the form counts

Status: Accepted

## Context

[ADR 0063](0063-a-value-a-control-cannot-read-stays-where-it-can-be-corrected.md) decided that a date
or time a control cannot read is **kept and explained**: the text stays where it can be corrected, the
control paints itself invalid, and a message says so. Half of that arrived; the other half did not.

The value the field holds while an entry is unreadable is `null` — deliberately, because the person
is changing it and what they wrote is not a value. And `null` is a value no rule objects to unless
the field is `required`. So:

```
type "not a date", leave the field
  the page      aria-invalid="true", "That could not be read…", the text still there
  the form      valid, submittable
  the submit    { "when": null }
```

A server receives a field left empty while the page showed the opposite. The submit path is not at
fault and the measurement says so — the same field marked `required` disables the button. It is an
error the verdict cannot see.

The control is the only thing that knows. It holds a value the form's own rules accept and a person
looking at text it could not read, and nothing in `MdyFieldHandle` let it say the two disagree.

## Decision

**A control can report that what it holds does not represent what was entered.**
`MdyFieldHandle.reportEntry(problem)` takes the sentence a person reads, or `null` once the two agree
again. The engine folds it into the field's errors, so `valid()`, `canSubmit()` and every renderer's
error list see it.

**The words are the renderer's.** The message is locale-dependent and the renderer already holds the
message table, so it passes the sentence rather than a code. The engine stores what it was given and
does not interpret it.

**It is not a validator.** It carries no key, cannot be removed by one, and is replaced by the next
report — because it describes the state of a control right now rather than a rule about a value. A
rule that survived the control being re-rendered would be a rule nobody could withdraw.

**Reported where the message is shown.** Both renderers already decide there whether to paint the
entry as unreadable; saying it to the form is the same decision, in the same place, so the two cannot
drift.

## Consequences

**`MdyFieldHandle` gains a required member.** Anything implementing that interface — a test double, an
adapter building its own handle — implements one more. The type-surface audit classifies it major and
agrees with the reading.

A field holding a legitimate `null` with an unreadable entry now blocks submission. That is the
intent, and it is a behaviour change: a form that used to submit `{ when: null }` while the page
showed an error now reports itself unsubmittable until the entry is corrected or cleared.

The report is not persisted. A form rebuilt from a draft, or a control unmounted and mounted again,
starts with nothing reported until the control reads its entry again — which is right, because the
entry belongs to the control that was showing it.

## Alternatives rejected

**Keep the raw text as the field's value.** It makes the model carry something the value contracts
forbid — `MDY_VALUE_CONTRACTS` says a date holds an ISO string or `null` — and moves the problem to
everything that reads a value.

**Let the renderer add a validator.** `upsertValidators` is on the form, not the handle, so a control
would need the form to say something about itself; and a rule keyed by a control is a rule that
outlives it.

**Treat an unreadable entry as `required` failing.** It only bites where the field is required, which
is exactly the case that already worked.

**Report through the diagnostics channel.** It is a development channel, stripped in production,
which is where the wrong payload is sent.

## Verification

- `battle-tests/browser/a-field-that-says-it-cannot-read-what-it-holds.spec.ts` — the typed entry,
  the page's verdict, and what the form would send, with the `required` case beside it as the path
  that already worked.
- `packages/core/test/` — the workspace suite, where a field with nothing reported behaves exactly as
  before.

## Security and privacy

A field the person could not fill correctly no longer reaches a server as empty. That closes a way
for a form to report a value nobody entered — an omission a server cannot distinguish from a
deliberate blank — and it sends strictly less: a submission that used to go out now does not.
