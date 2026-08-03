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

## Phase 1 — the contract can describe its own anatomy

Four gaps are recorded in [contract gaps](docs/contract-gaps.md) as **J1–J4**. They share one shape:
the thing needing constraint sits one level below the part list, so the contract cannot reach it.
Two are blocking.

- **J3 — the timepicker's inner controls.** `hour` and `minute` are declared `group`; the
  `<input type="number">` a user types into is not a part at all, so no anatomy, relation or state
  check reaches it. The fix names it. Same shape as finding **I**, which closed by declaring optional
  parts, so expect `minor`.
- **J4a — a state names its carrier.** `state-tests.ts` accepts a state attribute on *any* declared
  part, so the strongest claim it can make is "exposed somewhere", not "on the right element".
- **J4b — a popup names its contents.** Containment is already enforced; **presence** is not. Four of
  the six overlay kinds require no part inside their popup, so an empty popup conforms.

**Done when:** J3 and J4 read `— **fixed**` in `docs/contract-gaps.md` with the summary agreeing
(`npm run test:docs` enforces that), the blind-spot fixtures in
`packages/widgets/test/j-gap-blindspots.spec.mjs` have inverted, and `npm run contract:diff` has
classified each change rather than the author asserting it.

**Not in this phase:** J1 and J2. J1's decision exists but its implementation shares the
state-carrier mechanism with J4a. J2 needs the evidence the others produce.

---

## Phase 2 — one engine is not evidence

`playwright.config.ts` runs `browserName: "chromium"`. Every browser-verified claim in this
repository — overlay placement, focus restoration, the dismissal gesture, the affordance column —
rests on a single engine.

- add Firefox and WebKit projects;
- run the existing browser suites unchanged and record what differs;
- treat each difference as a finding: either the contract is engine-specific and must say so, or a
  renderer is relying on behaviour it was never promised.

Expect real failures. `:has()`, `:focus-visible` and pointer-event ordering around `pointercancel`
are the three most likely, and the dismissal policy depends on all three.

**Done when:** the browser suites pass on three engines, or every exception is recorded in
`docs/contract-gaps.md` with the engine named.

**This phase may need to move first.** If Firefox or WebKit disagree about pointer or focus
behaviour, part of what Phase 1 verifies is single-engine. Phase 1 leads only because its two gaps
are anatomy rather than engine behaviour.

---

## Phase 3 — the remaining two gaps

- **J1 — segmented semantics.** Decided in
  [ADR 0012](docs/architecture/0012-a-choice-is-a-radio-by-role-or-by-tag.md): a choice is a radio,
  satisfied by the native tag *or* `role="radio"`. All three renderers already emit `radiogroup`, so
  this should be contract-only and `minor`. It also resolves a suspected stale key — `required` names
  `optionControl`, which is not in segmented's part list.
- **J2 — the multiselect's conditional anatomy.** `option` is a `<button>` in toggle mode and a
  `<div>` holding steppers in counter mode, and the contract cannot say "this part's element depends
  on that option". Needs an ADR first, written with Phase 1's evidence, then a prototype before any
  public API change.

**Done when:** all four J findings read `fixed` and the `**Open**` line disappears from
`docs/contract-gaps.md`.

**The trap to avoid:** J2 is the only gap that needs conditional anatomy. Designing a general
condition language for one widget is the failure mode this phase is sequenced last to prevent.

---

## Phase 4 — the promise is testable from outside

Everything so far is verified by this repository against itself. A stable promise has to survive
leaving it.

- **Real tarballs in clean consumers.** Install what `npm pack` actually produces into isolated
  projects, then type-check and run them. Exports and generated declarations are the usual casualties.
- **Release gates.** `contract:snapshot` and the conformance CLI become blocking rather than
  advisory: a contract change without a classification cannot ship.
- **A compatibility and deprecation policy**, written down. Today
  [contract-compatibility.md](docs/contract-compatibility.md) says what a change *costs*; it does not
  say what users are owed, or for how long.
- **Stabilise the shapes 1.0 freezes**: `MdyFormError`, diagnostics, and the server-validation
  result. `MdyFormError` is four fields today, and adding metadata later must not break `message`.
- **The external proof.** `npx modyra-conformance` is published and two renderers pass it. The
  README's invitation asks someone outside this repository to build a renderer from the specification
  alone. No amount of work here closes it — it needs a third party, and the most useful result is
  where the specification turned out to be ambiguous.

**Done when:** a consumer project built only from published tarballs passes its own tests, and a
contract change cannot merge without a classification.

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
