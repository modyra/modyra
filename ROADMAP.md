# Modyra — Road to #1

**Drafted 2026-07-21, starting from the measured data in
[`docs/guides/comparison-form-libraries.md`](docs/guides/comparison-form-libraries.md).**
Every phase below targets a specific leaderboard from that document, has a
measurable goal, and ships only when the metric moves. Principles: zero
runtime dependencies, everything tested, honest numbers — the same rules
that produced the comparison.

## Current standings (measured, 2026-07-21)

| Leaderboard                   | Modyra today                                   | Leader                                              | Gap                  |
| ----------------------------- | ---------------------------------------------- | --------------------------------------------------- | -------------------- |
| Realistic form surface (gzip) | **#1 — 9.4/9.1 KB**                            | Modyra                                              | defend               |
| Whole-entry bundle (gzip)     | #2 — 10.7/10.4 KB                              | final-form stack 10.2/9.8                           | −0.5/−0.6 KB to #1   |
| Feature matrix                | **#1** (drafts, undo, wizard, security unique) | Modyra                                              | defend               |
| Framework breadth             | #2 — 6 full (Angular/React/Vue/Lit/Preact/Solid) + Svelte (reactivity+widgets, no example) + vanilla core | TanStack Form, 7 | Svelte example + recipes to reach 7 full |
| npm presence / adoption       | **published** (`@modyra/*@0.3.0`, verified live 2026-07-22), downloads not yet tracked | RHF ~2.7M dl/week | grow + track weekly downloads honestly |
| SSR / server validation       | **#1 — `serverValidate()` first-class API, tested Next.js/Express/Hono** | TanStack `createServerValidate` | defend               |
| React Native                  | untested — real reason recorded (see Phase M)  | RHF / Formik / TanStack                             | needs `react-native` or a Hermes GitHub release, approval-gated |
| Non-Angular UI kits           | headless recipes only                          | (nobody ships full kits; TanStack/RHF headless too) | parity is achievable |
| Measured perf claims          | Modyra-only numbers published, no competitor head-to-head yet | — | competitor bench needs new deps (approval-gated) |

---

## Phase I — Release engineering (unblocks every other leaderboard) ✅ DONE

Goal: **`@modyra/*@0.2.0` installable from npm.** ✅ Achieved and
surpassed — verified live at **0.3.0** on 2026-07-22 (see below).
The changesets infrastructure already exists; what is missing is the
release itself.

- [x] Release CI: `changesets/action` workflow (version PR → publish on
      merge), npm **provenance** via OIDC trusted publishing — no tokens
      in CI _(verified in place: `release.yml` with `id-token: write` +
      `NPM_CONFIG_PROVENANCE`)_
- [x] Pre-release checklist automated: full matrix, lint, bundle budgets
      _(verified: the release job re-runs the entire CI gate + audit)_
- [x] npm metadata per package: description/keywords/repository/sideEffects
      audit _(keywords added where missing; `@modyra/standard-schema`
      added to the publish scripts — it would have been silently skipped)_
- [x] README badges: npm version per package, bundle size (measured,
      link to comparison), CI, license _(verified in place)_
- [x] Verify `npm i @modyra/core` in a clean project and replay the
      comparison measurement against the **packed** tarball _(tarball
      smoke test: core + zod + standard-schema; realistic surface
      reproduced exactly at 9.4 KB gzip from the tarball)_
