# ADR 0104: Change is decided by `Object.is`

Status: Accepted

## Context

`runReactivityContractTests` is the gate an adapter passes to claim it implements `MdyReactivity`:
pass it and the framework treats the runtime as one a form can be built on. A gate is worth what it
refuses, and eleven deliberate defects run against it showed nine refused and one accepted — a
runtime whose **default** equality is `===` rather than `Object.is`.

The suite had a case for a *declared* comparator ("a declared signalEquality is actually honoured")
and none for the comparison a runtime makes when nothing is declared. The contract never stated
which it should be, so both were conformant and they differ on exactly two values:

                 0 → -0                 NaN → NaN
    Object.is    notifies               does not notify
    ===          does not notify        notifies

A number field holding `0` and written `-0` re-renders nothing; a field holding `NaN` re-renders on
every write of the same `NaN`. Neither is visible in a type, and every other case of the suite passes
either way.

`@modyra/solid` was one of them. Its comment claimed Solid's default was "Object.is-like"; Solid's
default is `===`, and the claim had never been measured. The adapters written against Vue, React,
Preact and Svelte were measured and already agree with the reference runtime.

## Decision

A runtime that declares no comparator decides change with `Object.is`, and the conformance suite
requires it: writing `-0` over `0` notifies, writing `NaN` over `NaN` does not.

`@modyra/solid` passes `Object.is` explicitly to `createSignal` and `createMemo` rather than letting
Solid's default stand.

## Consequences

An adapter for a runtime whose native default is `===` — Solid, and any other that follows it — must
override that default to conform. That is a comparator call per write on a hot path, which is what
the runtime was already doing, one function deeper.

A host that *wanted* `===` semantics can still have them per signal, by declaring `equal`. What is no
longer available is having them by saying nothing, which is the case where nobody chose.

The suite gains a case, so an adapter that ran it and passed may now fail. That is the point: the
failure is real and predates the case.

## Alternatives rejected

**Leave the default undeclared and document the divergence.** The divergence is invisible: no type
moves, no error fires, and the symptom is a control that does not re-render for one value out of
every number a person can type.

**Require `===` instead.** It is what one runtime happens to do, against four that do not, and it
makes `NaN` a value that never settles.

**Test it only in the adapters that need it.** The gate exists so a renderer outside this repository
can be held to the same contract. A case that lives in one adapter's own suite holds nobody.

## Verification

- `packages/core/src/testing/reactivity-contract.ts` — the case, run by every adapter's suite through
  `npm run test:adapters`.
- `battle-tests/adversarial/reactivity/a-conformance-suite-that-lets-one-through.battle.test.mjs` —
  runs the published suite against a deliberately `===` runtime and requires it to be refused, with
  the reference runtime beside it as the control so "refuses everything" cannot pass.

## Security and privacy

No trust boundary moves. The failure mode is an integrity one at the display layer: a value the form
holds and a value the page shows can disagree, silently, for the two values the two comparisons
differ on.
