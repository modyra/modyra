# ADR 0092: A condition travels with the form

Status: Accepted

## Context

Five public slots take a JavaScript function:

| Slot | Declared in |
| --- | --- |
| `MdyFieldOptions.when` | `packages/core/src/typed-form.ts` |
| `MdyFieldOptions.asyncWhen` | `packages/core/src/typed-form.ts` |
| `MdyGroupOptions.when` | `packages/core/src/typed-form.ts` |
| `MdyAsyncValidatorOptions.when` | `packages/core/src/types.ts` |
| `serverValidator({ when })` | `packages/core/src/server-validator.ts` |

A schema holding one of them is not data. It cannot be stored, sent, versioned, diffed, or checked
anywhere other than the process that built it, and a document arriving at runtime cannot carry one
at all without becoming a remote-code-execution hole — which is why the dynamic contract never
offered the option and says so in `expression.ts`'s own first paragraph.

The consequence is a framework split down the middle. The typed schema expresses a condition as
code; the document expresses it as data, through `MdyExpression` — a closed tree of sixteen
enumerated operators over `{path}` operands and literals, depth-capped at 32, with a cost gate on
patterns, `validateExpression` to report a malformed one and `expressionPaths` to derive what it
reads. The two halves say the same things in two languages, and the seam is where capability is
lost rather than where it is translated:

- Studio holds a `skipWhen` as a serializable `StudioExpression` and then **prints a closure**,
  because `serverValidator()` accepts nothing else.
- When that expression names a field other than its own, Studio **discards it** and reports
  `UNSUPPORTED_SKIP_WHEN` — a capability the model has and the boundary cannot carry.
- A document has no per-field `when` and no condition relative to a collection row. It has
  form-level `rules` targeting a leaf. What the typed form can say, the document cannot.

Measured rather than assumed: every non-test `when` and `asyncWhen` in this repository —
`examples/plain`, `examples/lit`, `examples/angular`, `docs/guides/typed-forms.md`,
`docs/examples/typed-forms`, `packages/studio-preview` — was classified individually against the
existing operator set. All of them are expressible: `equals` on a path, `equals` on a nested path,
`notEquals` on the field's own value, `lengthAtLeast` on the field's own value, `matches` with a
literal pattern, `not` around an expression. **None requires an operator that does not exist.**
About half require a reference to the field's own value, which the language does not have.

## Decision

A condition is data. `when` and `asyncWhen` accept an `MdyExpression` and nothing else, on the
typed schema and in the document alike, so a form's conditions travel with the form.

Three operand forms are added beside `{path}`, and they are the whole of what the language gains:

- `{ self: true }` — the value of the field the clause is written on.
- `{ root: true }` — the whole form value.
- `{ context: "key" }` — a fact supplied by the host application.

An expression is evaluated against **what encloses the clause**. Inside a collection row that is the
row, for both clauses, so a rule written once for an item reads its own row and cannot name a key or
an index. `{ root: true }` is how a row-level condition reaches back out to the form.

A host supplies its context **once for the application, not once per form** — role, tenant, today's
date, feature flags: facts the app has regardless of which document arrives. A document declares the
context keys it reads. A document naming a key the host does not supply is refused before anything
is painted, and the contract version carries the declaration, because a context is an API between
the application and whoever authors documents for it.

An expression is written in TypeScript through a builder that produces exactly that tree and types
its paths against the schema. There is no string syntax and no parser.

The operator set grows only when a real predicate requires it. Today's measurement requires none.

## Consequences

**This is a breaking change**, released major, with a changeset carrying the closure-to-expression
translation table. Sixty-four call sites in this repository change, about ten of them outside tests.

A condition can no longer be impure, because there is nothing left to be impure with. The dev-time
check in `composeConditions` that catches a predicate disagreeing with itself becomes unreachable by
construction and is removed with the tests that exercise it.

Studio stops degrading: `schema-mapper` prints the tree instead of a closure, and
`UNSUPPORTED_SKIP_WHEN` — a diagnostic that existed only to describe this boundary — is deleted
along with the JavaScript compiler behind it.