- [x] **Owner action**: one-time npm trusted-publisher setup for each
      `@modyra/*` package (GitHub Actions, `release.yml`, action
      `npm stage publish`), then merge the "Version Packages" PR;
      after first successful staged release, remove `NPM_TOKEN`.
      **Done — verified live on the registry**, not assumed: `npm view
      @modyra/core` (and `angular`/`react`/`vue`/`lit`/`widgets`/`zod`/
      `standard-schema`/`styles`) all return **0.3.0**, published "by
      GitHub Actions <npm-oidc-no-reply@github.com>" (the OIDC trusted
      publisher, not a token), `repository`/`homepage` correctly point at
      `github.com/modyra/modyra`. This had been sitting as an open
      owner-only blocker in every prior session's notes — it happened
      since (independently of this session's work) and every downstream
      leaderboard this phase was gating is now unblocked. `@modyra/solid`
      and `@modyra/preact` (created this session) are not published yet —
      expected, they were never part of a release cut.

**Metric: `npm view @modyra/core` returns 0.2.0; comparison doc re-run
against the registry tarball.** Superseded: registry now shows 0.3.0 —
the comparison doc's "measured from the workspace build because not
published" caveat (§1) is stale and should be re-verified against the
real tarball next time that doc is touched.

## Phase J — Whole-entry slimming (bundle leaderboard)

Goal: **whole entry ≤ 13 KB gzip (from 17.2) without losing features.**
✅ **Achieved 2026-07-21: 10.7 KB esbuild / 10.4 KB rollup (−38%).**
The dominant cut came from an unplanned lever: satellite utilities
(datetime, localization, icons/keyboard/options/overlay, serialize,
devtools) relocated to curated subpath entries (`@modyra/core/datetime`,
`/ui`, …) — still shipped in the package, no longer forced into the main
entry. Findings from the 2026-07-21 exploration (draft+history always
linked, devWarnings strings, micro-dupes) became action:

- [x] Draft/history managers pay-as-you-go: **investigated with a real
      code experiment, not just analysis — confirmed infeasible
      API-compatibly, exactly the fallback this bullet pre-authorized.**
      Implemented lazy construction (`MdyDraftManager`/`MdyHistoryManager`
      built on first `enableDraft()`/`enableHistory()` call instead of in
      the constructor; `canUndo`/`canRedo` became null-checking closures).
      All 62 `packages/core/test/` tests stayed green — behaviorally
      correct. Measured via `check-core-bundle.mjs` before/after on the
      identical build: **10.7 → 10.8 KB gzip whole entry — a +0.1 KB
      regression, not a saving.** Root cause: esbuild/rollup tree-shaking
      is reachability-based per module, not per runtime branch —
      `form-engine.ts` still statically references both manager classes
      regardless of *when* `new X()` executes, so deferring the call site
      adds wrapper overhead without dropping anything from the bundle.
      Reverted the code (no point shipping complexity with a negative
      result). Per this bullet's own fallback: the only way to actually
      drop this code is the breaking opt-in-composition redesign
      (`withDraft(form, opts)`-style wrapping instead of `form.enableDraft()`),
      **scheduled for 1.0**, not attempted here since it changes the
      public API.
- [x] `MDY_DEV` compile-time define: dev warnings/paths strippable in
      production builds (−0.2 KB measured: 10.7 → 10.5 KB), documented
      for esbuild/rollup/vite
- [x] Micro-golf: `isRecord` deduplicated into `record-utils.ts`
      (draft/array managers), dead-branch review
- [x] CI guard: `check-core-bundle.mjs` measuring the realistic surface
      (budget 10 KB) and the whole entry (budget 11 KB, ratchets down
      each phase) — wired into `test:core-bundle`, `ci.yml` and
      `release.yml`; same discipline the Angular bundle test enforces

**Metric: whole-entry ≤ 13 KB gzip; realistic surface stays ≤ 9.5 KB;
feature matrix untouched. Honest framing stays: whole-entry rewards fewer
features — realistic surface is the metric that matters.**

## Phase K — Server validation, first-class (SSR leaderboard)

Goal: **match TanStack's `createServerValidate` with a Modyra-shaped API.**

- [x] `@modyra/zod`: `serverValidate(schema, payload) → MdyFormError[]` —
      errors shaped exactly like submit-action results, so one handler
      feeds both client display and server rejection
- [x] Same for `@modyra/standard-schema` (valibot/arktype) — async, since
      the spec's `validate` may return a `Promise`
- [x] Guide: "one schema, two sides" — Next.js/Express/Hono examples, each
      executed in tests against the built packages (the docs rule: no
      unverified snippets) — `docs/guides/server-validation.md` +
      `docs/examples/server-validation/`, wired into `npm run test:guides`
      and the main `test` chain
- [x] `form.applyServerErrors(errors)` convenience — **not added**:
      `form.submit(action)` already accepts any action returning
      `MdyFormError[]`, including a local `serverValidate` call; no
      ergonomic gap to fill (documented in the guide's last section)

**Metric: a forged `curl` payload is rejected and its errors render in
the client form unchanged; tested in Node.**

## Phase L — Framework breadth (adapters leaderboard)

Goal: **7 supported frameworks (from 4 + vanilla).**
The core reactivity contract is deliberately tiny — an adapter is a
reactivity bridge + handle wiring, as Vue/Lit already prove.

- [x] `@modyra/solid` — native signals map almost 1:1 onto the contract.
      Shipped: `solidReactivity()`/`createSolidForm`/`useSolidForm`, the
      headless widgets bridge (11/11, `packages/solid/test/`), and an
      `examples/solid/` entry — field handles read directly as accessors
      inside JSX (no `useMdyField`-style hook needed at all, unlike
      React/Preact), via `esbuild-plugin-solid` (babel-preset-solid)
      wired into `build:examples`/`demo:solid`, smoke-tested in a real
      headless browser. Real gotcha found and documented: solid-js's
      Node import condition resolves to a non-reactive SSR stub — any
      Node consumer needs `--conditions=browser` (see the package
      README). Headless-recipes doc section done too (see below).
- [x] `@modyra/svelte` — **shipped stores-based, not runes-based, and
      documented why.** Investigated runes first: `$state`/`$derived`
      are compiler macros — confirmed empirically (`svelte-package`
      leaves `$state(...)` calls untranspiled in its output; they're
      meant to be compiled by the *consumer's* bundler, not the library
      author), meaning a runes-based package couldn't build with plain
      `tsc` or run with plain `node --test` — it would need a completely
      different pipeline (`@sveltejs/package` + Vitest, not `tsc` +
      `node --test`), a bigger shift than any other adapter needed.
      Confirmed `svelte/store` (`writable`/`derived`/`get`) is real,
      uncompiled JS — same shape decision as `@modyra/react`
      (`vanillaReactivity()` + a store bridge, since Svelte has no more
      of an exported fine-grained signal than React does). Shipped
      `createSvelteForm` + `toStore()` (adapts any Modyra signal into a
      real `Readable`, verified against `svelte/store`'s own `get()`),
      7/7 tests, zero new toolchain — builds with `tsc`, tests with
      plain `node --test`, exactly like every other adapter. One real,
      documented caveat: `toStore()`'s notifications are microtask-
      batched (it wraps an effect), unlike Svelte's own synchronous
      `writable()`. A runes-based ergonomic layer is a separate, larger
      follow-up (needs `@sveltejs/package` + a different test runner),
      not attempted here. Headless widgets bridge also shipped
      (`useMdyField`/`useMdySelect`/`executeSvelteCommands`, state/view
      as `Readable` stores, 11/11 tests total). No `examples/svelte` yet
      (needs a Svelte-aware bundler — `@sveltejs/vite-plugin-svelte` —
      for a real `.svelte` component, a separate decision from
      runes-vs-stores). No headless-recipes doc section yet either.
- [x] `@modyra/preact` — thin variant of the React adapter. Shipped:
      reactivity (`vanillaReactivity` + `useSyncExternalStore` via
      `preact/compat`), widgets bridge, headless-recipes suite ported
      **verbatim** (13/13 tests, `packages/preact/test/`), and an
      `examples/preact/` entry (esbuild `jsxImportSource: "preact"`, no
      Babel needed) wired into `build:examples`/`serve-example.mjs` and
      smoke-tested in a real headless browser. One real API gap found:
      Preact's `useSyncExternalStore` takes 2 args, not React's 3 (no
      `getServerSnapshot`).
- [x] Each (Solid/Preact): parity test suite ported from the React
      adapter's, example in `examples/`, headless recipe section — all
      three done for both. `docs/guides/headless-recipes.md` now has a
      Preact note (recipes unchanged, verbatim-tested) and a full Solid
      section (accessor-based, no subscription hook, also
      verbatim-tested via `packages/solid/test/headless-recipes.test.mjs`,
      18/18 total Solid tests). Svelte still needs this once it exists.
- [ ] Comparison doc updated; claim "7 frameworks" only when all suites
      are green in CI

**Metric: 7 green adapter columns in the test matrix; comparison doc
frameworks row ties TanStack.**

## Phase M — React Native verification (RN leaderboard)

Goal: **`✓ tested` instead of `✗ untested` — or an honest scope note.**

- [x] Core test suite runs on Hermes (RN's JS engine) in CI — **attempted,
      genuinely blocked, honest reason recorded** (this is the metric's
      explicitly-allowed alternative to a checkmark, not a skip). Tried
      the lightweight path first: `hermes-engine@0.11.0` (npm, no
      Xcode/Android SDK needed, ~20 MB) ships a standalone `hermesc`
      binary. Fed it an esbuild bundle of `@modyra/core`: it **rejects
      `async` functions outright** ("async functions are unsupported")
      and errors on plain ES6 class expressions (`var X = class {...}`)
      — this is a ~2019-era Hermes build (bytecode version 84) predating
      Hermes's async/await support, which has been standard for years on
      real RN. Testing against it would produce a false-negative result,
      not real signal — the project's "honest numbers" rule cuts against
      using a stale artifact just to get *a* answer. A representative
      check needs either the full `react-native` package (for its
      current bundled `hermesc`) or a direct binary download from
      Hermes's GitHub releases — both meaningfully bigger installs than
      anything else this session, so not pulled in without approval.
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
- [ ] Migration guides: _from react-hook-form_, _from Formik_, _from
      Angular Reactive Forms_ — each with a side-by-side runnable example.
      **Partial**: the Reactive Forms guide's side-by-side snippet is now
      genuinely tested (`packages/angular/src/lib/core/
      comparison-reactive-forms.spec.ts`, 3/3 — both APIs asserted to
      agree on the same invalid→valid transition), using only
      `@angular/forms`, already a repo dependency, so no new dependency
      was needed. RHF/Formik guides still need those libraries as new
      devDependencies to satisfy the same "no unverified snippets" rule —
      not pulled in without approval.
- [x] Interactive starters (StackBlitz/CodeSandbox) per framework,
      linked from README. **Partial**: React/Vue/Lit done (joining the
      existing Angular one) — each a real, standalone, verified Vite
      project (`examples/stackblitz-{react,vue,lit}/`, own `package.json`
      pinned to the now-published `@modyra/*@^0.3.0`, `npm install && npm
      run dev` tested end-to-end with Playwright, `npm run build` also
      verified). This only became possible because Phase I's npm publish
      turned out to already be done (see above) — StackBlitz's GitHub
      import needs the `@modyra/*` deps to actually resolve from the
      registry, which they now do. Not done: Solid and Preact starters
      (their packages aren't published — only this session's core
      packages are). **CodeSandbox explicitly tried and declined**: its
      GitHub-import URL returned a Cloudflare bot-check page (HTTP 403,
      "Just a moment...") under headless verification — that's a
      Cloudflare block on automated traffic, not proof the import itself
      is broken, but it means I cannot verify a CodeSandbox link the way
      I verified every StackBlitz one (real `npm install` + dev server +
      Playwright). The project's own prior precedent
      (`examples/stackblitz`) never shipped a CodeSandbox badge either.
      Adding an unverified badge would break this project's "no
      unverified claims" rule, so it's left out rather than guessed at.
- [x] Measured performance comparison (render/update throughput on large
      forms) with the same rigor as the bundle doc — benchmarks exist in
      the repo, publish their numbers. **Partial**: published Modyra's own
      reproducible numbers (`comparison-form-libraries.md` §6) with full
      methodology and one honestly-flagged weak spot (cross-field
      validator O(fields) recompute). A true competitor head-to-head
      (react-hook-form/Formik/TanStack Form) needs those libraries
      installed as new devDependencies — approval-gated, not done here.
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
