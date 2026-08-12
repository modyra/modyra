# ADR 0037: A vocabulary does not belong to a parser

Status: Accepted

## Context

`MdyValueKind` — text, select, datepicker, the seventeen things a field can be — is the canonical
type of this library. Value contracts are keyed by it, widget contracts are keyed by it, and every
renderer switches on it.

It was defined as `(typeof MDY_DYNAMIC_FIELD_KINDS)[number]`, and `MDY_DYNAMIC_FIELD_KINDS` lived
inside `dynamic-config.ts`: a thirteen-hundred-line module whose job is reading a JSON document that
arrived from a CMS. So the library's central vocabulary was the property of one wire format's
parser, and everything that needed to name a kind imported the parser to get it.

Two costs, both measured. The engine's value contracts could not be read without the document
reader, which is a dependency nobody chose. And it closed a cycle — `dynamic-config → validators →
value-contracts → dynamic-config` — that survived only because the build erases type-only edges; it
would have broken under `verbatimModuleSyntax`, and nothing would have explained why.

## Decision

**A vocabulary lives in a leaf, owned by nobody who uses it.**

`MDY_FIELD_KINDS` is `field-kinds.ts`, a module with no imports. A kind is what a field *is*; where
the declaration came from — a typed schema, a document over a network, a form builder — is a
separate question, asked by whoever is asking it.

The parser keeps `MDY_DYNAMIC_FIELD_KINDS` as its own name for the same list, aliased rather than
restated, because a document's kind set is a fact about the document format even when the two sets
happen to coincide.

The rule generalises: **a shared vocabulary is not owned by its most demanding consumer.** The same
reasoning put the layout sizes in the layer both a document and a renderer reach, and `ValidatorFn`
in a leaf that the field state and the facts combinators can both import.

## Consequences

Three modules exist that did not — `field-kinds.ts`, `contracts/validators.ts`, and the layout size
declaration — each holding a few lines. A reader looking for the list follows one more hop than
before, and gets there without loading a parser.

A leaf is a commitment: it may not grow a dependency later without re-creating the problem. That is
easy to breach silently, which is why the check below is a gate rather than a convention.

The parser's alias means two names for one list. That is the cost of letting the document format
evolve its own kind set without renaming the library's — and if they ever diverge, the alias is the
place that says so.

## Alternatives rejected

**Leave it and document the import.** It was documented. A comment explaining why the value
contracts import a JSON parser is a comment apologising for the structure.

**Move the vocabulary into the value contracts.** Better than the parser and still wrong: the
contracts are one consumer of the list, and the widget catalogue is another. Whichever consumer owns
it, the others import a module they do not need.

**Duplicate the list where it is needed.** Two lists that must agree and nothing that checks it —
the defect this refactor removed in four other places.

## Verification

- `npm run test:import-cycles` — the cycle this closed cannot return unrecorded; asserted in both
  directions, so a stale entry fails too.
- `packages/core/test/core.test.mjs` and the widget contract tests key off `MDY_FIELD_KINDS`; a kind
  added to the leaf and missing from a contract fails there.
- `node scripts/audit-public-doors.mjs` — the vocabulary is reachable from one entry, not two.

## Security and privacy

None directly. Indirectly, the parser is the module that reads untrusted input, and shrinking what
must be imported to name a kind means fewer paths that pull the document reader into a bundle that
never parses a document.
