# ADR 0098: A fixture's context lives beside it

Status: Accepted

## Context

`spec/fixtures/dynamic-form/` is the corpus three runtimes read: the TypeScript parser, the Rust SDK
and the Java SDK each parse the same documents, and the agreement between them is what makes the
contract one contract rather than three implementations of a similar idea.

Contract v4 added conditions that read **context** — values the host supplies, declared by the
document in `requiresContext` and read as `{ "context": "key" }`. A condition that reads a key the
host did not supply refuses the build, deliberately: a condition that cannot be read decides false,
so the fields it guards would never appear, and finding that out before anything is painted is the
point (ADR 0092).

That leaves the corpus unable to carry the half of v4 that matters most. A fixture using context
cannot be built by a consumer that has only the document, and the consumers the corpus has —
including the battles that build every fixture — have only the document.

## Decision

A fixture's context lives in a twin file named for it: `context-conditions.json` is built with
`context-conditions.context.json`, whose contents are the context object passed to
`buildDynamicFormSchema(schema, { context })`.

A fixture with no twin is a fixture built **without** context. That is the corpus as it was, so every
existing consumer keeps its behaviour, and a consumer that never learns about twins still reads every
document correctly — it simply cannot build the ones that need a host.

The document stays exactly the document. A `context` slot inside the fixture would make the document
carry something the contract says belongs to the host, and the first person to write a parser from
the corpus would implement a slot the contract does not have.

## Consequences

A consumer of the corpus that wants to build every fixture has to look for the twin. The three
battles that build every published fixture do exactly that, and until they read the twin a fixture
with context makes them throw — which is the correct refusal reaching an unprepared reader.

The corpus now has two kinds of file in one directory, so anything walking it has to skip
`*.context.json`. The audit does, and reports a twin that names no document.

The twin is a fixture of the *host*, so it is as much a published thing as the document: changing it
changes what the corpus proves, and the runtimes compare their results against a context they all
read from the same file.

## Alternatives rejected

**A `context` slot inside the fixture.** One file to read, and a document carrying what the contract
gives to the host. It would teach a reader a slot that does not exist.

**No context in the corpus.** The cheapest option and it leaves the conditional semantics v4 was
added for — the ones the cross-runtime work exists to prove identical — untested across the three.

**A single context file for the whole corpus.** One file cannot say which keys a given document
reads, and a document declaring `requiresContext` for a key the shared file lacks would be
unbuildable for a reason no reader could see from the fixture.

## Verification

`npm run test:contract-schema` walks the corpus, skips the twins and reports one that names no
document. `spec/fixtures/dynamic-form/v4/context-conditions.json` is the first fixture with a twin,
and it is the one that exercises `requiresContext` and `{ "context": … }` at both a root field and a
row's cell.

## Security and privacy

A twin holds test context, not secrets: it is published in the repository and read by three runtimes.
Nothing in the convention gives a document a way to reach a host value it did not declare — the
declaration is still `requiresContext`, and a key read without being declared is still refused.
