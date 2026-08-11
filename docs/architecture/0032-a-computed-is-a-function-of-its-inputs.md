# ADR 0032: A computed is a function of its inputs

Status: Accepted

## Context

Modyra's engine runs on whichever reactivity the host brings: its own vanilla graph, Angular's
signals, `@vue/reactivity`, Solid's, Svelte's, Lit's. `MdyReactivity` is the contract that makes one
engine work on all of them, and every difference between those graphs that the contract does not
pin is a difference a consumer discovers by shipping.

One such difference went unnoticed until an audit looked for it: **writing a signal inside a
`computed`**. The vanilla graph allowed it silently. Angular refuses it outright — `NG0600`,
"Writing to signals is not allowed in a `computed`". So the same code — a widget controller, a
derived field state, anything shared — could pass every test on the framework-free renderer and
throw the moment an Angular application used it.

The gap was theoretical when it was found: no `computed` in `@modyra/core` or `@modyra/widgets`
writes a signal, checked across every one of them. It was theoretical only because nothing had
written that code yet.

## Decision

**A computed derives a value from its inputs and writes nothing.** Writing a signal while a computed
is recomputing is refused.

The rule holds under every reactivity, because it is a property of what a computed *is* rather than
of any one implementation:

- a computed **may never run at all** — nothing read it — and may run again whenever something
  invalidates it. A write from inside therefore happens a number of times the program never states;
- the order of those writes is the order in which consumers happened to read, so the final value
  depends on who looked first. That is the definition of a glitch;
- a write can invalidate the computed that is performing it, which is a cycle the graph cannot see;
- and code shared across adapters must obey the strictest graph it will ever run on, or it works
  only under some of them.

`MdyReactivityCapabilities.pureComputeds` states whether a graph **notices** the breach. The vanilla
graph enforces it and throws `MdyComputedWriteError`; Angular's adapter reports `true` because
Angular enforces the same rule itself; the graphs that cannot see it report `false`. **`false` is not
permission.** It says the rule is unenforced there, not that a write is allowed — which is why the
capability is a required field: an adapter author has to answer the question rather than inherit a
default.

`untracked` does not lift the ban: it says "do not depend on what I read", not "this is no longer a
computed". An **effect** is where a write belongs, and an effect running while a computed is being
read — a flush reached from inside a read — is not that computed's body.

## Consequences

Code that wrote a signal inside a computed and worked on the vanilla graph now throws there. That is
the point: it was already broken under an adapter that refuses it, and failing at the write is how
the author learns which line to move.

Every implementation of `MdyReactivity` must now declare `pureComputeds`. For an adapter outside this
repository that is a compile error until the field is added — a deliberate cost, because a silent
default would have every new adapter claiming whichever answer we chose for it.

A graph reporting `false` still permits the write at runtime. The rule is documented everywhere and
verified where it can be, which is the most an interface over five different runtimes can do.

## Alternatives rejected

**Leave it unpinned.** The status quo, and the reason a defect could have shipped: the contract was
silent, so "correct" depended on which adapter the author happened to test.

**Warn instead of throwing, or throw only in development.** A rule that holds in development and
lapses in production teaches the opposite of what it says, and the graph that already refuses this
throws in production too. A warning is also easy to not read.

**Make the capability optional.** It would have avoided the breaking change, and it would have let
every existing adapter stay silent on a question it has to answer. The compile error is the
migration.

**Ban writes in effects too.** An effect exists to act on a change; writing there is ordinary and
intended. Only a computed's body is a place where a write cannot mean anything.

## Verification

`packages/core/src/testing/reactivity-contract.ts` carries the case, so every adapter that runs the
contract suite is checked against its own claim: a graph reporting `pureComputeds: true` must throw
on a write inside a computed. The same test asserts the two places a write stays ordinary — after
reading a computed, and inside an effect — so a guard that refused too much would fail it.

`packages/core/test/reactivity.test.mjs` covers the vanilla graph directly, including `update()` and
a write wrapped in `untracked`, and the pre-existing "capabilities never claim a fictitious
guarantee" case covers the other direction.

Remove the enforcement and the contract case fails for the vanilla graph and for the testing harness.

## Security and privacy

None. Nothing here crosses a trust boundary or touches data at rest or in transit: the rule concerns
when a value may be written inside the process that already holds it.
