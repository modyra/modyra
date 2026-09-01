# ADR 0185: A word the language gains takes a number

Status: Accepted

## Context

`integer` was a rule a form could be given by hand and not by document. `integer()` attaches
`step: 1`, which is what lets a number box offer whole numbers to the keyboard, so the same form
written the two ways produced two different controls — and a document had no way to ask for the one
that did.

The obvious repair was to add `integer` to the document's validator vocabulary. It was made, and
`test:contract-schema` refused it:

    spec/dynamic-form-v{2,3,4}.schema.json:
      validators omits member(s) the parser reads: integer

The parser had gained a word the three published schemas did not have. That gate compares what the
parser accepts against what the spec files declare, and this is the first time it has stopped a
change rather than agreed with one.

The question it forced is not "which file is behind". All three versions are published — v4 shipped
in 2.4.0, and 2.5.0 is on npm — so a word added to any of them changes what that version *means*
after the fact. Two readers that both claim to support v4 would then disagree about whether a v4
document carrying `integer` is one, which is the exact failure a version number exists to prevent.
This repository has already recorded that failure once, about itself:

> two renderers written against "contract version 1" would then have implemented two different
> anatomies, and the number that exists to prevent exactly that said they were the same.

## Decision

**A word the declarative language gains takes a new version number.** `integer` arrives with
**contract v5**, and `spec/dynamic-form-v5.schema.json` is its first published shape. v4 and below
refuse it, naming the version that has it.

**A version's arrival is declared once, in the contract, and read by everything that needs it.**
`MDY_DYNAMIC_MEMBER_ARRIVALS` maps a slot's member to the version it arrived with. The parser reads
it to refuse the word in a document that predates it; the schema audit reads it to excuse the
published schemas that could not have had it. Two readers of one fact, because the alternative — the
arrival spelled out in each — is a pair that agrees until somebody edits one of them.

**The supported-version list is declared once too.** It was written in four places: the type union,
the two sentences a person reads on a refusal, and the check that accepts an envelope. A list spelled
out in each is a list that agrees until somebody adds a version and updates three of them.

## Consequences

`MdyDynamicFormParseResult.version` is now `1 | 2 | 3 | 4 | 5 | null`. A consumer switching
exhaustively over it gains an unhandled case, which is a compile error rather than a surprise at run
time — the reason this ships as a major.

A v5 schema is a fourth file to keep in step, and the count is worse than it looks: the same
vocabulary is declared in TypeScript, in three JSON Schema files, and in a Java record under `sdk/`.
Five files in two languages per new word, and the Java mirror is already a member behind — it has no
`messages`. That cost is an argument about *how* the mirrors are kept, not about whether the word
gets a number, and it is not settled here.

The word is small and the ceremony is not. That ratio is the honest cost of a version number meaning
something: it is cheap to add a word to a published version and expensive to discover, later, that
two readers disagreed about what the version was.

## Alternatives rejected

**Add `integer` to v2, v3 and v4.** What the failing gate would have accepted, and what makes the
three published languages retroactively different from what shipped.

**Add it to v4 only, as the newest.** The version that first suggested itself, and it fails on a
fact rather than a principle: v4's schema was published in 2.4.0. "Newest" and "unpublished" are not
the same property, and only the second would have made this safe.

**Leave `integer` undeclarable until a version carries more.** Genuinely cheaper — the ceremony is
per version, not per word, so a v5 carrying four words costs what this one costs. Rejected on the
user's decision: the gap is real today, and a word waiting for company is a gap that stays open for
however long the company takes to arrive.

**Let the parser accept it everywhere and teach the audit to ignore the difference.** Silences the
one gate that caught this, in the direction of agreeing with whatever the parser does. A gate that
defers to the thing it checks is not one.

## Verification

`packages/core/test/a-rule-a-document-can-say.test.mjs` asserts both halves: v5 accepts the word and
carries it to the field, and v2, v3 and v4 each refuse it with a message naming the arrival version
and the document's own. The equivalence is asserted by comparing facts **between the two routes**
rather than by asserting `step: 1` — asserting the fact alone would also pass against a document
language that hard-coded it with no rule behind it.

`test:contract-schema` is the gate that forced this record, and it now holds four schemas against the
parser.

The refusal sentence's version list is checked by probing the parser for the versions it accepts
rather than by a list written in the test, so the assertion cannot drift from the implementation the
day a sixth version arrives.

What is **not** guarded: nothing checks that the Java mirror carries what the TypeScript declares.
That gap predates this record — `messages` is missing there today — and is named in Consequences
rather than closed.

## Security and privacy

None. A document declaring `integer` constrains a number more tightly than one that does not; no
data crosses a boundary and nothing is persisted. The adjacent effect is a small improvement: a
document from a network or a CMS that declares a rule the reader's version predates is now refused
with the reason, where a reader that quietly ignored the word would have validated less than the
document asked for.
