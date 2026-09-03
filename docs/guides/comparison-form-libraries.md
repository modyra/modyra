# Form library comparison

A comparison of bundle weight and built-in features against six other form libraries. It measures
two things only: bytes, and whether a feature exists. It does not measure API quality, ecosystem
maturity, support or production adoption — for those, see [where Modyra is
behind](#where-modyra-is-behind).

Two different measurement dates appear below, and the difference matters:

- **Modyra's own figures** are measured by a script in this repository and were re-run on
  **2026-08-28** against `@modyra/core@2.4.0`. Reproduce them with `npm run test:core-bundle` and
  `npm run test:perf`.
- **Every other library's figures** are a snapshot taken on **2026-07-21** at the versions listed in
  the methodology. The harness that produced them is not committed here, so they have not been
  re-measured since.

Because of that gap, this page reports each library's weight and declines to rank them. Re-measure
everything on the same day before quoting an ordering.

**Reproducible is not the same as current, and this page learned it the expensive way.** The figure
above is the one a reader has most reason to trust — it names its script, and anyone can run it. It
is also the one that moved: between 2026-08-10 and 2026-08-20 the realistic surface went from 13.4 KB
gzip to 26.3 KB, and nothing noticed, because `npm run test:core-bundle` reports and does not gate.
It still does not gate on the weight — a budget raised whenever a legitimate feature crosses it
records past sizes instead of limiting future ones. It gates on the **divergence**: the command reads
this table, and fails when the figures it measures are not the ones published here. Growth is a
product decision and belongs in the trajectory below, where a reader can judge it; growth nobody
wrote down is the defect, and it is the one that went unnoticed for ten days.
By 2026-08-22 it had moved again, to 27.0 KB. A number with a command behind it drifts exactly as
quietly as one without, unless something re-runs the command. Treat every figure here as of its
stated date, this page's own included.

## Methodology

- Packages installed from npm with `--save-exact`.
- Bundled with **esbuild** (`--bundle --minify --format=esm`) and, in the 2026-07-21 snapshot, also
  with **rollup 4** (`@rollup/plugin-node-resolve` + `commonjs` + `terser`), then `gzip -9`. Both
  matter: Vite's dev and optimize steps use esbuild, while Vite production builds, Angular and most
  library authors use rollup/webpack-class tree-shaking.
- Peer frameworks are external in both (`react`, `vue`, `@angular/*`, `rxjs`, `zone.js`) — you pay
  for your framework regardless.
- Two surfaces per library: the **whole entry** (everything exported, worst case) and the
  **realistic surface** (only what a typed form with array fields and validation imports).
- The 2026-07-21 whole-entry figures landed within 5–10% of [Bundlephobia](https://bundlephobia.com)
  for every package, which is a coarse check on the harness.

Versions in the 2026-07-21 snapshot: react-hook-form **7.82.0** · formik **2.4.9** ·
@tanstack/react-form **1.33.2** · final-form **5.0.1** + react-final-form **7.0.1** +
final-form-arrays **4.0.1** · vee-validate **4.15.1** · zod **4.4.3** · @angular/forms **22.0.7**.

## Bundle weight

### Modyra, measured 2026-09-03

`@modyra/core@2.5.0`, esbuild + `gzip -9`, via `npm run test:core-bundle`:

| Surface | Minified | Gzipped |
| --- | --- | --- |
| Whole entry | 160.2 KB | **46.9 KB** |
| Realistic surface | 98.6 KB | **28.1 KB** |

The realistic surface is `createForm`, `field`, `group`, `array` plus `required`, `email`, `min`,
`minLength`, `maxLength`, `pattern`, `crossField`, `serverValidator`, `oneOf` and `eachOneOf` — and
it includes drafts, undo/redo, sanitization, `mutate()`, `MdyReactiveScope` and activate/deactivate,
which most of the table below does not ship at all.

**The trajectory, because one measurement says nothing about direction:**

| Version | Realistic | Whole entry |
| --- | --- | --- |
| 0.4.0 | 10.6 KB | 14.1 KB |
| 2.0.0 (2026-08-10) | 13.4 KB | 19.8 KB |
| 2.1.2 (2026-08-20) | 26.3 KB | 43.1 KB |
| 2.4.0 (2026-08-28) | 27.0 KB | 45.3 KB |
| 2.5.0 (2026-09-03) | **28.1 KB** | **46.9 KB** |

Ten days doubled it. The scope, lifecycle and typed-error machinery is always linked, so it lands in
every bundle rather than tree-shaking away — and that was already the explanation for the first
increase, which is why it does not explain this one on its own. **The cost is real and it is not a
measurement artifact**: the script has not been touched since before the 2026-08-10 figure was taken,
while `packages/core/src` grew from 44 files to 55 underneath it.

**Where that leaves Modyra in this table.** Modyra's figures are esbuild, so compare them with the
esbuild column below. At 28.1 KB gzip realistic it is the heaviest entry on this page — above
`@angular/forms` at 18.1 KB, which is a whole framework package, and more than twice
react-hook-form's 12.5 KB. The page still declines to rank, because the other figures are a month
older and a re-measure could move them too; it does not decline to say which way its own number went.
If bundle size is your deciding constraint, measure the version you would actually install, on the
day you decide.

### The other libraries, snapshot of 2026-07-21

Realistic surface:

| Package | esbuild | rollup | Surface imported |
|---|---|---|---|
| final-form + react-final-form + final-form-arrays | 11.0 KB | 10.6 KB | `createForm, arrayMutators, Form, Field` |
| react-hook-form | 12.5 KB | 11.9 KB | `useForm, useFieldArray, Controller` |
| vee-validate | 12.7 KB | 33.4 KB ⚠ | `useForm, useFieldArray, Field, Form, ErrorMessage` |
| formik | 13.7 KB | 13.2 KB | `Formik, Form, Field, FieldArray, ErrorMessage` |
| @tanstack/react-form | 17.3 KB | 16.5 KB | `useForm` |
| @angular/forms | 18.1 KB | 18.1 KB | Framework package; no per-export surface |

Whole entry:

| Package | esbuild | rollup |
|---|---|---|
| react-final-form stack | 10.2 KB | 9.8 KB |
| react-hook-form | 13.3 KB | 12.7 KB |
| vee-validate | 13.6 KB | 34.6 KB ⚠ |
| formik | 14.8 KB | 14.5 KB |
| @angular/forms | 18.1 KB | 18.1 KB |
| @tanstack/react-form | 19.1 KB | 18.1 KB |

⚠ **vee-validate is bundler-sensitive.** Rollup keeps its optional `@vue/devtools-api` integration
(~21 KB gzip of dev-only tooling); esbuild drops it. Neither number is wrong — check what your
pipeline tree-shakes.

`@angular/forms` is not directly comparable: an Angular app pays for the framework regardless, and
it ships no tree-shakeable form surface.

### The schema validator is usually the bigger line item

Using zod with any of these libraries — Modyra included, via `@modyra/zod` — costs zod's weight on
top. Measured on zod 4.4.3:

| Scenario | Min+gzip |
| --- | --- |
| esbuild, realistic `z.object` schema | **63.1 KB** |
| rollup, same schema | **16.7 KB** |
| rollup, minimal `z.boolean()` | 9.1 KB |
| zod's own published figure (rollup) | ~5.4 KB [^1] |

Zod v4's root entry pulls in about 40 locales (198 KB minified, 62% of the bundle). **Rollup
tree-shakes them out; esbuild does not.** If your app builds with esbuild, the validator can dwarf
every form library on this page. `zod/mini` helps less than expected under esbuild — 57.1 KB gzip
measured, same locale issue.

## Feature coverage

✓ built-in · ~ partial, external package, or manual · ✗ not available

| Feature | Modyra | TanStack Form 1.33 | react-hook-form 7.82 | formik 2.4 | final-form 5.0 | vee-validate 4.15 | Angular Reactive Forms 22 |
|---|---|---|---|---|---|---|---|
| Frameworks | 7 adapters (Angular, React, Vue, Lit, Solid, Preact, Svelte) + a framework-free renderer and a vanilla core | 7: React, Preact, Vue, Angular, Solid, Lit, Svelte [^2] | React (incl. RN) | React (incl. RN) | Agnostic core + official React | Vue | Angular |
| Typed form API | ✓ descriptor inference | ✓ deep inference | ✓ generics + path types | ~ weaker generics | ~ | ✓ | ✓ |
| Standard Schema / schema validation | ✓ `@modyra/standard-schema`, `@modyra/zod` | ✓ built-in [^3] | ✓ via `@hookform/resolvers` | ~ Yup first-class | ✗ validate functions only | ✓ zod/yup/valibot | ✗ validator functions only |
| Sync validation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Async validation | ✓ debounce, `AbortSignal` cancellation, `dependsOn`, timeout | ✓ debounce + `AbortSignal` [^3] | ~ no built-in debounce or cancellation | ~ form-level only | ~ | ✓ | ~ manual cancellation |
| Cross-field validation | ✓ | ✓ | ~ manual | ~ manual | ~ mutators | ✓ | ~ manual |
| Dynamic arrays | ✓ push/insert/remove/move/swap | ✓ | ✓ | ✓ | ✓ via a separate package | ✓ | ✓ |
| Keyed collections | ✓ rows keyed by data, surviving sort and re-render; a key can be renamed in place | ✗ arrays only | ✗ arrays only | ✗ arrays only | ✗ arrays only | ✗ arrays only | ~ `FormRecord` holds dynamic keys, with no rename [^5] |
| Existence independent of rendering | ✓ a row exists because it was declared, so an off-screen row keeps its value and still counts against validity [^6] | ~ | ~ field-array state is tied to inputs mounting and unmounting [^7] | ~ | ~ | ~ | ✓ the model owns the controls |
| Draft persistence | ✓ TTL, versioning, debounce, field exclusion | ~ on the v1 roadmap [^3] | ✗ | ✗ | ✗ | ✗ | ✗ |
| Undo/redo history | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Wizard / multi-step | ✓ per-step validation gating | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Submit lifecycle + server errors | ✓ | ✓ + SSR validation [^3] | ✓ | ✓ | ✓ | ✓ | ~ manual |
| Injection prevention | ✓ profiles, length caps, option whitelisting | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Forms declared as data | ✓ Dynamic Form Contract, parsed strictly | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Bundled UI components | ✓ Angular, Lit and framework-free catalogs over 17 widget kinds | ✗ headless only | ✗ | ✗ | ✗ | ✗ | ✗ directives only |
| i18n | ✓ core module | ✗ | ✗ | ✗ | ✗ | ✗ | framework-level |
| Devtools | ✓ framework-independent | ✓ | ✓ external package | ✗ | ✗ | ~ Vue devtools | ~ framework |
| React Native | ~ compiles on Hermes; no binding or example app [^4] | ✓ | ✓ | ✓ | ~ | ✗ | ✗ |
| Validation reused on the server | ✓ the engine runs in Node | ✓ first-class SSR API [^3] | ~ resolvers run anywhere | ~ | ~ | ~ | ✗ |

## Where Modyra is behind

Read this before adopting.

1. **Maturity and ecosystem.** react-hook-form, formik and final-form have years of production
   mileage, Stack Overflow coverage and UI-library integrations. Modyra has a small community and no
   third-party integrations.
2. **Version stability is uneven.** `@modyra/core` is at 2.4.0 and `@modyra/widgets` at 2.4.0, versioned
   under a [compatibility policy](../contract-compatibility.md). Every adapter is still below 1.0
   and can change its public surface in a minor release.
3. **Server-side story.** TanStack Form's server validation is a framework-integrated API [^3].
   Modyra's equivalent — running the same schema on both sides — works, but it is a documented
   pattern rather than an API.
4. **React Native.** Modyra's compiled output is Hermes-compatible ([verified](react-native.md)),
   but there is no `<TextInput>` binding, no storage-backed draft adapter and no example app.
5. **UI coverage is not uniform.** Angular, Lit and the framework-free renderer ship catalogs. The
   other five adapters are headless: you bring your own markup, and accessibility and theming are
   yours. See [headless recipes](headless-recipes.md).
6. **Angular Signal Forms** (experimental in Angular 21+) may eventually cover the typed and
   signal-based space natively.

## Where Modyra is ahead

1. **Behaviour ships in the engine.** Drafts, undo/redo, wizard gating and injection prevention are
   built in. No other library in this table covers drafts or undo/redo.
2. **Security surface.** Sanitization profiles, draft shape validation and option whitelisting are
   unique in this comparison.
3. **Forms as data.** The [Dynamic Form Contract](ai-generated-forms.md) is a validated,
   serializable form definition that a server or a visual editor can produce and a frontend parses
   strictly.
4. **Async validation control.** Debounce, `AbortSignal` cancellation, `dependsOn`, timeout and
   `when` are field options rather than something you assemble.
5. **One contract across renderers.** The 17 widget kinds carry the same anatomy, states and
   keyboard behaviour in every renderer that implements them, checked by a published conformance
   suite.

## Performance

**Not a head-to-head.** These are Modyra's own numbers, from its own benchmark suite. Comparing them
against another library needs that library installed to drive an equivalent harness, which this
repository does not do.

Wall-clock (`performance.now`) inside jsdom, zoneless. Expect ±10–20% between runs. Reproduce with
`npm run test:perf`.

| Scenario | Measured 2026-08-10 |
| --- | --- |
| Create 1,000 validated fields | 17.9 ms |
| Create 100 fields | 1.8 ms |
| 1,000× single-field update and read | 2.0 ms |
| 1,000× single-field update and read, with a cross-field validator | 329 ms |
| Full validity recompute, 1,000 invalid fields | 0.2 ms |
| Re-validate after 1,000 writes | 1.7 ms |
| `getChanges()` over 1,000 fields, 500 changed | 0.8 ms |
| Record 30 undo snapshots | 0.7 ms |
| Undo ×30 and redo ×30 | 0.3 ms |
| 100× nested `patch()` | 0.3 ms |
| 100× `submit()` with a no-op action | 1.6 ms |
| 50× async validator round-trip | 56.9 ms |

**One row deserves attention.** A form-level cross-field validator re-runs on *every* field write,
not only the field that changed — that is the 160× gap between the two update rows, reproduced
across runs. For an ordinary form it costs nothing. For a thousand-field form with a cross-field
validator and fast typing, it is the case to profile before shipping. Keep cross-field validators
cheap, or scope them to the fields they actually read.

## Choosing

| Your situation | Reasonable choice |
|---|---|
| React app, safest mainstream pick, React Native maybe later | react-hook-form |
| Multi-framework organisation, maximal type inference and SSR validation | TanStack Form |
| Vue-only app, want maturity | vee-validate, or Modyra's Vue adapter |
| Angular app, no extra dependencies acceptable | Reactive Forms |
| Angular app needing a wizard, drafts, undo or a UI catalog | Modyra |
| Need drafts, undo/redo, sanitization, or forms defined as data | Modyra — the only option in this table |
| Existing Formik or Final Form app that works | No reason to migrate; both are actively published |
| Long-term support contract mindset | One of the mature three; Modyra's adapters are still below 1.0 |

## Sources

[^1]: Zod 4 release notes — bundle methodology: https://zod.dev/v4
[^2]: TanStack Form supported frameworks: https://tanstack.com/form/v1/docs/framework
[^3]: TanStack Form v1 announcement — Standard Schema, async `AbortSignal`, SSR, persistence roadmap: https://tanstack.com/blog/announcing-tanstack-form-v1
[^4]: Compiled to Hermes bytecode with the compiler React Native 0.86 depends on, with zero errors. No native input renderer or example app. Full writeup: [React Native guide](react-native.md).

[^5]: `FormRecord` API — `addControl`, `removeControl`, `setControl`, `contains`; there is no method that renames a key while keeping the control's value and state, so a rename is a removal and an addition: https://angular.dev/api/forms/FormRecord

[^6]: Verified against the engine: a record row that was never rendered keeps the form invalid until it is filled, and its value reads back through a fresh handle. The rule and its reasons are [ADR 0026](../architecture/0026-a-row-exists-because-it-was-declared.md); the checks are in `packages/core/test/record-fields.test.mjs`.

[^7]: react-hook-form's own documentation for `useFieldArray`: "Field array relies on inputs being mounted and unmounted to manage its internal state", which is why `shouldUnregister: true` is not supported alongside it. Values are retained on unmount by default (`shouldUnregister: false`): https://react-hook-form.com/docs/usefieldarray
