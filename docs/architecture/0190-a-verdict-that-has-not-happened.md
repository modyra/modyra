# ADR 0190: A verdict that has not happened

Status: Accepted

## Context

A form built away from a browser is useful only if it reaches the verdicts a person would see. The
capability that says a runtime can do this — `serverSnapshots` — was declared by every reactivity and
read by no source: every runtime answered `false`, and nothing consulted the answer. It was not an
oversight; its consumer is this path.

Two things had to be decided before the path could exist, and neither is readable from the code.

**What a snapshot says about a rule that has not finished.** A synchronous rule reaches a verdict
before the response is sent. An asynchronous one does not: the sending side does not wait for a
network call, so at the moment the snapshot is taken the rule has been asked and has not answered.
A boolean has nowhere to put that. Reported as valid, a field arrives green on the strength of a rule
that never ran; reported as invalid, it accuses a value nothing has objected to.

**What a runtime that cannot do this is told.** The motivating defect is a runtime whose computations
freeze at creation: the value moves and the verdicts do not, so a module renders "required" under a
filled field. A path that serialises those verdicts anyway produces a page that disagrees with itself
and says nothing.

## Decision

**A verdict that has not been reached is `unknown`, which is neither of the other two.** A field
carries `verdict: "valid" | "invalid" | "unknown"` and, separately, whether a rule is still being
asked. The two are orthogonal and both are needed: a synchronous failure is `invalid` even while an
asynchronous rule is still running, because something is already known to be wrong and waiting does
not make it less so.

**A restore re-derives rather than installs.** The receiving side is given the values and computes
its own verdicts from them. A verdict restored as data is a claim nothing checked, and installing one
would hide the disagreement between the two sides that this path exists to make impossible.

**A runtime that has not declared the capability is refused, by name.** The refusal names the flag,
names the runtime, and says what to do. A runtime with no capabilities object at all is refused on
the same terms: an absent promise is not a promise.

**The reactivity is passed explicitly and is not optional.** A default would answer for a runtime
nobody named — a caller who built with one that cannot re-run its computations would be told the
snapshot is sound on the strength of a different runtime's capabilities, which is the silent wrong
answer the refusal exists to replace.

**The flag rises after the proof, never before.** Vanilla declares it because a run puts a form built
without a browser beside one built with it and compares their verdicts. Angular, Vue and Solid keep
`false` until each passes the same run.

## Consequences

Every caller of the path passes a reactivity it already holds. That is friction on the common case,
and it buys the absence of a default that could be wrong.

`unknown` is a third state consumers must handle. A consumer that treats it as valid has the defect
this record exists to prevent, and one that treats it as invalid shows an error nobody caused. There
is no rendering of `unknown` that is free, which is the honest cost of not having lied.

React, Preact, Svelte and Lit report the capability without a run of their own. Each is
`{ ...vanillaReactivity(), kind }` — vanilla's engine relabelled, verified by reading all four
derivations — so the claim is true by construction rather than assumed. What keeps it true is weak
and worth naming: the capability matrix is generated and committed, so a package that stopped
spreading vanilla would move the table and show up as a diff. Nothing asserts the derivation itself.

## Alternatives rejected

**Report an unfinished rule as valid, and let the client correct it.** The page is wrong for as long
as the round trip takes, and it is wrong in the direction nobody checks — a green field invites no
second look. The correction also never arrives if the client never runs the rule.

**Carry the verdicts and install them on restore.** Faster, and it makes the two sides agree by
construction rather than by computation, which removes exactly the disagreement worth detecting. A
sending side whose rules froze would be believed.

**Take the reactivity from the form.** Less friction and a coupling the form does not currently have.
It also makes the capability unaskable by a caller who is deciding whether to use the path at all.

**Let a runtime that has not declared the capability through with a warning.** Warnings are read when
something already looks wrong, and the failure here looks like a working page.

## Verification

The property is not read off a snapshot; two roads are put in one run. A form built and written
without a browser is snapshotted and restored, and its verdicts are compared against a form built and
written directly — validity, values, synchronous errors, what is still pending.

Comparing only post-restore verdicts is not enough, and the gap was measured rather than reasoned
about: because a restore re-derives, a sending side whose rules froze at creation still yields correct
verdicts on the receiving side. In that state the roads agreed while the snapshot carried
"Name is required" for a field holding a name. The run therefore also compares what the sending side
itself concluded, and the freeze is planted rather than waited for — a runtime since repaired would
otherwise leave the check untested.

Three further plants go red: a snapshot that carries no errors, one that folds "still being asked"
into "passed", and one that reads the clock. Making the freeze a no-op turns its own check red, so
that check is known to detect the freeze rather than some other difference.

What stays unguarded: the round trip is exercised on one reactivity, so agreement is evidence that
serialization survives rather than that a different runtime would agree.

### Amendment: half of what this section called unguarded now has a check

This record was written saying that nothing asserts the four relabelled runtimes still take vanilla's
answer. A differential check now does: it compares each of their declared capabilities against
vanilla's and names the binding and the key that drifted.

The residue is much narrower than the original sentence, and narrower than the first draft of this
amendment, which named the wrong thing. That draft said a binding could reimplement a member while
copying the capability object and satisfy every check. Measured instead of asserted — `computed`
overridden in one binding to compute once, `capabilities` untouched, under a build watched rather
than suppressed:

```
capability guard                                        green — nothing was restated
a form means the same thing on every runtime             RED
```

So two checks cover the two ways of drifting, and neither covers the other: one reads what a binding
**declares**, the other what a form **does** on it. An overridden member is caught by the second.

What is genuinely left is thinner than either sentence: an override that changes a member without
changing any verdict the compared operation log produces. That is not nothing — the log is a
finite set of collections, validations and submissions — but it is a much smaller claim than "nothing
asserts it".

Identity is not the instrument for the gap that remains, and trying it costs a wrong conclusion:
`vanillaReactivity()` is a factory, so two vanilla instances share no member by reference and vanilla
is not `===` to itself. What answers today is the source — each of the four is one line,
`{ ...vanillaReactivity(), kind }`, holding no capability literal — and that is a reading, not a
gate.

## Security and privacy

A snapshot carries field values, so it carries whatever the form holds — a path that sends one to a
client sends the values with it. This record does not introduce that exposure and does not mask
against it: the devtools snapshot beside it masks declared secrets, and a caller serialising a form
with secret fields to a page must do the same. Nothing here is persisted, and nothing is read from
the clock, so a snapshot carries no timing information about the session that produced it.
