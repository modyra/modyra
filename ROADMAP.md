# Modyra — Road to #1

**Drafted 2026-07-21, starting from the measured data in
[`docs/guides/comparison-form-libraries.md`](docs/guides/comparison-form-libraries.md).**
Every phase below targets a specific leaderboard from that document, has a
measurable goal, and ships only when the metric moves. Principles: zero
runtime dependencies, everything tested, honest numbers — the same rules
that produced the comparison.

## Current standings (measured, 2026-07-21)

| Leaderboard | Modyra today | Leader | Gap |
|---|---|---|---|
| Realistic form surface (gzip) | **#1 — 9.4/9.1 KB** | Modyra | defend |
| Whole-entry bundle (gzip) | #5 — 17.2/16.8 KB | final-form stack 9.8 | −6.9 KB to top-3, −7.4 to #1 |
| Feature matrix | **#1** (drafts, undo, wizard, security unique) | Modyra | defend |
| Framework breadth | #2 — 4 + vanilla core | TanStack Form, 7 | +3 adapters |
| npm presence / adoption | last — not published | RHF ~2.7M dl/week | publish + grow |
| SSR / server validation | #2 — documented pattern | TanStack `createServerValidate` | first-class API |
| React Native | untested | RHF / Formik / TanStack | verify + document |
| Non-Angular UI kits | headless recipes only | (nobody ships full kits; TanStack/RHF headless too) | parity is achievable |
| Measured perf claims | none published | — | produce the data |

---

## Phase I — Release engineering (unblocks every other leaderboard)

Goal: **`@modyra/*@0.2.0` installable from npm.**
The changesets infrastructure already exists; what is missing is the
release itself.

- [ ] Release CI: `changesets/action` workflow (version PR → publish on
      merge), npm **provenance** via OIDC trusted publishing — no tokens
      in CI
- [ ] Pre-release checklist automated: full matrix (262 tests), lint,
      bundle budgets, api-surface
- [ ] npm metadata per package: description/keywords/repository/sideEffects
      audit (sideEffects flag feeds the very tree-shaking numbers we
      advertise — it must be correct)
- [ ] README badges: npm version per package, bundle size (measured,
      link to comparison), CI, license
- [ ] Verify `npm i @modyra/core` in a clean project and replay the
      comparison measurement against the **published** tarball

**Metric: `npm view @modyra/core` returns 0.2.0; comparison doc re-run
against the registry tarball.**

## Phase J — Whole-entry slimming (bundle leaderboard)

Goal: **whole entry ≤ 13 KB gzip (from 17.2) without losing features.**
Findings from the 2026-07-21 exploration (draft+history always linked,
devWarnings strings, micro-dupes) become action:

- [ ] Draft/history managers pay-as-you-go: keep the current API but make
      the managers lazily referenced so bundlers can drop them when
      `enableDraft`/`enableHistory` are never called (expected −1.5/−2 KB
      gzip). If the API-compatible approach cannot shake them, schedule
      the opt-in composition for 1.0 and document the trade-off
- [ ] `MDY_DEV` compile-time define: dev warnings/paths strippable in
      production builds (−0.3/−0.5 KB), documented for esbuild/rollup/vite
- [ ] Micro-golf: dedupe `isRecord`/`isPlainObject` across modules,
      dead-branch review (−0.1/−0.3 KB)
- [ ] CI guard: `check-core-bundle.mjs` measuring the realistic surface
      (budget 10 KB) and the whole entry (budget ratchets down each phase)
      — the same discipline the Angular bundle test already enforces

**Metric: whole-entry ≤ 13 KB gzip; realistic surface stays ≤ 9.5 KB;
feature matrix untouched. Honest framing stays: whole-entry rewards fewer
features — realistic surface is the metric that matters.**

## Phase K — Server validation, first-class (SSR leaderboard)

Goal: **match TanStack's `createServerValidate` with a Modyra-shaped API.**

- [ ] `@modyra/zod`: `serverValidate(schema, payload) → MdyFormError[]` —
      errors shaped exactly like submit-action results, so one handler
      feeds both client display and server rejection
- [ ] Same for `@modyra/standard-schema` (valibot/arktype)
- [ ] Guide: "one schema, two sides" — Next.js/Express/Hono examples, each
      executed in tests against the built packages (the docs rule: no
      unverified snippets)
- [ ] Optional: `form.applyServerErrors(errors)` convenience if the
      existing `errorsFor` flow needs ergonomic glue

**Metric: a forged `curl` payload is rejected and its errors render in
the client form unchanged; tested in Node.**

## Phase L — Framework breadth (adapters leaderboard)

Goal: **7 supported frameworks (from 4 + vanilla).**
The core reactivity contract is deliberately tiny — an adapter is a
reactivity bridge + handle wiring, as Vue/Lit already prove.

- [ ] `@modyra/solid` — native signals map almost 1:1 onto the contract
- [ ] `@modyra/svelte` — Svelte 5 runes bridge
- [ ] `@modyra/preact` — thin variant of the React adapter
- [ ] Each: parity test suite ported from the React adapter's (same 47+
      cases), example in `examples/`, headless recipe section
- [ ] Comparison doc updated; claim "7 frameworks" only when all suites
      are green in CI

**Metric: 7 green adapter columns in the test matrix; comparison doc
frameworks row ties TanStack.**

## Phase M — React Native verification (RN leaderboard)

Goal: **`✓ tested` instead of `✗ untested` — or an honest scope note.**

- [ ] Core test suite runs on Hermes (RN's JS engine) in CI
- [ ] React adapter smoke test in an RN harness (no DOM assumptions in
      adapter code; widgets stay web-only by design)
- [ ] Docs: RN guide with the text-input contract; web-only features
      listed explicitly

**Metric: core + adapter suites green on Hermes, or the comparison doc
keeps `✗` with a one-line reason. No unverified checkmarks.**

## Phase N — Adoption pack (npm/downloads leaderboard)

Goal: **make choosing Modyra the easy decision the data already supports.**

- [ ] Docs site (Starlight or similar) generated from `docs/` — the
      markdown is already the source of truth
- [ ] Migration guides: *from react-hook-form*, *from Formik*, *from
      Angular Reactive Forms* — each with a side-by-side runnable example
      (the reactive-forms one largely exists)
- [ ] Interactive starters (StackBlitz/CodeSandbox) per framework,
      linked from README
- [ ] Measured performance comparison (render/update throughput on large
      forms) with the same rigor as the bundle doc — benchmarks exist in
      the repo, publish their numbers
- [ ] Announcements where the features were born: the Reddit threads that
      asked about injection prevention and anti-tampering get honest,
      non-spammy follow-ups pointing at the measured comparison
- [ ] Conference/meetup pitch deck from the comparison data

**Metric: npm weekly downloads tracked and reported honestly in the
comparison doc, including when they are small.**

## Later / watchlist (not scheduled)

- React/Vue widget kits (shadcn-style copy-paste package) — after
  adoption data says which framework to serve first
- Framework devtools plugins (Redux-devtools-style time travel on top of
  the history manager)
- Angular Signal Forms interop/migration path when it stabilizes
- Qwik adapter (resumability model needs a design, not just a bridge)
- Enterprise features only if pulled by real users (multi-form
  coordination, persisted undo stacks)

## Standing rules for every phase

1. Nothing ships untested; the matrix grows, never shrinks.
2. Every public claim (size, speed, features) must be reproducible from
   the repo — the comparison doc is the template.
3. The comparison doc is updated **in the same PR** that moves a number.
4. Where we lose, the doc says so — trust is the actual moat.
