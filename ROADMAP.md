# Modyra — Road to #1

Drafted 2026-07-21 from [`docs/guides/comparison-form-libraries.md`](docs/guides/comparison-form-libraries.md).
Each phase targets one leaderboard, has a measurable goal, ships only when
the metric moves. Rules: zero runtime deps, everything tested, honest
numbers — losses stated, not hidden.

## Current standings (bundle rows: 2026-07-22; npm/Phase O: 2026-07-23)

| Leaderboard | Modyra | Leader | Gap |
|---|---|---|---|
| Realistic surface (gzip) | **#1 — 10.6/10.3 KB** (was 9.4/9.1) | Modyra | narrower — final-form 11.0/10.6 |
| Whole-entry (gzip) | #4 — 14.1/13.8 KB (was #2, 10.7/10.4), published at `0.4.0` | final-form 10.2/9.8 | regressed by Phase O; violates Phase J's own ≤13 KB goal (not yet reopened as its own item) |
| Feature matrix | **#1** (drafts, undo, wizard, security) | Modyra | defend |
| Framework breadth | #2 — 6 full + Svelte (reactivity+widgets, no example) | TanStack Form, 7 | Svelte example + recipes |
| npm presence | **published `@modyra/*@0.4.0`** (core/angular/react/vue/lit/widgets/zod/standard-schema/styles, verified 2026-07-23) | RHF ~2.7M dl/wk | downloads not tracked; **solid/preact/svelte still 404** — `publish-workspace.mjs`'s hardcoded list predated them, so v0.4.0 bumped their `package.json` without publishing; script fixed 2026-07-23, actual first publish not yet triggered (needs go-ahead) |
| SSR/server validation | **#1** — `serverValidate()`, tested Next/Express/Hono | TanStack | defend |
| React Native | untested, honest reason recorded (Phase M) | RHF/Formik/TanStack | needs real `react-native` or current Hermes binary, approval-gated |
| Non-Angular UI kits | headless recipes only | nobody ships full kits either | achievable |
| Measured perf | Modyra-only numbers, no competitor bench | — | needs new deps, approval-gated |

---

## Phase I — Release engineering ✅ DONE

Goal: `@modyra/*` installable from npm. Achieved and surpassed.

- [x] Release CI: OIDC trusted publishing, no tokens (`release.yml`, `id-token: write`)
- [x] Pre-release gate: full matrix + lint + bundle budgets re-run in the release job
- [x] npm metadata audited (keywords, `@modyra/standard-schema` added to publish scripts)
- [x] README badges (version/bundle/CI/license)
- [x] Tarball smoke test vs. the comparison measurement
- [x] **Owner action, done**: OIDC trusted-publisher live. `0.4.0` verified on the registry for core/angular/react/vue/lit/widgets/zod/standard-schema/styles (2026-07-23). **Not published**: `@modyra/solid`/`preact`/`svelte` — real bug, see standings table.

## Phase J — Whole-entry slimming ✅ DONE (2026-07-21), now regressed by Phase O

Goal: whole entry ≤13 KB gzip (from 17.2 KB). Achieved 10.7/10.4 KB via
subpath-splitting satellite utilities (datetime, i18n, icons, devtools →
`@modyra/core/datetime` etc.), `MDY_DEV` compile-time strip (−0.2 KB),
micro-dedup. CI guard: `check-core-bundle.mjs` (`test:core-bundle`).

- [x] Investigated lazy draft/history construction as a further cut — real
      experiment, negative result (+0.1 KB: esbuild/rollup shake by module
      reachability, not call timing). Reverted; real fix needs a breaking
      opt-in-composition redesign, scheduled for 1.0.
- [x] All other lowhanging cuts done (see above)

**Now regressed to 14.1/13.8 KB by Phase O** — real, not a leak (scope/
mutate/activate/errors are always-linked class methods). Not yet
re-opened as its own phase; tracked in the standings table.

## Phase K — Server validation ✅ DONE

Goal: match TanStack's `createServerValidate`.

- [x] `@modyra/zod` + `@modyra/standard-schema`: `serverValidate(schema, payload)`, same error shape as submit-action results
- [x] "One schema, two sides" guide — Next.js/Express/Hono, tests wired into `test:guides`
- [x] `applyServerErrors()` convenience — deliberately not added, `submit(action)` already covers it

## Phase L — Framework breadth (Partial — 6.5/7)

Goal: 7 supported frameworks.

