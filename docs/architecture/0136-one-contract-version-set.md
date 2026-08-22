# ADR 0136: A version one runtime accepts is a version all of them accept

Status: Accepted

## Context

A dynamic form document declares a contract version. The three runtimes that read one do not agree
about which versions exist:

```
TypeScript   parseDynamicForm            accepts  1  2  3  4
Java         MdyDynamicFormParser                    2  3  4
Rust                                                 2  3  …
```

A document declaring `version: 1` builds a form in TypeScript and is refused by the other two. Nothing
else in the set diverges — the disagreement is one integer, and it was recorded as *three vocabularies*
for long enough that it read as an alignment project rather than as a single number.

The battle `three-runtimes-three-vocabularies` has pinned this since before the current work. It
asserts the narrow thing: *every version one runtime accepts is one the others have a position on*.
Both readings below satisfy it, which is why it could not settle the question and why the question
needed answering before a line could be written.

## Decision

**Version 1 is not supported. TypeScript stops accepting it.**

The contract defines 2, 3 and 4. TypeScript was the only runtime outside that set, and a version two
of three refuse is not a version the contract has — it is one parser being lenient.

Decided by the user, on the reading that the contract is the set the runtimes agree on rather than the
union of what each will tolerate.

## Consequences

**This is a breaking change to a published contract**, and the only one of the three options that
breaks anything. A document in the wild declaring `version: 1` stops parsing in TypeScript, where it
used to build a form. `contract:diff` classifies it, a changeset carries the migration, and the
migration is one line: *a document declaring `version: 1` declares `version: 2`; nothing else about it
changes.*

That the migration is that small is the reason this reading was affordable. Version 1 differs from 2 in
the envelope rather than in the fields, so a document written against it is a document already
compatible with 2 in everything but the number it states.

**The refusal must say the version it refused and the versions it accepts.** A parser that stops
accepting something and says only *invalid document* moves the cost from the library to whoever has to
guess — and this refusal will be met by people whose document worked yesterday.

**What it buys**: a document that renders on one runtime renders on all three, which is what makes the
document a contract rather than a TypeScript artefact that the other SDKs approximate. The alternative
readings each kept the divergence — teaching Rust and Java a legacy envelope is work nobody asked for
against a version nobody may still write, and recording the divergence leaves a document that exists
for one runtime and not the others.

## Alternatives rejected

**Teach Rust and Java version 1.** Nothing breaks and the divergence closes from the other side. Two
SDKs to touch, for an envelope that may have no documents left, and it makes the contract the union of
what any runtime has ever accepted — which is how a set of three grows into three sets.

**Record the divergence and leave it.** An ADR saying *1 is TypeScript-only, portable documents start
at 2*. No code changes and the battle stays pinned with a condition. It was the honest do-nothing, and
it leaves standing exactly the thing a cross-runtime contract exists to prevent: a document that builds
in one place and does not exist in another.

## Verification

`three-runtimes-three-vocabularies.battle.test.mjs` is the check and it is satisfied by this decision:
once TypeScript refuses 1, every version one runtime accepts is one the others have a position on.

It is **also** satisfied by both rejected readings, which is worth stating in the record rather than
discovering later: this battle can tell you the runtimes disagree and cannot tell you which of them is
wrong. The check that fails if this decision is violated specifically is a parser accepting a version
the others refuse — the same assertion, and it stays honest because it derives the accepted sets rather
than naming them.

What is **not** checked: that the refusal names the version and the accepted set. That is a message,
and no gate reads a message. It is owed as a test beside the change.

## Security and privacy

A parser refusing more than it did is a narrowing, not a widening — nothing newly accepted, no new
input trusted. The refusal message states a version number and a set of version numbers, neither of
which is user data.
