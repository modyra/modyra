# ADR 0211: An argument of the wrong shape is a defect

Status: Accepted

## Context

**A value of the wrong shape is a verdict; an argument of the wrong shape is a defect.** ADR 0208
settled the first: a value is a person's data, so a control given one it cannot read stays on the
page and the verdict channel reports it. This record is the other half, and it looks like the
opposite policy because it has the opposite audience — a malformed argument is a mistake in the
calling code, and code defects are answered loudly, to the builder, not quietly to the page. One
coherence under two policies: **a wrong shape never passes in silence.**

The silence was measured. In one evening, six probes written by two sessions actively checking each
other passed the wrong input to a door or a fixture, and **not one of them objected**:

```
grep viewMode              where the signal is called view       → "this kind has no views"
?.role                     where the role lives in attributes    → "the pickers carry no role"
rules: {}                  where the fixture takes validators    → "the validators never arrive"
fieldIsRequired(handle)    where the door wants the state        → undefined, read as "not required"
control()                  which returns undefined for that kind → getAttribute on nothing
errors()                   which cannot see the state it reads   → "0 errors", which looks healthy
```

Four of the six produced a defect that did not exist, and one was carried most of the way into a
report to a peer. The subject was never wrong in any of them. Six independent failures in one place
is not a bad evening: it is a surface that produces them.

The specific shape is a structural parameter. `fieldIsRequired(field: { required, interactivity })`
accepts anything carrying those names, so a field *handle* satisfies enough of it to return
`undefined && …` — and `undefined` reads as "not required" to anyone who does not know the signature.

## Decision

A door whose parameter declares **every field as required** refuses an argument missing one, with a
`TypeError` naming the absent field and the shape expected.

The roster is **derived from the parameter's own shape**, never listed by hand: a guard put on one
twin and not the other is how a pair drifts — which this repository did last week with `chipMove` and
`chipStep`, one carrying a precondition and the other not.

Two exclusions, both read from the declaration rather than chosen:

- **a door declaring an optional field** is saying a partial object is legitimate.
  `fieldAccessibleName({ ariaLabel })` is a caller asking what it means to have only that, and
  demanding the rest would refuse the callers it exists for;
- **a door whose parameter is `… | null`** is saying absence is a state it answers about.
  `wayBackActionName` returns the words for "there is no way back"; refusing null would turn an
  answer into an error.

`undefined` is the only absence tested. `null` is a value a field may hold — a calendar with no
focused date holds one — and refusing it would reject a state the contract declares.

## Consequences

Code that passed a nearly-right object and got `undefined` now throws. That is the point, and it is
also the cost: a consumer relying on the quiet answer breaks at the call instead of three layers
later, in a place where the message says which field is missing rather than which assertion failed.

Twelve doors carry the guard, so twelve now cost a small array filter per call. Two of them —
`shownErrors`, `showsAsInvalid` — run per render.

It does not reach the other half of what was measured. **A fixture that ignores a key it does not
know is the same species** and is not addressed here: `rules: {}` where `validators: {}` was meant
stayed silent, and that silence lives in the test harnesses rather than in the contract.

## Alternatives rejected

**Leave the signatures to TypeScript.** They already are typed, and the type is what let this
through: a structural parameter is satisfied by any object with the right field names, and four of
the six probes were `.mjs`, where no signature is checked at all. A door that is only safe when its
caller compiles is not safe in the places that measure it.

**Return a verdict instead of throwing.** That is ADR 0208's policy, and applying it here would send
a code defect down the channel built to carry a person's mistake — where it would be read as
something a user did, and shown to them.

## Verification

`packages/widgets/test/a-door-given-the-wrong-shape.spec.mjs` derives the roster **from the source**,
asks every guarded door for each of its fields in turn with that one absent, and requires the refusal
to name it. A door added to the guard is covered by existing; a door dropped from it fails.

The same bench asserts the other direction, and that half is not decoration: a guard that threw on
everything would pass every refusal test and answer nothing. Each door is asked in the **two states it
exists to tell apart**, and must give two different answers.

## Security and privacy

None. The refusal carries a field name from the contract's own vocabulary and no value: an argument's
contents are never quoted into the message, so a malformed object holding a person's data cannot
reach a log through it.
