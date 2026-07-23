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
| Framework breadth | **tied #1 — 7/7** (Angular/React/Vue/Lit/Preact/Solid/Svelte, all with examples) | TanStack Form, 7 | defend |
| npm presence | **published, all 12 `@modyra/*@0.4.0`** incl. solid/preact/svelte (manually published + trusted publisher configured 2026-07-23, after `publish-workspace.mjs`'s list — which had predated them — was fixed) | RHF ~2.7M dl/wk | downloads not tracked |
| SSR/server validation | **#1** — `serverValidate()`, tested Next/Express/Hono | TanStack | defend |
| React Native | compiles clean on current Hermes (2026-07-23), no integration yet | RHF/Formik/TanStack | `AsyncStorage` draft adapter + `<TextInput>` recipe (Phase M) |
| Non-Angular UI kits | headless recipes only | nobody ships full kits either | achievable |
| Measured perf | Modyra-only numbers, no competitor bench | — | needs new deps, approval-gated |
| Reactivity capability parity | 6/7 declare real capabilities (all but Solid) — Vue now has real batch/flush/observe via its own scheduler + native `effectScope()` (P2, 2026-07-23), matching or exceeding Angular's own | Angular (internal) | Phase P3 (Solid) |

---

## Phase I — Release engineering ✅ DONE

Goal: `@modyra/*` installable from npm. Achieved and surpassed.

- [x] Release CI: OIDC trusted publishing, no tokens (`release.yml`, `id-token: write`)
- [x] Pre-release gate: full matrix + lint + bundle budgets re-run in the release job
- [x] npm metadata audited (keywords, `@modyra/standard-schema` added to publish scripts)
- [x] README badges (version/bundle/CI/license)
- [x] Tarball smoke test vs. the comparison measurement
- [x] **Owner action, done**: OIDC trusted-publisher live for all 12 `@modyra/*` packages. `0.4.0` verified on the registry for every package (2026-07-23) — solid/preact/svelte needed a manual first publish + trusted-publisher setup (npm requires an existing package before OIDC can be configured for it), done same day.

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

## Phase L — Framework breadth ✅ DONE (7/7)

Goal: 7 supported frameworks.

- [x] Solid — native signals ~1:1, widgets bridge, example, headless recipes. Gotcha: Node needs `--conditions=browser` (SSR-stub condition otherwise).
- [x] Preact — thin React variant, widgets, headless recipes ported verbatim, example. Gap: `useSyncExternalStore` takes 2 args not 3 (no `getServerSnapshot`).
- [x] Svelte — **stores-based, not runes** (runes are compiler macros, confirmed by trying — can't build with plain `tsc`/`node --test`). `vanillaReactivity()` + `toStore()` bridge to real `Readable`. Widgets bridge shipped. Headless-recipes doc section + verbatim-ported test done 2026-07-23 (7/7, zero edits — same proof as Preact/Solid). `examples/svelte` shipped 2026-07-23 via `esbuild-svelte` (kept the whole example pipeline on esbuild, same call as Solid's `esbuild-plugin-solid` — no Vite toolchain switch needed) — Playwright-verified: async username check, draft persistence across reload, undo, server error on submit, theme switcher, zero console errors.
- [x] Comparison doc "7 frameworks" claim — now backed by all 7 examples.

## Phase M — React Native (Partial — compiler-verified, no integration yet)

- [x] Tried `hermes-engine@0.11.0` (npm) — rejects `async`/ES6 classes, a
      ~2019-era build predating real RN's Hermes: a false negative.
- [x] **Re-tested 2026-07-23 with the real, current Hermes compiler** —
      `hermesc` from `hermes-compiler@250829098.0.14`, the exact compiler
      React Native `0.86.0` depends on. Compiled both `@modyra/core` alone
      and a realistic `@modyra/react` consumer bundle to Hermes bytecode:
      **exit 0, zero errors**, only expected "undeclared global" warnings
      (`setTimeout`/`Promise`/`console`/etc. — provided by RN at runtime).
      Reverses the earlier "blocked" finding: Modyra's compiled JS is not
      Hermes-incompatible. Full writeup, repro commands and remaining gaps
      (async `AsyncStorage` vs. drafts' sync storage contract, no
      `<TextInput>` binding, no Metro-bundled app test): `docs/guides/react-native.md`.
- [ ] Synchronous-cache `AsyncStorage` draft adapter, `<TextInput>` binding
      recipe, real Metro/RN-app smoke test — open, not done in this pass.

## Phase N — Adoption pack (Partial)

- [x] Docs site: Astro/Starlight from `docs/`, `sync-docs-site.mjs` (title
      injection, link rewriting docs→routes / repo→GitHub). 0/86 broken
      links after a full crawl. Fixed a high-severity `sharp` CVE in the
      scaffold before shipping.
- [x] Migration guides (RHF/Formik/Reactive Forms) — **done 2026-07-23**.
      Reactive Forms guide tested (3/3, no new dep). RHF/Formik guides
      added with new devDependencies (`react-hook-form`, `formik`,
      `jsdom` — approved): each side-by-side snippet is proven by a real
      jsdom + react-dom test (`docs/examples/{rhf,formik}-migration/`)
      that builds both forms and asserts the same invalid → valid
      transitions. Found and documented two real gotchas along the way:
      RHF's `formState` is a lazily-tracked proxy (a key only updates
      once read during render); Formik's `isValid` is dirty-gated and can
      read `true` for an untouched required field.
