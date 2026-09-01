# ADR 0189: A second reader of the same question

Status: Accepted

## Context

ADR 0188 built a reading layer so a panel could say *how* it knows a thing, and named one gap it did
not close: nothing compares the panel's computed column against the bench, so the two can disagree
without either saying so. That was written as a possibility. It is now a measurement.

The panel reads an accessible name with `readAccessibleName`. The bench does not: fifteen browser
specs mention `aria-labelledby`, nine walk it themselves, and at least one declares its own resolver
inline, with a comment saying it computes the name *as far as this check can compute it*. Two
implementations of one question, each coherent with itself.

Put on the same six documents, they disagree on two:

```
both, disagreeing        collector="Postal code"   bench="Code"
two ids, one dangling    collector="Postal"        bench="Code"
```

The cause is a precedence inversion: the second reader tries `aria-label` first and falls back to
`aria-labelledby`. Accessible-name computation takes them in the other order, and a person using a
screen reader hears the other answer. On the four remaining documents the two agree — including the
dangling reference, where both correctly fall through — which is why the disagreement survived: it
is invisible on every document where only one mechanism is present, and most documents have one.

It has not yet caused a wrong verdict, and the reason is worth stating because it is not a defence.
The specs holding the second reader assert that a name **exists**, not what it **is**, and an
inverted precedence still finds a non-empty string. The defect is latent in the assertion it happens
to be under, not absent from the code — and the copy is inline, so the next spec to assert *which*
name would inherit it.

## Decision

**A question the contract can answer has one reader, and a consumer that needs the answer calls it
rather than writing a second one.** `@modyra/widgets/testing` publishes the readers; a check that
resolves a name, a reference, or a part's presence by hand is writing a second implementation of a
published contract, and the two will diverge on the documents neither author had in mind.

**Where two readers already exist, they are put in the same run before either is trusted.**
`compareReadings` takes two named sets of readings of the same questions and returns what they
disagree about, keeping three outcomes apart: both looked and answered differently, one could not
look, neither looked. Two readers that are never run together are two beliefs, and each is
self-consistent — the evidence for that is this record, where six documents were enough to find the
inversion and any one of them alone would not have been.

**A divergence is closed in the direction published practice decides, not toward whichever side is
cheaper to change.** Here accessible-name computation orders `aria-labelledby` before `aria-label`,
so the shared reader is right and the inline copy is wrong. Had the disagreement been on a question
with no external authority, it would have been a decision to take rather than a defect to fix, and
this record would say which way and why.

## Consequences

The bench must import from the package it is testing to ask a question about it. That is a coupling,
and it is the one this record accepts: a checker with its own copy of the logic is not independent,
it is merely unaudited — it agrees with the implementation on the cases the same person thought of,
and diverges silently everywhere else.

It follows that a defect in the shared reader is invisible to a check that uses it, because both
sides of the comparison move together. That is the real cost, and it is paid by mutation: a reader
that cannot be shown to fail when it is broken is not verified by anything downstream of it. The
readers carry those mutations; a consumer relying on them inherits that guarantee and adds none.

The comparison finds disagreement and cannot find agreement that is wrong. Two readers wrong in the
same way pass, which has happened in this repository on other axes — three renderers agreeing on a
target size below the threshold, and on a position no baseline recorded.

## Alternatives rejected

**Leave each check its own resolver.** Independent by construction, and the independence is the
illusion: the copies were not derived from the specification separately, they were written from the
same understanding at different times, so they share its mistakes and not its corrections. The
measurement above is what that looks like.

**Have the panel and the bench each keep their reader, and compare the two in CI.** Keeps both
implementations and adds a third thing to maintain. It also answers a weaker question — that the two
agree today — while the point is that only one of them should exist.

**Assert the resolved name everywhere the bench asserts a name exists.** Correct, larger, and owned
by the suite rather than by this package. It would have caught the inversion; it is not an
alternative to removing the second reader, because a stronger assertion over a wrong resolver fails
for the right reason and points at the wrong file.

## Verification

The divergence is reproducible: six documents, two readers, two disagreements, both on documents
carrying `aria-label` and `aria-labelledby` at once. Removing either mechanism from a document makes
the two agree, which is the check that the cause is precedence and not text handling.

`compareReadings` carries mutations in both directions — treating two blanks as a match fails, and
folding "one could not look" into "they disagreed" fails — so a comparison that reported no
divergence can be shown to be capable of reporting one.

What stays unguarded: nothing prevents a new check from writing a third resolver. This record names
the rule and the readers are exported, but no gate reads a spec and asks whether it is re-deriving a
published answer. The count above — nine hand-written walks — was taken by grep, and a differently
spelled one would not appear in it.

Also unguarded, and inherited from 0188 rather than closed here: the panel is still not compared
against the bench in any automated run. This record removes the reason to, for one question, by
making them the same code; it does not build the comparison for the questions where two readers
remain.

## Security and privacy

None. The decision concerns which code resolves an accessible name from a document already in the
page. No data crosses a boundary, nothing is persisted, and the readers hold no state.
