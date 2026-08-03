# ADR 0006: One UI contract, many consumers

Status: Accepted

## Context

Every renderer draws the same controls: a select that opens, a datepicker whose calendar takes the
keyboard, an overlay that dismisses. Implemented per framework, that behaviour is written as many
times as there are adapters, and the copies diverge — not visibly, but in the places nobody looks.
Measured in this repository: a policy adopted by one renderer alone was wrong in that renderer every
time, while a policy two renderers shared was right in both. Divergence is not a risk here, it is the
observed default.

Two failure modes follow. A renderer that copies another renderer's internals inherits its
accessibility bugs and its ARIA guesses. A renderer that reimplements from the visible behaviour
produces something that looks the same and answers the keyboard differently.

## Decision

`@modyra/widgets` is the complete framework-agnostic UI contract: controller state, intents, parts,
commands, typed structural anatomy and accessibility projection. A renderer **consumes** it. It does
not redefine it, and it does not copy another renderer.

The anatomy is metadata, not a virtual DOM — it says what a part is and where it sits, never how to
create it. Rendering stays the renderer's.

Any intentional divergence between renderers must be explicit, justified, and contract-tested. An
undeclared difference is a defect regardless of which side is nicer.

**Dependency direction is part of the contract, in code and in prose.** `@modyra/core` and
`@modyra/widgets` are consumed by the adapters and know nothing of them. An upstream package naming a
dependent — even in a README — inverts the responsibility and goes stale the moment the set of
consumers changes.

## Consequences

- A behaviour change is a contract change: it lands once, upstream, and every renderer gets it. It
  also means a renderer cannot fix its own bug locally without either changing the contract or
  declaring a divergence.
- The contract carries things no single renderer needs, because it must serve all of them. Some of
  it is consumed by checkers rather than by rendering, which is a distinction worth keeping explicit.
- Adding a renderer is bounded work with a pass/fail answer, not an open-ended port.
- Upstream documentation cannot use a concrete adapter as its example, which sometimes costs
  clarity. Describe the contract, not who consumes it.

## Alternatives rejected

- **A reference renderer other renderers follow.** Tried implicitly, when Angular was the golden
  surface: it makes one framework's idioms the specification, and the others inherit accidents of
  that framework's change detection as though they were requirements.
- **A shared component library.** Forces a rendering technology on every consumer, which is the thing
  a multi-framework engine exists to avoid.
- **Per-renderer behaviour, reconciled by review.** This is the status quo the measurements above
  describe. Review does not catch a keyboard difference nobody thought to press.

## Verification

- `npm run test:widget-contract` — the committed semantic baseline; a silent change fails.
- `npm run test:conformance` / `npx modyra-conformance <config>` — each renderer's own DOM, states,
  lifecycle and equivalence, per kind.
- `npm run test:contracts` — includes `audit-package-independence`, which fails on an import that
  crosses the direction, and `audit-docs`, which fails on an upstream README naming a dependent.
- `node scripts/contract-diff.mjs --require-changeset` — a contract change without a changeset fails,
  with a semver verdict.

## Security and privacy

Indirect but real. Accessibility and focus behaviour are security-relevant for anyone who cannot use
a pointer: a focus trap that works in one renderer and not another is a lockout, and an overlay that
dismisses on a different event can leak a visible value into a screenshot or a shoulder-surf. One
implementation means one place to audit rather than one per framework.