- [x] Solid — native signals ~1:1, widgets bridge, example, headless recipes. Gotcha: Node needs `--conditions=browser` (SSR-stub condition otherwise).
- [x] Preact — thin React variant, widgets, headless recipes ported verbatim, example. Gap: `useSyncExternalStore` takes 2 args not 3 (no `getServerSnapshot`).
- [x] Svelte — **stores-based, not runes** (runes are compiler macros, confirmed by trying — can't build with plain `tsc`/`node --test`). `vanillaReactivity()` + `toStore()` bridge to real `Readable`. Widgets bridge shipped. Missing: `examples/svelte` (needs `@sveltejs/vite-plugin-svelte`), headless-recipes doc section.
- [ ] Comparison doc "7 frameworks" claim — only once Svelte's example+recipes land

## Phase M — React Native (Blocked, honest reason recorded)

- [x] Tried `hermes-engine@0.11.0` (npm) — rejects `async`/ES6 classes, a
      ~2019-era build predating real RN's Hermes. Testing against it would
      be a false negative. Needs full `react-native` or a current Hermes
      GitHub binary — bigger install, approval-gated.
- [ ] RN harness smoke test, RN guide — blocked on the same decision.

## Phase N — Adoption pack (Partial)

- [x] Docs site: Astro/Starlight from `docs/`, `sync-docs-site.mjs` (title
      injection, link rewriting docs→routes / repo→GitHub). 0/86 broken
      links after a full crawl. Fixed a high-severity `sharp` CVE in the
      scaffold before shipping.
- [ ] Migration guides (RHF/Formik/Reactive Forms) — **partial**: Reactive
      Forms guide genuinely tested (3/3, no new dep). RHF/Formik need new
      devDependencies, approval-gated.
- [x] StackBlitz starters — **partial**: React/Vue/Lit done (real, verified
      Vite projects, own isolated `package.json`). Solid/Preact blocked on
      npm publish (see standings). CodeSandbox tried and declined — GitHub
      import hits a Cloudflare bot-check (403), can't verify like StackBlitz.
- [x] Measured perf comparison — Modyra's own numbers published
      (`comparison-form-libraries.md` §6), one honest weak spot flagged
      (cross-field validator O(fields)). Competitor head-to-head needs new
      deps, approval-gated.
- [ ] Reddit follow-ups, conference/meetup deck

## Phase O — Reactivity/adapter API redesign ✅ DONE (correctness, not a leaderboard)

Goal: a minimal, verifiable reactive protocol, not a bigger vanilla
runtime. Full spec: `.modyra/piano-modyra-reactivity-adapter-api.md`
(local, uncommitted — session log in `.modyra/framework/STATUS.md`).
Trade-off, stated plainly: this moved the whole-entry bundle row
*backwards* in exchange for real correctness fixes. All 8 milestones +
2 follow-ups done:

- [x] M1 — optional `capabilities`/`createScope`/`MdyReactiveScope`, typed errors, diagnostics. Zero breakage.
- [x] M2 — form ownership scope wired into draft/history/async-validator effects (teardown backstop).
- [x] M3 — real `batch()`/`flush()`/`observe()` for vanilla, shared-drain scheduler redesign (settles chained effects in one flush).
- [x] M4 — Angular hardened: typed error instead of silent no-op effect; `onError` now respected (was silently ignored, found in later audit).
- [x] M5 — fixed a real cross-runtime observation bug in React/Preact's `createStore()` (fresh `vanillaReactivity()` observing a handle it didn't own).
- [x] M6 — `form.mutate()` (coalesced history entries) + a real pre-existing `undo()`/`redo()` bug fixed along the way.
- [x] M7 — `@modyra/core/testing` (`runReactivityContractTests`), now a public API.
- [x] M8 — leak/churn tests, generated capability matrix, adapter-authoring guide.
- [x] Follow-up — construction/activation split (`autoActivate`, `activate()`/`deactivate()`): React/Preact Strict-Mode-safe and SSR-safe.
- [x] Follow-up — scheduler bug: an effect throwing without `onError` used to starve sibling effects in the same batch; fixed, reports via `console.error` (a rethrow inside a microtask would itself crash a handler-less Node process — confirmed empirically).

Deferred, none blocking: Angular native `createScope`; child scopes for
array rows; React/Preact snapshot/selector/registry API beyond M5;
async-validator coalescing in `mutate()`; Vue/Solid/Preact/Svelte/Lit/React
migration to real `capabilities`/`createScope`.

**Released**: shipped as part of `0.4.0` (2026-07-23), changeset
`reactivity-adapter-api.md` (minor, core+angular+react+preact).

## Later / watchlist

- React/Vue widget kits (shadcn-style) — after adoption data picks a framework
- Framework devtools plugins (time-travel on the history manager)
- Angular Signal Forms interop when it stabilizes
- Qwik adapter (resumability needs its own design)
- Enterprise features only if pulled by real users

## Standing rules

1. Nothing ships untested; the matrix grows, never shrinks.
2. Every public claim must be reproducible from the repo.
3. The comparison doc updates in the same PR that moves a number.
4. Where we lose, the doc says so.