- [x] StackBlitz starters — **all 7 done** (Angular/React/Vue/Lit/Solid/Preact/Svelte):
      real, verified Vite projects, own isolated `package.json`, real
      `npm install` + build + dev server + Playwright pass (2026-07-23 for
      Solid/Preact/Svelte, unblocked once their npm publish landed).
      CodeSandbox tried and declined — GitHub import hits a Cloudflare
      bot-check (403), can't verify like StackBlitz.
- [x] Measured perf comparison — Modyra's own numbers published
      (`comparison-form-libraries.md` §6), one honest weak spot flagged
      (cross-field validator O(fields)). Competitor head-to-head needs new
      deps, approval-gated.
- [x] Conference/meetup deck — 6-section pitch built from this doc's real
      numbers, published both as a Claude Artifact and as a page on the
      docs site (`site/src/pages/pitch.astro`, `/modyra/pitch`), including
      a feature-scoreboard chart (6/6 built-in vs. 0/6 everywhere else).
- [ ] Reddit follow-ups — posting itself is a manual/social action, not
      done here.

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

## Phase P — Adapter parity (3/4 done — only P3/Solid left)

Goal: close the real gap between Angular (the most mature adapter — native
signals, `capabilities`/`createScope` already declared since Phase O M4)
and the other six. First finding, worth stating plainly: **the gap is
smaller than it looks.** `createForm()` defaults to
`options?.reactivity ?? vanillaReactivity()` (`packages/core/src/typed-form.ts`),
so React, Preact, Svelte and Lit already run on `vanillaReactivity()`'s
real `batch()`/`flush()`/`observe()` capabilities (from Phase O M3) by
default — nothing to fix at runtime for those four. What's actually
missing is visibility and two real native-adapter gaps:

- [x] **P1 — React/Preact/Svelte/Lit, done 2026-07-23**: each package now
      exports its own `kind`-tagged reactivity constructor
      (`reactReactivity()`/`preactReactivity()`/`svelteReactivity()`/
      `litReactivity()` = `{ ...vanillaReactivity(), kind: "x" }`). The
      capability matrix now shows real capabilities for all four (identical
      to vanilla) instead of `—`. Full suite green (103+119+24+135+5).
- [x] **P2 — Vue, done 2026-07-23**: real scheduler added to `effect()` —
      `vueEffect(fn, { scheduler })` now queues into a shared,
      microtask-drained pending set (same design as vanilla's own
      Milestone 3), making `batch()`/`flush()` genuinely real rather than
      `Promise.resolve()` aliases. `createScope()` wraps Vue's own
      `effectScope()` (nesting/cascade-on-dispose is native Vue behavior,
      not reimplemented). `signal()` now honors a custom `options.equal`
      (was silently accepted-and-ignored before — piano §4.2 violation,
      fixed alongside). Capabilities: `effects`/`effectOwnership`/
      `signalEquality`/`batching`/`deterministicFlush`/`directObservation`
      all honestly `true`; `computedEquality` stays `false` — `@vue/reactivity`'s
      `computed()` has no public custom-comparator hook the way Angular's
      native one does, and faking it would mean not using Vue's own
      `computed()` at all. **Real behavior change, approved**: `effect()`
      (and the widget layer's internal state-sync built on it) is now
      microtask-batched instead of always-synchronous — 2 widget tests
      updated to await a tick, matching every other adapter's own timing
      model. Full suite green (103+119+24+135+5); capability matrix
      regenerated (Vue now matches vanilla on every Level-A/B capability
      except `computedEquality`, and exceeds Angular on batching/flush/
      observe, which Angular doesn't implement at all).
- [ ] **P3 — Solid** (`packages/solid/src/index.ts`): native
      `createSignal`/`createEffect`/`createRoot`, already has an
      owner-tree disposal model (`createRoot`/`onCleanup`) — a natural
      fit for `createScope()`, not yet exposed/declared.
- [x] **P4 — Missing pages, done 2026-07-23**: `docs/examples/{solid,preact,svelte}.md`
      (docs revision batch) and `examples/stackblitz-svelte/` (same
      signup-form scenario as stackblitz-preact/-solid, own Vite +
      `@sveltejs/vite-plugin-svelte` toolchain, verified with real
      `npm install` + build + preview + Playwright). All 7 adapters now
      have a StackBlitz starter — was the last one missing.

**Explicitly out of scope here, not silently dropped**: the "no
renderer/UI catalog" gap (Angular's ~30 controls, Lit's 19 components vs.
headless-only for React/Vue/Solid/Preact/Svelte) is real but large — it
stays tracked under "Later / watchlist" below ("React/Vue widget kits")
rather than being folded into Phase P, since building UI kits is a
different order of effort than a reactivity-contract migration.

Each sub-item ships as its own batch (own commit, own contract-test run
via `@modyra/core/testing`'s `runReactivityContractTests`), same pattern
as Phase O's milestones — pick one to greenlight next.

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
