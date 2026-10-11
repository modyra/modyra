# ADR 0223: The Rust reader judges a document by the TypeScript reader's rules

Status: Accepted

## Context

A dynamic form document is read by three runtimes: `@modyra/core` in TypeScript, `modyra-contract`
in Rust and `modyra-contract` in Java. A server that validates a document in Rust and a browser that
renders it in TypeScript have to reach the same verdict, or a document is published by one and
refused by the other ([0136](0136-one-contract-version-set.md)). The shared corpus under
`spec/fixtures/dynamic-form/` is how that is checked: every document declares its verdict, and every
reader's suite reads every document ([0186](0186-the-corpus-declares-what-it-expects-and-who-must-read-it.md)).

The TypeScript reader had moved on and the corpus had not followed. Neither SDK validated an
expression: no depth limit, no operand check, no reference shape, nothing about a `matches`
pattern. Version gating was wrong both ways: `integer` was accepted below v5, and slot and section
placement below v3. The kind list lacked `daterange`, `file` and `colors`. Layout depth was capped
at 6 with the wrong code. Pattern length was counted in bytes, not UTF-16 units, so 200 accented
letters were refused as too long. A pattern that backtracks exponentially, refused by the TypeScript
reader since [0050](0050-a-document-cannot-make-the-form-stop-answering.md), passed both SDKs, and
so did one that does not compile.

## Decision

**TypeScript is the reference, and the Rust reader applies its rules with its codes.** Concretely,
`modyra-contract` (Rust) refuses what `@modyra/core` refuses:

- an expression deeper than 32, without operands, with an operand naming more than one marker or a
  marker of the wrong type, with a list or undeclared object as an operand, or with a `{path}`
  outside its enclosing group;
- `integer` below v5, and slot or nested-section `at` below v3;
- layout deeper than 32 levels, as `INVALID_LAYOUT`;
- a rule value its operator cannot read, and a `validations` entry that is malformed.

It accepts `daterange`, `file` and `colors`, and measures pattern length in UTF-16 units.

**Patterns are judged with ECMAScript's own grammar, through the `regress` crate.** A `matches`
pattern and `validators.pattern` are refused when the ADR 0050 shape test refuses them, and when
`new RegExp(pattern)` with no flags would throw. The shape test is a line-for-line port of
`packages/core/src/dynamic/pattern-cost.ts`. It scans UTF-16 code units, as the reference indexes
them, and its per-character matchers are `u`-flag regexes, compiled by `regress`. `regress` misses
one rule, that `\b` and `\B` take no quantifier, so that rule is checked separately.

**`DynamicFormV2` gains a public `validations` field.** The crate is not published (crates.io
returns 404 for it), so the only struct literals that break are the two in this repository, and
both are updated.

**Expression depth is checked after `serde_json` parses the document.** `serde_json` refuses nesting
past 128 levels on its own, so a document nested beyond that is an `Err` from `parse_v2`, not an
`INVALID_CONDITION` diagnostic. The 32-level rule is enforced on everything that parses.

**The Java reader is left behind, knowingly.** No JDK is available where this was built and no CI
job runs Maven. The Java corpus test is red on 18 documents, and `sdk/java/README.md` § Known red
lists each one with the rule it lacks. A row comes out of that table when its document passes.

## Consequences

- The Rust crate has a third runtime dependency. `regress` 0.12 is MIT OR Apache-2.0, compatible with
  the crate's MIT license. Upgrading it can change compile verdicts; the corpus documents `e`, `r`
  and `s` and the crate's unit tests are what notice.
- The shape test now exists in two languages. A change to `pattern-cost.ts` has to be ported, or the
  readers diverge again. Nothing fails automatically when only the TS file changes: the corpus
  catches a divergence only if a document exercises it.
- One known divergence remains. A group name repeated across alternatives, `(?<y>a)|(?<y>b)`, is
  valid ES2025, and Node 24 accepts it. `regress` refuses it, so Rust refuses a document that
  TypeScript accepts on a current engine. On an older engine TypeScript refuses it too, so the
  reference verdict itself depends on the engine.
- Java's suite is red until it is ported. Anyone who runs `./mvnw test` sees 18 failures, which the
  README explains.

## Alternatives rejected

- **Port the shape test and an ES syntax check by hand, with no dependency.** The shape test builds
  regexes internally (first-character and union matchers tested over a sample alphabet), so a hand
  port needs an ECMAScript regex engine anyway, or a reimplementation of class and escape semantics.
  That is more code to keep in sync than one maintained crate. TypeSafe weighed it at 7%.
- **Leave patterns as a recorded gap.** Rust would then accept a pattern that stops the TypeScript
  form answering (ADR 0050). A server that validates in Rust would approve a document the browser
  refuses, which is the split 0136 exists to prevent. TypeSafe weighed it at 23%.
- **Install a JDK and port Java in the same change.** It would double the scope, on a toolchain that
  is not available here. TypeSafe chose to record the red suite (65%) over installing a JDK and Maven
  now (16%) or keeping a pending list the suite skips (19%). A skip list hides the gap in the place
  where it would otherwise fail.

## Verification

- `cargo test -p modyra-contract` (from `sdk/rust`) reads every corpus document. A mutant removing
  any of the five pattern checks (matches compile, matches cost, validator cost, validator compile,
  `\b` quantifier) fails it, on documents `e`, `d`, `f`, `r` and `s` respectively. The crate's unit
  tests carry the reference's own pattern lists.
- Differential run: the TS `dynamicPatternRefusal` plus `new RegExp`, against the Rust port, over
  80,073 patterns (the TS test file's literals, random token strings and generated nested groups with
  quantifiers; about 25,000 refused). After the `\b` rule, the two agree on every pattern, on both
  the compile verdict and the refusal message. Duplicate group names were excluded from that run; see
  Consequences.
- `node scripts/audit-contract-schema.mjs` keeps every corpus document consistent with the JSON
  Schema, and `npm run test:docs` keeps this record indexed.
- There is no automatic check that `pattern-cost.ts` and `pattern_cost.rs` change together. That gap
  is what Consequences states.

## Security and privacy

A document is untrusted input ([0007](0007-expressions-are-data.md)), and this decision moves the Rust
reader's trust boundary to where TypeScript's already is. Before it, a Rust server validating a
document would approve a `validators.pattern` or `matches` pattern that hangs a browser's main thread
(ADR 0050), and an expression of unbounded depth. Both are now refused before the document is
accepted.

The Rust reader never runs a document's pattern against input. It compiles the pattern and inspects
its shape. The only matching it does is of single sample characters against anchored fragments of
the pattern, and the pattern is capped at 256 units before any of that starts. The check's own cost
is bounded by that cap; it was not measured separately. The Java reader still approves both shapes, and the README
records that. A Java server is not a safe gate for patterns until it is ported. No data at rest or in
transit is affected.
