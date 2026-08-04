# Roadmap

Modyra is moving toward a **narrow 1.0**: a stable promise over a small, verifiable surface, rather
than a version number over everything that ships.

The order below is a sequence, not a wish list. Each phase names what it closes, what proves it
closed, and what it deliberately does not attempt. Completed work belongs in
[CHANGELOG.md](CHANGELOG.md); this file describes only what is ahead.

## What 1.0 covers

**In scope, and versioned 1.0 together:**

| Package | Why it is in |
| --- | --- |
| `@modyra/core` | The form engine and the Dynamic Form Contract. Zero dependencies |
| `@modyra/widgets` | The widget contract: anatomy, states, relations, behaviour. Depends only on `core` |

That is the whole perimeter, and it is a real one rather than a claim:
`scripts/audit-package-independence.mjs` passes, `@modyra/core` declares no dependencies at all, and
`@modyra/widgets` declares exactly one.

**Explicitly outside 1.0, still shipping, versioned independently:**

- **Studio** and its nine packages — the largest unbounded surface, with a project format and
  migration story that are not settled;
- **the Rust and Java SDKs** — they track the Dynamic Form Contract rather than defining it;
- **the five headless adapters** (React, Vue, Solid, Preact, Svelte) — they render nothing, so they
  cannot be held to the DOM contract that 1.0 is about;
- **the three rendering adapters** (`@modyra/angular`, `@modyra/lit`, `@modyra/plain`) — they *are*
  held to the contract by conformance, and reach 1.0 after it does, not with it.

The reason for a narrow perimeter is that the risk to this project is not code quality. It is that
the contract, the framework matrix, the SDKs and Studio grow faster than the promise anyone can rely
on. A version number over all of it would be a promise about the parts least ready to make one.

---

---

## Phases 1–4 — complete

`@modyra/core` and `@modyra/widgets` are at **1.0.0**. What each phase closed, what it found and what
it cost is in the release notes — `packages/core/CHANGELOG.md` and `packages/widgets/CHANGELOG.md` —
and the decisions are ADRs 0012–0019 in [docs/architecture](docs/architecture/README.md).

The short version, because the pattern matters more than the list: **four of the phases closed a gap
that a check could not see, and in three of them the check itself turned out to be the defect.** A
rule enforced against nothing, a suite that reported full coverage having rendered one of two modes,
a test asserting the opposite of the contract and passing whenever its precondition failed. The
recurring instruction that came out of it is in `.modyra/plans/README.md`: ask what run fails if the
new rule is wrong, and check that that run exists.

**Still open at 1.0**, named rather than hidden: finding **N** — WebKit ends the page when a visually
hidden native input is reached, affecting the radio and colours widgets there. The rows that cannot
run are quarantined by name. `docs/contract-gaps.md` carries it, with C2, E2, F, K, L and M partly
fixed.

---

## Phase 5 — reduce the drift

- **103 off-contract classes and 36 unpainted**, all allowlisted, all reported by
  `scripts/audit-contract-style-coverage.mjs`. The allowlist may only shrink, and today it is not
  shrinking. Classify each: belongs in the contract, belongs to a theme, or should be deleted.
- **Reactivity v1 cleanup.** `id`, `kind` and `capabilities` are still optional in
  `packages/core/src/reactivity.ts` "during migration", though every adapter now declares them.
  Optionality that no longer serves a migration is a public API lying about what it requires.

**Done when:** the off-contract count has a stated target and is measurably below it, and no field in
the reactivity contract is optional for a reason that has passed.

---

## Deferred, with reasons

Not abandoned — sequenced behind the phases above, each waiting on something specific.

| Item | Waiting on |
| --- | --- |
| Nested popups: dismissal order, no duplicate transitions | A case. No kind declares an overlay inside another kind's popup — the timepicker's `dialog` is semantic content within one popup, not a second one |
| A `reason` on every close (`outside-interaction`, `escape`, `selection`, …) | Phase 2 — settle the taxonomy against three engines, not one |
| The full pointer device matrix: pen, scrollbar drag, Shadow DOM | Phase 2's projects |
| `searchable` as contract data, and the select's two interaction models | Phase 1 — it needs the anatomy work first |
| Branded types for schema, instance and migration paths | Phase 4's shape freeze |
| Visual regression: screenshot diff across renderers and themes | Phase 2. Diffing one engine's pixels is the same mistake twice |
| Property-based coverage | Aimed at the contract gates, never at the repository generally |

---

## Not planned before 1.0

- new framework adapters without demonstrated demand;
- production-readiness claims that apply equally to every adapter, when they demonstrably do not;
- enterprise features without a concrete use case;
- React Native beyond documentation, until a Metro and device-level test exists;
- widening the Dynamic Form Contract into a general-purpose configuration language.

This list is the perimeter freeze. Adding to the system is what the roadmap is sequenced to avoid.

---

Design decisions belong in [architecture decision records](docs/architecture/README.md), not here. A
decision recorded only in a roadmap is a decision the next reader relitigates.
