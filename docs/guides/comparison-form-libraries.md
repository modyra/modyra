# Form library comparison — measured bundle sizes & feature coverage

**Date of writing: 2026-07-21.** Every figure below was measured locally on
this date against the real published packages — not scraped from marketing
pages. The document is intentionally cold: it lists what each library does
and does not cover, including where Modyra loses. Verify before quoting
months from now.

## 1. Methodology (fully reproducible)

- Packages installed from npm with `--save-exact`; versions below are the
  exact ones measured.
- Every library is bundled with **esbuild 0.25** (`--bundle --minify
  --format=esm`, `gzip -9`), from its published ESM entry, with peer
  frameworks external (`react`, `vue`, `@angular/*`, `rxjs`, `zone.js`) —
  you pay for your framework anyway.
- Two measurements per library:
  - **whole entry** — the entire package entry, worst case;
  - **realistic form surface** — only the exports a typical typed form
    with array fields and validation actually imports.
- Cross-check: our esbuild whole-entry figures land within ~5–10% of
  [Bundlephobia](https://bundlephobia.com) for every package (e.g.
  `@angular/forms`: 18.1 KB both), which validates the harness.
- `@modyra/core` is measured from the workspace build (`npm run
  build:core`) because it is **not published on npm** at the time of
  writing.

Exact versions measured: react-hook-form **7.82.0** · formik **2.4.9** ·
@tanstack/react-form **1.33.2** (+ @tanstack/form-core 1.33.2) ·
final-form **5.0.1** + react-final-form **7.0.1** + final-form-arrays
**4.0.1** · vee-validate **4.15.1** · zod **4.4.3** · @angular/forms
**22.0.7** · @modyra/core **0.2.0**.

## 2. Measured bundle sizes (min + gzip)

### Realistic form surface (what a real typed form with arrays pays)

| Package | Minified | **Min+gzip** | Surface imported |
|---|---|---|---|
| **@modyra/core** | 31.2 KB | **9.4 KB** | `createForm, field, group, array, 8 validators, serverValidator, oneOf` — includes drafts, undo/redo, security |
| final-form + react-final-form + final-form-arrays | 33.2 KB | **11.0 KB** | `createForm, arrayMutators, Form, Field` |
| react-hook-form | 34.8 KB | **12.5 KB** | `useForm, useFieldArray, Controller` |
| vee-validate | 36.7 KB | **12.7 KB** | `useForm, useFieldArray, Field, Form, ErrorMessage` |
| formik | 40.4 KB | **13.7 KB** | `Formik, Form, Field, FieldArray, ErrorMessage` |
| @tanstack/react-form | 65.9 KB | **17.3 KB** | `useForm` |
| @angular/forms | 94.5 KB | **18.1 KB** | Framework package; no per-export surface (see note) |

### Whole entry (worst case, everything exported)

| Package | Minified | **Min+gzip** |
|---|---|---|
| react-final-form stack | 31.2 KB | **10.2 KB** |
| react-hook-form | 36.8 KB | **13.3 KB** |
| vee-validate | 40.6 KB | **13.6 KB** |
| formik | 44.6 KB | **14.8 KB** |
| **@modyra/core** | 56.5 KB | **17.2 KB** |
| @tanstack/react-form | 72.6 KB | **19.1 KB** |
| @angular/forms | 94.5 KB | **18.1 KB** |

### The schema-validator add-on (applies to every library)

Using zod with *any* of these libraries (Modyra included, via
`@modyra/zod`) costs zod's weight on top. Measured on zod 4.4.3:

| Scenario | Min+gzip |
|---|---|
| esbuild, realistic `z.object` schema | **63.1 KB** |
| rollup, minimal `z.boolean()` | **9.1 KB** |
| zod's own published figure (rollup) | ~5.4 KB [^1^] |

The spread is real and bundler-dependent: zod v4's root entry pulls in all
~40 locales (198 KB min — 62% of the bundle) and **esbuild does not
tree-shake them out, rollup does**. If your app builds with esbuild, a
schema validator is the single largest line item in this comparison; if it
builds with rollup/webpack, it is a rounding error. `zod/mini` helps less
than expected under esbuild (57.1 KB gzip measured, same locale issue).

### Reading the numbers honestly

