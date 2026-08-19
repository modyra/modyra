# ADR 0090: A rule with a bug in it is a verdict, not an outage

Status: Accepted

## Context

A validator is application code the engine calls on every write, so it can do what application code
does: throw. A property read on something that turned out to be null, a helper nobody imported, a
locale table missing a key — none of them are the engine's fault and all of them land inside a
`ValidatorFn`.

The engine already had an answer on one side of the feature. A `serverValidator` whose promise
rejects becomes an error on the field carrying the thrown message: the form stays readable, the
field is invalid, and the application sees what happened. Three neighbouring paths did not have it:

```
a sync validator that throws        set() returns; state.valid() throws, and every later read does
an asyncValidators fn that throws
  synchronously                     the throw escapes the promise chain
an asyncWhen predicate that throws  createForm() throws — there is nothing to render at all
```

The last one is the sharpest: a predicate that decides *whether to ask a server* decided whether the
form existed.

## Decision

A rule that misbehaves produces a verdict about the value, never an outage of the form.

- A synchronous validator that throws contributes its thrown message as an error on the field, and
  the engine reports it on the development channel.
- An `asyncValidators` function is invoked inside the promise chain, so throwing before returning a
  promise fails exactly like a promise that rejects.
- A `when` predicate that throws does not decide. The check **runs**: skipping it would let a value
  through unexamined, and a verdict that was never asked for is the failure this record exists to
  avoid.

The engine's own refusals are not application failures and pass straight through — a rule that writes
a signal from inside a computed still raises `MdyComputedWriteError` by name. Turning that into a
sentence on the field would hide an invariant of the reactivity behind text a user reads.

## Consequences

A thrown message reaches the field, and thrown messages are written for developers: a stack-shaped
sentence can appear where a validation message goes. That is the same trade the asynchronous path
already made, and the alternative — a generic sentence — leaves the developer with a broken rule and
no name for it. The development channel carries the full text either way.

A broken rule now makes the field invalid rather than making the form unreadable, so a form can sit
in a state no value can clear until the rule is fixed. That is visible and diagnosable, which the
previous behaviour was not.

`when` failing open means a server may be asked about a value a working predicate would have
skipped. The cost is a request; the cost of failing closed is a check that silently never runs.

## Alternatives rejected

**Throw at the write instead.** Defensible, and the battle allows it: the caller would learn where
it came from. It loses the property that matters more — a form that renders. A `set()` that throws
is a click handler that throws, and the page is as broken as before, one frame earlier.

**A generic message.** *"This value could not be checked"* is what an ill-shaped return already
produces, and it is right there because nothing else is known. Here the thrown message is known.

**Catch everything, including the engine's refusals.** Measured against
`packages/core/test/reactivity.test.mjs`: it turned `MdyComputedWriteError` into a validation
message, which is an invariant of the reactivity disguised as a rule about the user's value.

## Verification

`battle-tests/adversarial/validation/a-validator-that-breaks.battle.test.mjs` (three battles: the
sync rule, the asynchronous precedent it copies, and the predicate) and
`two-doors-to-one-check.battle.test.mjs` — *a check that fails takes the field with it and not the
form*. `packages/core/test/reactivity.test.mjs` is the counter-check that engine refusals still
propagate.

## Security and privacy

A thrown message can carry internal detail — a path, a hostname, part of a query — and it now
appears in a field's error list, which is rendered. The asynchronous path has always done this, so
this widens an existing exposure rather than opening a new one; an application that must not show
internal text catches inside its own rule, which is where the knowledge of what is internal lives.