What becomes harder: a condition needing host logic can no longer be written inline. In a typed form
the host computes the fact into a field and the condition reads that field; in a document it reads a
context key. A condition that needs something neither of those can supply is not expressible, and
that is the intended shape of the limit rather than a gap to be filled later — a document the
application has never seen cannot invoke code the application wrote for it.

`asyncWhen` changes root. Inside a collection row it reads the row where it used to read the whole
form. **This change is silent in the type system**: the expression still compiles, the path simply
does not resolve, and the clause decides `false` — which skips the server call. It is the sharpest
edge of this decision and is guarded by a test rather than by a note in a guide.

The migration is staged, because sixty-four sites in one commit guarantees a broken intermediate:
the operands first (additive, green), then the document contract (additive), and the five slots last.

## Alternatives rejected

**Widen the type to `Predicate | MdyExpression` and deprecate the function.** Additive, classified
minor, breaks nobody today. Rejected because it leaves two spellings for one thing for a whole major
cycle, and every reader in between has to know which wins — the position the contract already
refuses elsewhere, in as many words, for the row track count in v3.

**A separate `whenExpression` option.** The same two spellings, permanently.

**A registry of named host predicates**, where a document names a predicate and the host registers
the implementation. Rejected because it presupposes that the application knows the form. For a
document arriving at runtime that is false by definition: an application cannot have registered a
predicate for a document it has never seen. It would have worked only for the typed half, which is
the half that needs it least.

**Precomputing the fact into a form field.** Rejected as the general answer for the same reason, and
for the same half. It remains the right technique in a typed form, where the host does know the
schema, and it is what the guide teaches there — but it is not a mechanism, so it is not this
decision.

**A string syntax parsed into the tree.** The most readable to write, and the place an editor plugin
would offer completion. Rejected because a parser is a second hostile entry point, held to the same
standard as a path — and because it is a second spelling of a language that already has one. The
tree stays canonical; readability is the builder's job, where the compiler can also reject a path
that does not exist.

## Verification

`npm run contract:diff` classifies the change major. Should it disagree, the differ is reported
before the change proceeds rather than after.

Under `battle-tests/adversarial/`, red before the change and green after:

- a `when` naming a context key the host did not supply **closes** the field and reports a
  diagnostic — never the direction that opens, the property
  `an-operator-nobody-declared.battle.test.mjs` already defends for unknown operators;
- `{ self: true }` inside a collection row reads that row's cell, not the first row's;
- `{ root: true }` inside a row reads the form and not the row;
- `asyncWhen` inside a row reads the row — the behaviour change above, pinned so a regression
  relights it;
- a v2 document with `rules` decides identically after the contract gains v4;
- each closure in the measurement gives the **same verdict** as its translation over the same
  values, as a differential rather than a single assertion — `Object.is` against `===` diverges on
  `NaN` and on `-0`, which is where a translation can be wrong while looking right.

`npm run test:core`, `npm run battle`, `npm run test:contract-schema` (the published JSON Schema
against the parser), `npm run test:studio`, `npm run test:guides`.

## Security and privacy

The direction of travel is toward safety and the reason the dynamic contract was built this way:
a condition that is data cannot execute, and a document from an untrusted source gains no new
capability by carrying one. `{path}` operands pass `isSafeFieldPath` as they already do, so a
document asking about `constructor` is refused rather than answered from the prototype behind the
form. The operator set stays closed, the depth cap and the pattern cost gate stay where they are,
and an unknown operator still decides `false`.

`{ context: "key" }` is the new surface and it points the other way. A context carries role, tenant
and entitlement — the facts an application uses to decide what a person may see — into an expression
that may sit in a document written elsewhere. Two obligations follow. A context value is **read** by
a condition and never written into the form value, so it does not reach the payload, the draft or
the devtools panel by that route; `sensitive` protects fields and has nothing to say about a
context, which is why the boundary is drawn at the value instead. And a condition is not an access
control: hiding a field on `{context:"role"}` decides what is asked, not what is permitted, and a
server that trusts a document's conditions to enforce a permission is trusting input it received
from the client.
