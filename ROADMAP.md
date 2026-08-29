# Roadmap

Modyra makes a **narrow promise over a small, verifiable surface**, rather than putting one version
number over everything that ships. This page describes what is ahead. What already happened is in
the [changelog](CHANGELOG.md) and the per-package release notes.

## What carries a promise

**In scope, versioned together, currently at 2.4.0:**

| Package | Why it is in |
| --- | --- |
| `@modyra/core` | The form engine and the Dynamic Form Contract. Zero dependencies |
| `@modyra/widgets` | The widget contract: anatomy, states, relations, behaviour. Depends only on `core` |

Nothing in either is removed or changed in a breaking way outside a major release. The
[compatibility policy](docs/contract-compatibility.md) says how that is classified and checked, and
`npm run contract:diff` is what classifies it.

The perimeter is real rather than asserted: `scripts/audit-package-independence.mjs` passes,
`@modyra/core` declares no dependencies at all, and `@modyra/widgets` declares exactly one.

**Outside that promise, shipping, versioned independently — all still below 1.0:**

- **the three renderers** (`@modyra/angular`, `@modyra/lit`, `@modyra/plain`) — held to the contract
  by conformance, and they reach 1.0 after it does, not with it;
- **the five headless adapters** (React, Vue, Solid, Preact, Svelte) — they render nothing, so the
  DOM contract cannot judge them;
- **Studio** and its ten packages — the largest unbounded surface, with a project format and
  migration story that are not settled;
- **the Rust and Java SDKs** — they track the Dynamic Form Contract rather than defining it.

The risk to this project is not code quality. It is that the contract, the framework matrix, the
SDKs and Studio grow faster than any promise a consumer can rely on. A version number over all of it
would be a promise about the parts least ready to make one.

## Ahead

### Reduce the drift between the contract and the themes

`scripts/audit-contract-style-coverage.mjs` currently reports **76 off-contract classes** and **39
contract classes no theme paints**, every one of them allowlisted. The allowlist may only shrink,
and today it is not shrinking. Each entry needs a verdict: it belongs in the contract, it belongs to
a theme, or it should be deleted.

**Done when** the off-contract count has a stated target and is measurably below it.

### The renderers toward 1.0

Conformance already judges Angular, Lit and Plain against the same suite. What is missing before
they can make the same promise `core` and `widgets` make is a stable answer on the remaining
anatomy questions and a coverage floor each renderer commits to.

## Deferred, with reasons

Sequenced rather than abandoned; each is waiting on something specific.

| Item | Waiting on |
| --- | --- |
| Nested popups: dismissal order, no duplicate transitions | A real case. No kind declares an overlay inside another kind's popup |
| A `reason` on every close (`outside-interaction`, `escape`, `selection`, …) | Settling the taxonomy against three engines rather than one |
| The full pointer device matrix: pen, scrollbar drag, Shadow DOM | The same multi-engine work |
| Branded types for schema, instance and migration paths | The Studio shape freeze |
| Visual regression across renderers and themes | Multi-engine screenshots. Diffing one engine's pixels is the same mistake twice |
| Property-based coverage | Aimed at the contract gates, never at the repository generally |
| A committed bundle-comparison harness | Competitor figures in the [comparison](docs/guides/comparison-form-libraries.md) come from a harness that is not in this repository, so they cannot be re-measured here |

## Not planned

- new framework adapters without demonstrated demand;
- readiness claims that apply equally to every adapter, when they demonstrably do not;
- enterprise features without a concrete use case;
- React Native beyond documentation, until a Metro and device-level test exists;
- widening the Dynamic Form Contract into a general-purpose configuration language.

This list is the perimeter freeze. Adding to the system is what the roadmap is sequenced to avoid.

## Known open

The contract's defects are published in [known issues](docs/known-issues.md) rather than kept
private. One is open and stays open on purpose: the iOS theme pairs white on Apple's system blue,
which measures below the 4.5:1 floor. It is the pairing Apple specifies, and a theme that quietly
darkened it would ship an iOS theme Apple does not.

---

Design decisions belong in [architecture decision records](docs/architecture/README.md), not here. A
decision recorded only in a roadmap is a decision the next reader relitigates.