- On the **realistic surface** Modyra is the lightest package measured
  (9.4 KB gzip) — and that surface still includes features most
  competitors don't ship at all (drafts, undo/redo, sanitization).
  final-form's stack is close (11.0 KB) but covers a fraction of the
  feature set (§3).
- On the **whole-entry** metric Modyra (17.2 KB) is mid-pack: heavier
  than react-hook-form, vee-validate, formik and the final-form stack;
  lighter than TanStack Form and `@angular/forms`.
- `@angular/forms` is not directly comparable: Angular apps pay for the
  framework regardless; it ships no tree-shakeable form surface.
- Per-feature byte cost, Modyra is the most efficient package in this
  table; absolute whole-entry weight, it is not the lightest. Both
  statements are true; choose which metric matches your bundler's
  tree-shaking reality.

## 3. Feature coverage matrix

✓ built-in · ~ partial / external package / manual · ✗ not available

| Feature | Modyra 0.2 | TanStack Form 1.33 | react-hook-form 7.82 | formik 2.4 | final-form 5.0 | vee-validate 4.15 | Angular Reactive Forms 22 |
|---|---|---|---|---|---|---|---|
| Frameworks | NG/React/Vue/Lit + vanilla core | 7: React, Preact, Vue, Angular, Solid, Lit, Svelte [^2^] | React (incl. RN) | React (incl. RN) | Agnostic core + official React | Vue | Angular |
| Typed form API | ✓ descriptor inference | ✓ deep inference (DeepKeys) | ✓ generics + Path types | ~ weaker generics | ~ | ✓ | ✓ (since v14) |
| Standard Schema / schema-lib validation | ✓ (`@modyra/standard-schema`, `@modyra/zod`) | ✓ built-in [^3^] | ✓ via `@hookform/resolvers` (external) | ~ Yup first-class; zod community | ✗ validate fns only | ✓ zod/yup/valibot resolvers | ✗ validator fns only |
| Sync validation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Async validation | ✓ debounce + AbortSignal cancellation + `dependsOn` + timeout | ✓ debounce + AbortSignal [^3^] | ~ async validators; no built-in debounce/cancellation | ~ form-level async validate | ~ | ✓ | ~ AsyncValidators; manual cancellation |
| Cross-field validation | ✓ | ✓ listeners/linked fields | ~ manual (getValues/trigger) | ~ manual | ~ mutators | ✓ | ~ manual |
| Dynamic arrays | ✓ push/insert/remove/move/swap | ✓ | ✓ useFieldArray | ✓ FieldArray | ✓ via `final-form-arrays` pkg | ✓ useFieldArray | ✓ FormArray |
| Draft persistence (autosave/restore) | ✓ TTL, versioning, debounce | ~ "Persistence APIs" on the v1 roadmap (Mar 2025); shipment unverified [^3^] | ✗ (community `useFormPersist`) | ✗ | ✗ | ✗ | ✗ |
| Undo/redo history | ✓ built-in | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Wizard / multi-step | ✓ per-step validation gating | ✗ manual composition | ✗ manual | ✗ | ✗ | ✗ | ✗ |
| Submit lifecycle + server errors | ✓ submitting/counts/`errorsFor`/markAllTouched | ✓ + SSR `createServerValidate` [^3^] | ✓ handleSubmit + setError | ✓ + setErrors | ✓ | ✓ + setErrors | ~ manual |
| Injection-prevention / sanitization | ✓ profiles, length caps, option whitelisting | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Dynamic/JSON-declared forms (AI-ready) | ✓ `parseDynamicFields` + renderer | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Bundled UI components | ✓ Angular renderer catalog (~30 controls) + theme pkg + headless widgets | ✗ headless only | ✗ | ✗ | ✗ | ✗ | ✗ framework directives |
| i18n | ✓ core module | ✗ | ✗ | ✗ | ✗ | ✗ | framework-level |
| Devtools | ✓ core, UI-agnostic | ✓ | ✓ `@hookform/devtools` (external) | ✗ | ✗ | ~ Vue devtools | ~ framework |
| React Native | ✗ untested | ✓ | ✓ | ✓ | ~ | ✗ | ✗ |
| Server-side reuse of validation | ✓ engine runs in Node; same schema gates API | ✓ first-class SSR API [^3^] | ~ resolvers run anywhere; no server API | ~ | ~ | ~ | ✗ |
| On npm at time of writing | **✗ (pre-release)** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## 4. Where Modyra is behind (read this before adopting)

