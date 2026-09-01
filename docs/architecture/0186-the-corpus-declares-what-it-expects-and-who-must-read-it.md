# ADR 0186: The corpus declares what it expects, and who must have read it

Status: Accepted

## Context

Four runtimes read one corpus of dynamic-form documents: the TypeScript parser, three published JSON
Schemas, a Java record, and a Rust crate. Only the first enumerates the directory. The others name
their fixtures one at a time — `include_str!` in Rust, a path resolved per file in Java — and a
hand-written list answers exactly about what was written into it and is silent about the rest.

Both halves of that silence were measured rather than supposed.

**Documents no reader had been shown.** Of thirteen documents, the Java suite named eleven and the
Rust suite ten. Three sat in the corpus unread by both, and neither suite went red, because a fixture
nobody reads cannot fail. Their totals were honest and uninformative: Java reported 25 green, Rust
14, and neither number carried the information that something was missing. The count a list reports
is the count it was given.

Two independent readers skipping the same pair looked like a deliberate exclusion — a feature the
SDKs did not model. It was not. Both read `nested-collections.json`, which is the same shape as the
two they skipped, so the explanation that fitted every name did not survive the third file being
opened. Whoever wrote the lists had covered the concept and not the contents of the folder.

**Verdicts nothing asserted.** The corpus contains documents that must be *refused* — a layout naming
an absent field, a rule on an undeclared path. The schema audit printed those under a boundary
heading and exited 0: measured, two refused fixtures and exit 0. So nothing anywhere stated what the
parser *should* say about a document, and a regression that began refusing a good one would have
moved a line in a report and changed no verdict.

These two compound. An enumeration that demands every reader read every document is born red on the
documents that must be refused, and the first instinct is a list of skips — which is the defect the
enumeration was for, under a different name.

## Decision

**A document declares the verdict it expects, beside itself, and absence is the ordinary declaration.**
`X.expected.json` states `valid` and the diagnostic codes; a document with no sidecar declares that it
is accepted with nothing to say. Eleven of thirteen therefore carry no file, and only a document
expecting a refusal needs one.

The expectation lives beside the document rather than inside it. The document is what four runtimes
parse, and a slot carrying an expectation is a slot each of them must know to ignore — a skip list
wearing the document's own clothes.

**Every document is named by every reader that claims to read the corpus.** The corpus knows what it
contains, so it asks rather than waiting to be asked: an audit fails when a document exists that a
reader's sources never mention, naming which reader is blind. This does not check that a reader
*agrees* — each suite does that against the declared verdict — it checks that the reader was shown
the document at all, which is the premise every agreement rests on.

**A companion is recognised by the shape of its name, not by a list of known suffixes.** A document is
a `.json` file whose stem carries no further dot; everything else beside it is a companion. The list
had one entry and the corpus gained a second kind of companion, which turned into two failures about
a file the parser never reads.

## Consequences

A reader added to the corpus must be added to the audit's list of readers, or its blindness is
invisible again. That list is short, in one place, and named — which is the trade this makes: one
list that must be maintained, in exchange for four that no longer have to be.

The gate is a search of a reader's sources for a file name. It answers *was this shown to the reader*
and cannot answer *was it shown to the reader in a way that runs*: a fixture named in a comment
passes it. The agreement half covers that, because a reader that names a document without exercising
it reports nothing about it, and the declared verdict is what its own suite compares against.

Document names must stay unique across version directories. They are today, and a collision would
make the search ambiguous — so it is refused rather than guessed at.

A document that expects a refusal now pins its diagnostic codes. Renaming a code becomes a change to
the corpus, which is the point: a code is part of what a refusal tells its reader.

The hand-written lists inside the SDK suites are not removed by this. They are made visible: adding a
fixture without wiring it fails, so the lists stop being able to fall behind in silence. Converting
them to enumeration remains worth doing and is now optional rather than load-bearing.

## Alternatives rejected

**Run the SDK suites in CI and call the reader covered.** This was the shape first proposed, and its
own falsification refuted it: plant a fixture the reader cannot parse and the gate stays green,
because the reader was never given it. Running a suite puts the reader beside the gate. Three
documents were in exactly that position when this was written.

**Declare the expectation inside the document.** Contaminates what is being parsed. Every reader would
have to know to ignore a slot, and a reader that forgot would be testing a document nobody ships.

**Keep a list of skips for the documents that must be refused.** The enumeration exists because a
hand-written list falls behind; answering its first red with a hand-written list returns the defect
with a new name, and the entries would then be indistinguishable from forgetting.

**Write an exemption for the two documents both SDKs skipped.** Rejected because the premise for it
was false, and the reasoning is worth keeping: an exemption written on a suspicion is a forgetting
with a stamp. It would have been permanent, argued, and wrong.

## Verification

`npm run test:contract-schema --check`, which is gate 22 of `npm run test:contracts`, and the Rust
suite as a CI step.

Each half was planted and observed to fail, and observed to pass again once restored:

- a sidecar declaring the wrong verdict — *declares valid=true, the parser says false*, exit 1;
- a sidecar naming one code too many — both lists printed side by side, exit 1;
- a sidecar naming no document — *names no document*, exit 1;
- a document neither reader names — one finding per reader, each naming which one is blind, exit 1.

The exit code was read without a pipe: `$?` after `| tail` is the status of `tail`, and the first
reading of it said 0 while the audit was failing.

## Security and privacy

None. The corpus is test data committed to the repository, the audit reads files already present in
the checkout, and no fixture carries credentials or personal data. The one boundary worth naming is
that the visibility gate reads SDK sources as text: it reports file names it found there, which are
names already in this repository, and it executes nothing it reads.
