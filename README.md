<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/brand/readme-banner-dark.png">
  <img src="docs/assets/brand/readme-banner-light.png" alt="Modyra — Model once. Render anywhere.">
</picture>

# Modyra

**Model once. Render anywhere.** A framework-agnostic, type-safe form
engine with native bindings for Angular, React, Vue and Lit — one shared
core, one shared headless widget layer, one shared theme package.

- No framework runtime, no RxJS — form state is plain signals and `computed`s
- Compile-time checked field bindings: `form.f.email` — typos don't compile
- Sync, async (debounced, cancellable, cross-field) and form-level validation
- Typed field arrays (`array()`) for repeatable rows — push/insert/remove/move
- Drafts (autosave/restore), undo/redo, minimal-patch change tracking, devtools
- Headless core or accessible ready-made controls — your design system or ours
- Incremental adoption paths — e.g. Reactive Forms interop (`mdyCva`) on Angular

[![CI](https://github.com/modyra/modyra/actions/workflows/ci.yml/badge.svg)](https://github.com/modyra/modyra/actions/workflows/ci.yml)
[![Release](https://github.com/modyra/modyra/actions/workflows/release.yml/badge.svg?branch=main)](https://github.com/modyra/modyra/actions/workflows/release.yml)
[![npm](https://img.shields.io/npm/v/@modyra/core)](https://www.npmjs.com/package/@modyra/core)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-GitHub-ea4aaa?style=flat&logo=github-sponsors)](https://github.com/sponsors/lorenzomusche)

## Packages

| Package                                               | What it is                                                                                               | UI layer                                                 | Peer deps              |
| :---------------------------------------------------- | :------------------------------------------------------------------------------------------------------- | :------------------------------------------------------- | :--------------------- |
| [`@modyra/core`](packages/core)                       | Framework-agnostic form engine: typed field trees, arrays, validation, drafts, undo/redo, i18n utilities | headless                                                 | —                      |
| [`@modyra/widgets`](packages/widgets)                 | Headless widget controllers + universal interaction/accessibility contract                               | headless                                                 | —                      |
| [`@modyra/angular`](packages/angular)                 | Angular binding on native signals                                                                        | full renderer catalog, themes, devtools, wizard, interop | `@angular/*` ≥21       |
| [`@modyra/react`](packages/react)                     | React binding via `useSyncExternalStore`                                                                 | headless — bring your own UI                             | `react` ≥18            |
| [`@modyra/vue`](packages/vue)                         | Vue binding on `@vue/reactivity`                                                                         | headless — bring your own UI                             | `@vue/reactivity` ≥3.4 |
| [`@modyra/lit`](packages/lit)                         | Lit binding — ReactiveController                                                                         | themable form elements                                   | `lit` ≥3               |
| [`@modyra/zod`](packages/zod)                         | Framework-agnostic Zod adapter — schema-first typed forms                                                | —                                                        | `zod` ≥3.25            |
| [`@modyra/standard-schema`](packages/standard-schema) | Standard Schema adapter — one adapter for Zod, Valibot, ArkType and every v1 vendor                      | —                                                        | —                      |
| [`@modyra/styles`](packages/styles)                   | CSS themes (`default`, `material`, `ios`, `ionic`, `base`) for every adapter                             | themes                                                   | —                      |

Every binding is a first-class citizen over the same engine: pick the one
for your framework, keep everything else identical.

## The engine in 60 seconds (framework-agnostic)

Everything below runs in plain TypeScript — Node, a CLI, a worker, a unit
test, or any of the four framework adapters. No framework in sight:

```ts
import { createForm, field, group, required, email, min } from "@modyra/core";

const form = createForm({
  email: field("", [required(), email()]),
  age: field<number | null>(null, [min(18)]),
  address: group({ city: field("Rome"), zip: field("") }),
});

form.f.email.set("not-an-email");
form.f.email.errors(); // ["Enter a valid email address"]
form.getValue().address.city; // "Rome" — fully typed, typos don't compile
```

> **Validators are factories, not values:** write `required()`, not
> `required` (value-style-validator muscle memory trips here — the
> resulting TS error is easy to misread). Validation errors come back as
> **arrays of message strings** (`["Name taken"]`), not `{ required: true }`
> keyed objects. To stop at the first failing validator instead of
> collecting all of them, use `composeFirst()` in place of `compose()`.

## Real-world scenarios, handled by the engine

These are the cases that make form code rot in production — nested data,
repeatable rows, server round-trips, refreshes, "apply my changes only".
Each one below is complete and runnable in plain TypeScript.

### 1. Checkout: nested groups, repeatable line items, a coupon checked server-side

An order form with an address group, a **typed array** of line items, a
coupon validated against the server (re-checked automatically when the
country changes), and server errors routed back to fields on submit.

```ts
import {
  createForm,
  field,
  group,
  array,
  required,
  min,
  pattern,
  crossField,
  serverValidator,
} from "@modyra/core";

const form = createForm(
  {
    country: field("IT"),
    shipping: group({
      city: field("", [required()]),
      zip: field("", [required(), pattern(/^\d{5}$/, "5 digits")]),
    }),
    // Typed repeatable rows: form.f.items.rows(), push/insert/remove/move
    items: array(
      group({
        sku: field("", [required()]),
        qty: field<number>(1, [min(1)]),
      }),
      { initial: [{ sku: "TSHIRT-BLK-M", qty: 2 }] },
    ),
    coupon: field(
      "",
      [],
      serverValidator(
        async (code, ctx) => {
          if (!code) return null; // optional field — skip the call
          // ctx.form reads the rest of the form; ctx.signal cancels stale calls
          const res = await api.coupons.check(
            code,
            ctx.form.fieldValue("country"),
            {
              signal: ctx.signal,
            },
          );
          return res.valid ? null : "Coupon not valid for your country";
        },
        {
          dependsOn: ["country"], // country flips → coupon re-validates itself
          debounceMs: 400,
          timeoutMs: 5000, // never a "pending" that lasts forever
        },
      ),
    ),
  },
  {
    validators: [
      // Form-level rule over the whole typed value
      crossField(["items"], (v) =>
        v.items.length === 0 ? "Add at least one item to the order" : null,
      ),
    ],
  },
);

form.f.items.push({ sku: "MUG-WHT", qty: 1 });
form.f.items.rows()[1].sku.errors(); // per-row, per-field errors
form.f.items.remove(0);
form.f.items.length(); // 1
form.getValue().items[0].qty; // number — a typo here is a compile error

const result = await form.submit(async (order) => {
  const res = await api.orders.create(order);
  if (!res.ok) {
    // Server errors land on the matching field (or the form, with path: null)
    return res.errors.map((e) => ({
      path: e.field,
      kind: "server",
      message: e.message,
    }));
  }
});
```

What the engine did for you: `items.0.sku`-style paths stay compile-checked;
`state.valid()` includes per-row validators _and_ the form-level rule; the
coupon re-checks itself when `country` flips and aborts the previous HTTP
call when you keep typing; `state.pending()` covers every async run, so a
submit button bound to `state.canSubmit()` can't fire mid-validation.

### 2. A long insurance claim: survive refresh, undo mistakes, patch only what changed

A 40-field claim form. The user refreshes mid-way (drafts), deletes the
wrong paragraph (undo/redo), and your backend only wants the diff
(`getChanges`).

```ts
import { createForm, field, group, required, minLength } from "@modyra/core";

const form = createForm(
  {
    policyNumber: field("", [required()]),
    incident: group({
      date: field("", [required()]), // ISO yyyy-MM-dd
      description: field("", [required(), minLength(30)]),
    }),
    iban: field("", [required()]),
  },
  {
    // Autosave to localStorage every 500 ms of idle; restored on reload.
    // Sensitive fields are masked in devtools and excluded from the draft.
    draft: { key: "claim-form", exclude: ["iban"] },
    history: true, // undo()/redo()
  },
);

form.f.incident.description.set("The kitchen pipe burst and…");
form.undo(); // oops — bring the paragraph back
form.redo();

form.getChanges(); // { incident: { description: "The kitchen pipe…" } }
// → the minimal PATCH body, typed
```

Drafts are versioned envelopes with a 7-day TTL: File/BigInt values are
refused, quota errors never crash the form, and `__proto__`-style paths in
a tampered `localStorage` entry are discarded at restore.

### 3. Schema-first: the backend already speaks Zod

The validation contract lives in one Zod schema shared with your API — the
form derives fields, initial values, validators and cross-field rules from
it, arrays included:

```ts
import { z } from "zod";
import { createZodForm } from "@modyra/zod";

const passengerSchema = z.object({
  fullName: z.string().min(1, "Required"),
  infant: z.boolean(),
});

const bookingSchema = z.object({
  flight: z.string().min(1, "Pick a flight"),
  passengers: z.array(passengerSchema).min(1, "At least one passenger"),
  contact: z.object({
    email: z.string().email(),
    phone: z.string().optional(),
  }),
});

const form = createZodForm(bookingSchema);
form.f.passengers.push({ fullName: "Ada Lovelace", infant: false });
// z.array() → typed field array; .min(1) → array-level validator gating submit
```

`zod` is an _optional_ peer (`>=3.25`, Zod 4 supported): apps that don't
use schemas never download it.

## The same app, four frameworks

The engine is identical everywhere — only the reactive binding and the
rendering idiom change. A complete checkout form (nested groups, typed
array rows, cancellable server validation, submit with server errors) is
implemented end-to-end, side by side, in:

- [Angular](docs/examples/angular.md) — `mdyForm` + the UI catalog, `@for` over `rows()`
- [React](docs/examples/react.md) — `useMdyForm` / `useMdyField`, array rows with `.map()`
- [Vue](docs/examples/vue.md) — `createVueForm` on `@vue/reactivity`
- [Lit](docs/examples/lit.md) — `createLitForm` + `<mdy-*-field>` custom elements

Adapter recipes, the four-primitive reactive contract and the Astro note:
[Multi-framework architecture](docs/guides/multi-framework.md).

## Coming from Angular Reactive Forms?

This library trades ecosystem maturity for compile-checked field paths,
signal-based state (zoneless-friendly, no RxJS — no runtime dependency, no
Observables in the public API, none used internally) and built-in
async/cross-field validation, typed arrays, drafts, undo/redo and devtools.
The `/interop` entry point (`mdyCva`, optional `@angular/forms` peer) covers
incremental adoption. Full, honest comparison:
[Compared with Reactive Forms](docs/guides/comparison-reactive-forms.md).

## Layers

```text
   Typed API (mdyForm)    Declarative API    Dynamic JSON config
            \                   |                   /
                Shared Form Engine  (@modyra/core)
                                |
             Headless widget layer  (@modyra/widgets)
                                |
     Angular ─ React ─ Vue ─ Lit  (one native binding each)
                                |
        Headless integrations  or  UI catalogs + @modyra/styles themes
```

The form engine — typed field trees, arrays, validation, drafts, undo/redo —
lives in [`@modyra/core`](packages/core), a zero-dependency package that
runs in plain Node. [`@modyra/widgets`](packages/widgets) adds headless
widget controllers and the interaction/accessibility contract shared by
every renderer. Each adapter implements the same four-primitive reactive
contract on its framework's native reactivity: Angular signals,
`@vue/reactivity`, React's `useSyncExternalStore`, Lit's ReactiveController.

## Angular entry points

| Import                    | Contents                                  | Extra peer deps                  |
| :------------------------ | :---------------------------------------- | :------------------------------- |
| `@modyra/angular`         | Full bundle: adapter + UI + tools         | —                                |
| `@modyra/angular/adapter` | Headless Angular adapter layer only       | —                                |
| `@modyra/angular/ui`      | UI primitives and built-in renderers only | —                                |
| `@modyra/angular/zod`     | `mdyFormFromSchema()`                     | `@modyra/zod` + `zod` (optional) |
| `@modyra/angular/interop` | `mdyCva` for Reactive Forms               | `@angular/forms` (optional)      |

## Documentation

The full index lives in [docs/README.md](docs/README.md). The shortlist:

- [Mental model](docs/guides/mental-model.md) — the state graph, field lifecycle, operation semantics
- [Typed forms](docs/guides/typed-forms.md) — schema, handles, `patch`/`getChanges`, async validation, field arrays, undo/redo, **drafts (read the security note)**, wizard, Zod
- [Schema adapters](docs/guides/schemas.md) — Zod vs Standard Schema (Valibot, ArkType, …): which model, which trade-offs
- [Usage modes](docs/guides/usage-modes.md) — declarative, explicit adapter, headless, validation semantics
- [UI toolkit](docs/guides/ui-toolkit.md) — renderer catalog, enterprise select, dynamic forms, CSS tokens
- [AI-generated forms](docs/guides/ai-generated-forms.md) — LLM output → `parseDynamicFields()` → render: the safe pipeline + system prompt template
- [DevTools](docs/guides/devtools.md) — hotkey overlay, masking, production notes
- [I18n](docs/guides/i18n.md) — UI strings (en/it/de/fr/es), date/time value models, localized parsing
- [Reactive Forms interop](docs/guides/interop.md) · [Comparison](docs/guides/comparison-reactive-forms.md) · [Troubleshooting](docs/guides/troubleshooting.md)

Project policies: [security](SECURITY.md) · [contributing](CONTRIBUTING.md) · [changelog](CHANGELOG.md)

## Compatibility and status

- **Angular 21+** — the engine relies on stable signal APIs (`linkedSignal`,
  `effect` semantics, signal-based inputs/queries) shipped in recent majors;
  older majors are not tested and not supported.
- React ≥18, `@vue/reactivity` ≥3.4, Lit ≥3, `zod` ≥3.25 — each only for its
  own adapter package.
- TypeScript strict mode; the library compiles with `strict` and
  `strictTemplates`.
- Status: young library, actively developed, single maintainer. `npm test`
  runs the whole matrix — core engine, every adapter, the widget layer and
  the Angular package (`test:core`, `test:adapters`, `test:widgets`,
  `test:angular` individually) — plus a tree-shaking bundle check
  (`npm run test:bundle`), axe-core accessibility tests over the main
  Angular renderers (jest + jsdom, inside `test:angular`) and a Playwright
  browser smoke test over the packaged Angular demo (`npm run test:e2e`,
  currently non-blocking in CI while it stabilizes); visual regression
  tests are still planned. Pin your version and read release notes.

## Examples

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/modyra/modyra/tree/main/examples/stackblitz)

`examples/stackblitz` is a minimal Angular signup form that runs against the
**published** `@modyra/angular` package — the fastest way to try the library
without cloning anything.

`examples/angular` is the full Angular demo app (typed, declarative, dynamic
and Zod sections over the whole renderer catalog) — one demo app per
framework, same engine.

`examples/{react,vue,lit}` implement the **same signup form** (name +
email, shared validators, agnostic devtools panel) so the adapters can be
compared side by side, with a runtime switcher across the shipped themes
(default, Material, iOS, Ionic). They import the **built** `@modyra/*`
packages from `node_modules` — the same artifacts users install, never the
library sources.

```bash
npm run demo:angular   # Angular demo over the packaged build
npm run demo:react     # http://localhost:4301
npm run demo:vue       # http://localhost:4302
npm run demo:lit       # http://localhost:4303
```

## Local development

```bash
pnpm install             # workspace deps use the workspace: protocol — use pnpm
npm run build:packages   # core + widgets + schema adapters + react/vue/lit + styles
npm run build:angular    # the Angular package (kept as build:lib alias)
npm test                 # the whole matrix: core, adapters, widgets, Angular
npm run demo:angular     # one demo per framework: demo:react / demo:vue / demo:lit
```

## Brand

Logo, palette and typography live in
[`docs/assets/brand`](docs/assets/brand) — three soft modules (the
adapters) around a shared negative space (the core).

<img src="docs/assets/brand/palette.png" alt="Modyra palette — Indigo #7067FF, Violet #A855F7, Coral #FF6577, Night #0E0F16, Cloud #F8FAFC, Slate #94A3B8" width="420">

## License

MIT © [Lorenzo Muscherà](https://github.com/lorenzomusche)
