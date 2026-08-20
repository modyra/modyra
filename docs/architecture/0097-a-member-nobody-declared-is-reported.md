# ADR 0097: A member nobody declared is reported

Status: Accepted

## Context

A dynamic form document is checked in three places before it becomes a form:

- the TypeScript type, when the document is written as a literal — an excess property is a compile
  error;
- the published JSON Schema, which closes every one of its objects with
  `"additionalProperties": false`, and which the editor extension points every `*.form.json` at;
- the parser, which is the only one of the three that decides what reaches a form.

The first two are the two a document can arrive without. A configuration stored in a CMS, generated
by a model or assembled by a server was never a literal and never met an editor. The parser was
silent about every member the other two refuse — on a field, on an option, on a rule, on a
validation, on a layout node — so the one check such a document does meet said nothing.

The two lists had also drifted. The published schemas declared twelve members of a field where the
contract has twenty-two: `mode`, `searchable`, `accept`, `presets`, `locale` and seven more were
refused by the editor in documents the parser reads.

## Decision

The parser reports a member the contract does not declare, at the path where it is written, as
`MDY_DYNAMIC_UNKNOWN_MEMBER`. It reports rather than drops: a reader may meet a document written
against a contract it predates — that is what lets a v3 document be read by a v2 parser — so the
member is a finding and the field, rule, validation or layout node it sits on is kept. What a
publishing gate does with a finding stays the gate's decision: in strict mode a document with any
finding is refused, and in lenient mode it renders.

The members of each slot are declared once, in `MDY_DYNAMIC_MEMBERS`, and published.
`npm run test:contract-schema` holds them against the `properties` of every published schema in both
directions, so a member added to one and not the other is a gate failure rather than a document one
surface accepts and another refuses.

## Consequences

A document carrying a member this contract does not have no longer passes a strict parse. That is the
point, and it is a change for any host that was publishing such documents through a strict gate:
their documents were being read with the member ignored, and now they are told.

A member added to the contract has to be added in two places — the type and the published schema — or
the audit fails. That is the cost of the schema being a second surface at all, and it is the failure
mode the audit exists to make loud.

The lists are hand-written from the types rather than derived from them: TypeScript's members are not
readable at runtime. The audit compares them against the published schemas, so the two published
surfaces cannot drift from each other, but neither is checked against the type. A member added to a
field's interface and to neither list is still unreported.

## Amendment: at every depth, and on a slot

The rule was applied to the *top* of the layout only, and to the two node kinds. A layout nests — a
row inside a section inside a row — and a stray member on a nested node was as unread as one on the
outermost, with nothing said about it.

The `layoutSlot` list had no reader at all. A slot is the third shape a layout position takes, beside
the two node kinds: `{ref, at}`, a field name and where it sits. It is also where a stray member
costs the most, because `at` is *how* a field says which column it takes at which size — a slot
written `att` is a placement that never happens, and the document parsed clean in strict mode with
the misspelling kept in the parsed layout and handed to whatever draws it.

The parser now walks the whole layout tree, holding every node to its kind's list and every slot to
`MDY_DYNAMIC_MEMBERS.layoutSlot`, and reports at the path where the member is written —
`/layout/0/columns/1/0`, not `/layout/0`. A slot is told apart from a node by carrying `ref` and no
`kind`.

The walk is over a stack and bounded by the same depth the layout validator enforces: the depth here
is the document's own, and a document is untrusted input.

## Alternatives rejected

**Drop the member and the node with it.** It would make a reader refuse a document that a newer
publisher wrote for a newer reader — the compatibility the version numbers exist to provide.

**Report only in strict mode.** The lenient reader is what a CMS-driven host runs, and it is the host
with no other check at all.

**Derive the member lists from the published JSON Schema at runtime.** It would make the parser read
a file it does not ship, and it would make the schema — the surface most likely to be stale —
authoritative over the parser.

## Verification

`battle-tests/adversarial/dynamic-contract/a-key-the-schema-refuses.battle.test.mjs` offers an
undeclared member to each of the five slots and requires the parser to say something about each.
`npm run test:contract-schema` compares the member lists with the published schemas in both
directions. `packages/core/test/dynamic-diagnostics.test.mjs` holds a document that produces the new
code and the phrase its message is recognised by.

## Security and privacy

A member nobody declared is a member nothing reads, and reading it was never the risk — the risk is a
document that a host believes was checked. A stored or generated document now gets an answer from the
one surface it meets, which is where `ai-generated-forms.md` puts the enforcement: prompts reduce
waste, the parser enforces the contract. Nothing about the member reaches a form, and the report
carries the member's name only, not its value.
