# ADR 0087: A target answers with everything it knows about the project

Status: Accepted

## Context

A Studio target answers two questions: `analyze` says whether it can express a project, and
`generate` emits the files with the diagnostics it found. `studio-target-json` asks the contract
compiler and reports what it says. The three code targets — `core`, `react`, `angular` — asked only
their own generators.

Measured with a field whose `fieldKind` no catalog declares:

```
compileToContract   UNSUPPORTED_FIELD_KIND, MDY_DYNAMIC_INVALID_FIELD
json                compatible false, both diagnostics
core / react / angular   compatible TRUE, nothing said
```

The generated code compiles, which is the promise those targets keep, and the form declares a field
that is not the control the author drew. The author's tooling has no line to stop on.

Two facts are being conflated, and the repair depends on separating them. *This project cannot be
expressed* is a fact about the project and belongs to every target. *The Dynamic Form Contract has
no equivalent for a server validator* is a fact about the **contract document**, and the code
targets emit server validators — repeating it would tell an author something was dropped that this
target carries.

## Decision

A target's diagnostics carry three sources: its own generators, the contract compiler's **errors**,
and its own **capability gaps**.

- Contract-compiler errors reach every target, because a project the compiler cannot express is one
  no generator makes valid by generating differently.
- Contract-compiler warnings do not. They describe the document the compiler is building, and a
  target that expresses more than the contract would be reporting a loss it did not take.
- A field whose kind is not in the target's own `capabilities.fieldKinds` is reported by the target
  itself, as a `warning`, through `capabilityDiagnostics` in `@modyra/studio-codegen` — the sibling
  of `arrangementDiagnostics`, which already reports what a target cannot carry.

The capability warning is not an error: the field still generates, so the project stays compatible.
What is lost is the control the author chose, not the value the field holds.

## Consequences

`@modyra/studio-target-{core,react,angular}` now depend on `@modyra/studio-contract`, which
`studio-target-json` already did. The dependency is acyclic — the contract compiler depends on
`studio-model` and `@modyra/core` only.

`capabilities.fieldKinds` stops being decorative. A target whose list is narrower than what its
mapper actually supports now emits a warning nobody asked for, so the list has to be kept honest —
which is the point of publishing it.

A target's diagnostics for one project can name the same field twice, once from the compiler and
once from its own capabilities. That is two different statements — what the contract could not
express, and what this target cannot draw — and merging them into one would lose which is which.

## Alternatives rejected

**Merge every compiler diagnostic.** Measured first: the healthy checkout fixture gains
*"Server validator on 'coupon' has no Contract v2 equivalent and was omitted"* — false for these
targets, which emit it. A repair that makes a target lie about a working project is worse than the
silence it replaces.

**Filter the compiler's warnings by code.** A blocklist of codes drifts the moment the compiler
gains one, and it puts knowledge of the contract's vocabulary in three targets that should not carry
it.

**Ask the compiler only, and drop the capability check.** The compiler's verdict on an unknown kind
is a warning by deliberate design (an error would cost the author every other field), so no
severity rule carries it. Reading the target's own declared capabilities answers the target's own
question without borrowing another package's severity choices.

## Verification

`battle-tests/adversarial/studio/every-target.battle.test.mjs` — *every target answers for a project
the model calls broken* and *a field the author declared reaches the output under a name, or is
reported*, both through the packed tarballs. `packages/studio-target-*/test/*.test.mjs` holds the
control: the checkout fixture generates with no diagnostics at all, so a false positive on a healthy
project fails there.

## Security and privacy

None directly: no new input is read and no boundary moves. Indirectly, a project carrying a field
kind nobody declares is now reported rather than generated in silence, which is the case where a
value reaches a control nobody chose.
