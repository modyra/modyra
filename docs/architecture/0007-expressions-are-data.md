# ADR 0007: Expressions are data, never code

Status: Accepted. Extends [ADR 0005](0005-expressions-and-references.md), which established the same
rule inside the Studio model; this carries it into the public contract. Amended 2026-08-11 —
"inert includes finite", below.

## Context

A Modyra form can arrive as **data** — from a configuration file, a CMS, a code generator, a language
model, or a visual builder's export. That is the point of the Dynamic Form Contract, and it is also
the whole of the threat model: a document from any of those sources is untrusted input.

Conditional logic is the pressure point. "Require shipping when the country is not IT and the total
is over 100" is exactly the kind of rule a form needs and exactly the kind a naive design expresses
as a snippet of JavaScript. A contract that carries a code string and evaluates it has handed
arbitrary execution to whoever wrote the document, in the user's browser, with the user's session.

Until now the contract could not express the rule at all — cross-field validation had nowhere to go —
so the pressure to add "just a small expression string" was real and would recur.

## Decision

Conditional logic in the public contract is a **data structure**, `MdyExpression`, and never a code
string.

- **A closed operator set.** Twelve: `equals`, `notEquals`, `isEmpty`, `isNotEmpty`, `lengthAtLeast`,
  `lengthAtMost`, `greaterThan`, `lessThan`, `matches`, `and`, `or`, `not`. Adding one is a contract
  change with a changeset, not something a consumer may extend.
- **No `eval`, no `new Function`, no dynamic property dispatch.** Evaluation is a `switch` over the
  enumerated operators. There is no path by which document content becomes executable.
- **Operands are literals, path references, or nested expressions.** A `{ path }` reads a field's
  value; nothing else reaches outside the value being evaluated.
- **`matches` takes its pattern only from a literal.** A pattern supplied through a `{ path }` — that
  is, chosen by a form's own data — is ignored. Otherwise a value in the document selects the regular
  expression, which is how a catastrophically backtracking pattern gets in.
- **Addressed by path, not by id.** The contract names fields the way a form reads them. Node ids are
  a Studio concept; `toContractExpression` resolves them at the export boundary (ADR 0005).
- **Malformed expressions are reported, not thrown.** `parseDynamicForm` validates operator, arity,
  pattern and referenced paths, and returns diagnostics. A document with a broken rule is rejected at
  parse time rather than surfacing as a rule that silently never fires.
- **An unknown operator evaluates to `true`.** That is the safe direction for both consumers: a
  visibility rule keeps the field visible, and a validation does not fire. An unreadable rule never
  hides a field or invents an error.

## Consequences

- Some rules cannot be expressed, and that is deliberate. Business logic beyond the operator set is a
  `StudioImplementationRef` or a host-supplied validator — a named thing the host provides, never
  code inlined into a document.
- Adding an operator is coordinated work: core's interpreter, `studio-codegen`'s emitter, and the
  contract's validator all move together.
- There are two implementations of one semantics — core interprets, `studio-codegen` prints source.
  This is the standing cost of supporting generated targets, and it needs a test rather than
  vigilance.
- The evaluator is pure and DOM-free, so the same rule runs in a browser, on a server, in a worker
  and in a test.

## Alternatives rejected

- **A JavaScript expression string, evaluated with `new Function`.** Remote code execution from any
  document source. Not mitigable by sanitising the string.
- **A JavaScript expression string, parsed by a sandboxed mini-interpreter.** Moves the attack
  surface from `eval` into a parser this project would own and have to keep safe. The operator set
  covers the cases without the parser.
- **A general expression language (JSONLogic, CEL).** More capability than a form predicate needs,
  with a dependency and a specification whose security properties this project does not control.
- **Allowing `matches` to take its pattern from a field.** Rejected as a denial of service:
  the pattern is attacker-chosen and the input is attacker-chosen.

## Verification

- `packages/core/test/expression.test.mjs` — every operator, emptiness semantics, and the proof that a
  data-supplied `matches` pattern has no effect. Also six malformed shapes, each reported rather than
  thrown.
- `packages/core/test/expression.test.mjs` also covers the depth bound: a 40- and a 2000-level
  condition reported as diagnostics with the validation dropped, a cyclic expression refused by all
  three entry points, and a real four-level condition still accepted.
- `packages/studio-contract/test/expression.test.mjs` — core's interpreter and `studio-codegen`'s
  compiler over the same inputs, required to agree, including refusing the same depth. The comparisons are exercised **on their
  boundary**: written without that, a mutated `lessThan` passed unnoticed, because `<` and `<=` agree
  everywhere except at equality.

## Amendment, 2026-08-11: inert includes finite

Data cannot execute, and this record treated that as the whole of the safety. It is not: a document
that only *describes* a predicate can still exhaust the call stack of whatever walks it. Every
recursive part of the contract was bounded — schema depth 8, 500 nodes, layout depth 6, 100 initial
rows, 256 characters of pattern — except the expression tree.

The gap was reachable with an ordinary document. `JSON.parse` walks deeper than this parser did, so
a 52 KB document nesting `and` two thousand deep arrived intact and the parser died on it with
`RangeError: Maximum call stack size exceeded` — a thrown stack overflow where this record's own
verification promises "each reported rather than thrown", and where the parser is the trust boundary
the whole contract rests on. An expression built as an object graph rather than parsed from JSON
could also carry a cycle, which spun the same way.

**An expression nests at most `MDY_MAX_EXPRESSION_DEPTH` (32) levels.** Past it, validation reports a
problem like any other malformed shape, path collection stops, and evaluation returns the value an
unreadable rule already returns — `true`, which keeps a field visible and fires no error. A cycle
meets the bottom rather than spinning.

The bound holds on both sides of the parity this record requires: `@modyra/studio-contract`'s
translation refuses a deeper condition with `ExpressionTooDeepError`, which its compile step reports
as `EXPRESSION_TOO_DEEP` rather than as a missing reference, and `@modyra/studio-codegen`'s compiler
refuses it too. The generator states the number locally rather than importing it: it depends on the
Studio model alone, and giving it a dependency on the contract to share a constant would cost more
than the duplication — the parity test is what keeps the two honest.

Thirty-two is far above what an author writes (a real condition is three or four levels) and far
below what the stack allows. It is a limit on the *document*, not on what a form can express: a rule
too complex for one condition is two conditions.

## Security and privacy

This is the security decision of the dynamic contract. A form document is untrusted input from a
network, a CMS, or a model; the contract's job is to be inert data all the way down. The residual
surface is `matches`, where a literal pattern from a hostile document can still be expensive — bounded
by the pattern being fixed at authoring time rather than chosen per evaluation, and by the pattern
being visible in the document for review. Beside it sits **depth**, bounded by the amendment above:
an unbounded recursive walk over attacker-supplied structure is a denial of service whether or not
the structure is inert, and the parser is where that has to be refused.

Client-side evaluation remains defence in depth: a rule enforced here is a rule the user experiences,
not a rule the server may trust. See [ADR 0009](0009-client-validation-is-defence-in-depth.md).
