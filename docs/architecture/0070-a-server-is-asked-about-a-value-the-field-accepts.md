# ADR 0070: A server is asked about a value the field accepts

Status: Accepted

## Context

A tax id field: `minLength(11)`, an async check against a service, `debounceMs: 120`. Someone typing
it group by group — reading from a card, pausing between groups — produced four requests:

```
IT12, a pause per character     4 requests   ["", "I", "IT", "IT1"]
```

All four are values that field's own `minLength(11)` **rejects**. The form knew they were too short to
be a tax id, and asked anyway.

The debounce is not the answer and the measurement says so: the same field typed straight through —
nine characters at 40 ms, `debounceMs: 400` — collapses to two requests. A debounce limits how
*often* a settled value is sent; a settled prefix is still a prefix.

`comparison-reactive-forms.md` puts `serverValidator()` beside Angular's `AsyncValidatorFn` and lists
what ours adds — debounce, cancellation, last-wins, timeout, cross-field. The one thing
`AbstractControl` does and we did not is missing from that table: **it runs an async validator only
once the synchronous ones have passed.** `mdyCva` is a documented migration path, so a consumer
arrives carrying that assumption and their service starts being called with `""`, `"I"`, `"IT"`.

## Decision

**An async validator runs only when the field's own synchronous rules accept the value.** The rule
the field already states, applied once.

**A field its own rules refuse reports nothing pending and holds no stale async verdict.** An answer
about a value that is no longer there is not an answer about this one.

**The guard is before the request, not a cancellation after it.** The cancellation machinery exists
and is correct — but it is keyed on *the value changed*, not on *the verdict turned red*, so it
aborted the request for the good value and let the one for the bad value finish. A run that never
starts has nothing to cancel, and nothing is added to last-wins.

## Consequences

**An empty required field shows no spinner**, because no check is running. That is the visible change
and it is the intended one: the window covers the check, and the check begins when there is one to
make.

It also surfaced four tests that had been passing for the wrong reason. `assert.equal(handle.pending(),
true)` immediately after an `onChange` was not reading the check for the typed value — it was reading
the window left open by the *previous* run, on the empty field. The assertion was satisfied by the
defect it now no longer has.

A consumer whose async check was deliberately being asked about partial values — a search-as-you-type
suggestion box modelled as a validator — no longer gets those calls once a synchronous rule rejects
the partial value. Such a check does not belong on a rule that rejects what it is meant to search
for, and the change makes that explicit rather than serving both.

Reading the synchronous verdict costs running the field's own validators once more per async
evaluation. They are pure by contract and already run on every read of `errors()`.

## Alternatives rejected

**Use `when`.** It is documented for exactly this — *"skip the call for obviously invalid input"* —
it already exists, and it closes the visible case. It loses because it asks the consumer to restate
in a second predicate what the field has already declared: `minLength(11)` on the field and
`when: (v) => v.length >= 11` beside it are one truth written twice. Raise the bound from 11 to 13
and the `when` still guards the old one, silently, with nothing to report the drift. That reasoning
is not recoverable from the code, which is why it is here.

**A longer debounce.** Measured: it changes how many requests a burst produces and not which values
are sent. A person who pauses between groups sends every group.

**Cancel the in-flight request when the verdict turns red.** The cancellation is keyed on the value
changing and works; pointing it at the verdict as well would still send the request first, and the
cost being avoided is the request.

## Verification

- `battle-tests/adversarial/validation/a-value-the-form-already-refused.battle.test.mjs` — the four
  prefixes, with the debounce measured beside them so the repair cannot be confused for a longer one.
- `packages/*/test/headless-recipes.test.mjs` — the recipe in five adapters, where the pending window
  now begins when the check does.

## Security and privacy

A value a form holds is sent to a service one fewer time, and never for a value the form itself has
already refused. That is a smaller disclosure surface: a partially typed identifier — a tax id, a
card number, an account reference — is no longer transmitted keystroke group by keystroke group to a
service that only needed the finished one.
