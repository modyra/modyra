# ADR 0038: An adapter does not redeclare what it derives

Status: Accepted

## Context

An adapter needs the engine's types shaped for its own reactive primitives — Angular's handle
carries `Signal<T>` where the engine's carries `MdySignal<T>`. Narrowing is legitimate and the
package cannot work without it.

What was happening instead was restatement. `MdyArrayHandle`, `MdyRecordHandle`, `MdyItemHandleTree`
and `MdyFieldHandleTree` were written out member by member in the Angular adapter — in the same file
whose own comment records that a copy had already drifted once, which is why `MdyFieldHandle` beside
them was derived. The lesson had been learned, written down, and not applied to the four types next
to it.

A restated type is not a compile error when the source gains a member. It is a compile error later,
somewhere else, or it is a runtime surprise — and either way the adapter has quietly published a
narrower contract than the one it claims to implement.

The same shape in prose: an upstream package's documentation naming a downstream one inverts the
dependency and goes stale the moment the set of consumers changes.

## Decision

**An adapter derives or aliases; it does not restate.**

A framework-specific narrowing is expressed as a transformation of the upstream type — a mapped
type, a generic instantiation, an alias — never as a fresh declaration with the same members. If the
narrowing cannot be expressed as a derivation, that is a finding about the upstream type's shape,
and the upstream type changes.

The rule covers prose as well as code: an upstream package describes its contract, not who consumes
it.

## Consequences

Adapter types are harder to read at a glance — a derived handle shows a mapped type where a
restatement showed a member list, and an IDE resolves it in one more step.

It also constrains upstream: a type that cannot be narrowed by derivation forces a change in
`@modyra/core` or `@modyra/widgets` rather than a local workaround in one adapter. That is the point
and it is the cost — an adapter can no longer solve its own problem alone.

## Alternatives rejected

**Restate and test the equivalence.** A test that two type declarations agree is a test that has to
be written for each pair, kept in step by hand, and remembered by whoever adds a member. It moves
the drift rather than preventing it.

**Publish only the upstream types and let hosts widen.** It makes every adapter consumer handle
`MdySignal` where their framework has a native signal, which is the ergonomics the adapters exist to
provide.

## Verification

- `node scripts/audit-type-mirroring.mjs` — structural comparison of every adapter-exported type
  against the upstream surface; a member-by-member copy fails, a legitimate signal rebranding is
  recorded with its reason and the list can only shrink. Currently **0 mirrored shapes against 164
  upstream ones**.
- `node scripts/audit-package-independence.mjs` — fails on an upstream file naming a dependent, in
  code or in comment.

## Security and privacy

None. Type derivation is erased at build time and reaches no runtime boundary.