1. **Maturity and ecosystem.** react-hook-form (~43k GitHub stars in
   2025 [^4^]), formik and final-form have years of production mileage,
   Stack Overflow coverage and UI-library integrations (MUI, AntD…).
   TanStack Form alone reports ~2.5M weekly downloads [^5^]. Modyra is
   pre-1.0, not yet on npm, with a small community and no third-party
   integrations.
2. **Framework breadth.** TanStack Form covers 7 frameworks including
   Solid, Svelte and Preact [^2^]; Modyra covers 4 plus a vanilla core.
3. **Server-side story.** TanStack Form's `createServerValidate` is a
   first-class SSR feature [^3^]; Modyra's isomorphic pattern (same zod
   schema client/server) works but is a documented pattern, not a
   framework-integrated API.
4. **React Native.** RHF, Formik and TanStack Form support it; Modyra
   does not (web-only, untested on RN).
5. **Non-Angular UI.** Modyra's full renderer catalog (~30 controls,
   theme, dynamic form) ships for Angular only; React/Vue/Lit get the
   adapter + headless recipes — you bring or compose your own components.
6. **Pre-stable API.** Modyra is 0.x: breaking changes are possible
   between minors; Angular Signal Forms (experimental in Angular 21+)
   may eventually cover the typed/signal space natively.

## 5. Where Modyra is ahead

1. **Batteries in the engine**: draft persistence, undo/redo history,
   wizard gating and injection-prevention ship *inside* the core — no
   competitor in this table covers drafts or undo/redo natively.
2. **Security surface**: sanitization profiles, draft shape validation,
   option whitelisting (`oneOf`) are unique in this comparison.
3. **AI-generated forms**: a whitelisted JSON contract
   (`parseDynamicFields`) designed for LLM output; no equivalent found
   elsewhere.
4. **Angular depth**: the most complete signal-based form UI for Angular
   today (renderer catalog, theme, dynamic forms, wizard) — the framework
   itself only offers Reactive Forms primitives (Signal Forms is still
   experimental).
5. **Async validation control**: debounce + AbortSignal cancellation +
   `dependsOn` + timeout + `when` as first-class field options (TanStack
   Form matches debounce+cancellation; others are manual).
6. **Measured realistic weight**: lightest form surface in this
   comparison (9.4 KB gzip) despite shipping more features.

## 6. Cold decision guide

| Your situation | Reasonable choice |
|---|---|
| React app, want the safest mainstream pick, RN maybe later | react-hook-form |
| Multi-framework org, want maximal type inference + SSR validation | TanStack Form |
| Vue-only app, want maturity | vee-validate (or Modyra's Vue adapter) |
| Angular app, zero extra deps acceptable | Reactive Forms (watch Signal Forms) |
| Angular app needing wizard/drafts/undo/UI catalog out of the box | Modyra |
| Need built-in drafts, undo/redo, sanitization, or AI-declared forms | Modyra (only option in this table) |
| Existing Formik/Final Form app, works fine | No reason to migrate (both actively published: formik 2.4.9, final-form 5.0.1) |
| Risk-averse enterprise, long-term support contract mindset | Any of the mature three; Modyra is pre-1.0 |

## Sources

[^1^]: Zod 4 release notes — core bundle methodology and Mini: https://zod.dev/v4
[^2^]: TanStack Form supported frameworks: https://tanstack.com/form/v1/docs/framework
[^3^]: TanStack Form v1 announcement (Standard Schema, async AbortSignal, SSR, persistence roadmap): https://tanstack.com/blog/announcing-tanstack-form-v1
[^4^]: TanStack Form vs React Hook Form (stars, comparison 2025): https://blog.logrocket.com/tanstack-form-vs-react-hook-form/
[^5^]: TanStack Form product page (weekly downloads, stars): https://tanstack.com/form/latest

All bundle figures: local esbuild 0.25 / rollup 4 measurements per §1,
2026-07-21, cross-checked against https://bundlephobia.com (within ~10%).
