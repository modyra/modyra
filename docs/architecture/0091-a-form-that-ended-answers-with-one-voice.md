# ADR 0091: A form that has ended answers with one voice

Status: Accepted

## Context

A destroyed form keeps answering rather than throwing, and that is deliberate: a renderer torn down
in the other order reads for a beat, and an exception there turns an ordinary unmount race into a
crash.

What nothing decided is whether the answers have to agree. They did not. On a form holding one valid
row, destroyed:

```
getValue()        the row, whole
submitValue()     {}                 — there is no row
state.valid()     true
state.canSubmit() true
```

`if (form.state.canSubmit()) send(form.submitValue())` is ordinary enough to write without thinking,
and in a teardown path it posted an empty payload for a form that had just reported itself
submittable.

A late *write* is the same race one step further. A control's change handler firing as its host is
disposed reached the field record: the handle then held what the control last sent, ran its
validators against it and reported its own verdict, while `getValue()` kept what the form ended with
and `state.valid()` stayed as it was. A control still on screen showed a value and an error about a
form that held neither.

## Decision

A form that has ended describes one state.

- `canSubmit()` is `false` once the form is destroyed. Its fields are gone, so `valid()` is the
  vacuous truth of a form with nothing left to be wrong, and reporting it as sendable is the part
  that misleads.
- `submitValue()` answers from what was captured at destroy, as `getValue()` already did. Built from
  the fields, it answered `{}` for a form that was holding rows.
- A write after destroy is refused and reported on the development channel. The value stays what the
  form ended with, so the handle and the form keep saying the same thing.

Reads still answer. Nothing here makes a destroyed form throw.

## Consequences

A control that writes during its own teardown loses that write. It was already lost — it reached a
field the form no longer counted — and now it is lost visibly, with a line naming the field.

`submitValue()` after destroy is a snapshot, so a form destroyed while a field was disabled reports
what was sendable at that moment rather than recomputing it. Recomputation is what produced `{}`.

Capturing a second value at destroy costs one extra serialisation-free object copy per form ending.

## Alternatives rejected

**Throw on a late write.** It is the loudest signal and it breaks the case the answering rule exists
for: the write comes from a disposal path, and an exception there takes the disposal with it.

**Let the write land and update every surface.** The form has no fields left to hold it, so this
means resurrecting the record — an ended form that starts holding new values is a lifetime nobody
can reason about.

**Leave `canSubmit` alone and document it.** The composition that breaks is two published reads next
to each other; a document that has to be read to avoid a contradiction is the contradiction.

## Verification

`battle-tests/adversarial/lifecycle/answers-after-destroy.battle.test.mjs` — asserts the answers do
not contradict each other, with the living form as its control — and `a-write-after-the-end.battle.test.mjs`,
whose companion battle pins that no async validator runs after destroy, so refusing a write does not
quietly stop the work that was already stopped.

## Security and privacy

A refused write means a value a user typed in the last beat before teardown is dropped rather than
kept in a detached record; nothing is stored or sent that was not before. `canSubmit()` answering
`false` closes a path that could post an empty payload to a server, which is a correctness fix with
a security shape: the server saw a submission the user never made.
