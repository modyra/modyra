# Modyra

**Type-safe Angular forms built entirely on native Signals** — published as
`@modyra/forms`.

- No `FormControl`, `FormGroup` or RxJS — form state is signals and `computed`s
- Compile-time checked field bindings: `[field]="form.f.email"`, typos don't compile
- Sync, async (debounced, last-wins) and cross-field validation
- Headless core or accessible ready-made controls — your design system or ours
- Incremental adoption through Reactive Forms interop (`mdyCva`)

[![Angular](https://img.shields.io/badge/Angular-21%2B-red)](https://angular.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-GitHub-ea4aaa?style=flat&logo=github-sponsors)](https://github.com/sponsors/lorenzomusche)

## Install

```bash
npm install @modyra/forms
```

Add the styles (skip this if you use the headless `/core` entry point):

```json
"styles": [
  "node_modules/@modyra/forms/styles/modyra.css",
  "src/styles.scss"
],
```

## 60-second example

```ts
import { Component } from "@angular/core";
import {
  field, group, mdyForm, mdyRequired, mdyEmail, mdyMin,
  MdyFormComponent, MdyTextComponent, MdyNumberComponent,
} from "@modyra/forms";

@Component({
  selector: "app-signup",
  standalone: true,
  imports: [MdyFormComponent, MdyTextComponent, MdyNumberComponent],
  template: `
    <mdy-form [form]="form" [action]="save">
      <mdy-control-text [field]="form.f.email" label="Email" />
      <mdy-control-number [field]="form.f.age" label="Age" />
      <mdy-control-text [field]="form.f.address.city" label="City" />
      <button type="submit" [disabled]="!form.state.canSubmit()">Sign up</button>
    </mdy-form>
  `,
})
export class SignupComponent {
  readonly form = mdyForm({
    email: field("", [mdyRequired(), mdyEmail()]),
    age: field<number | null>(null, [mdyMin(18)]),
    address: group({ city: field("Rome"), zip: field("") }),
  });

  // Runs on submit while the form is valid; the typed value is inferred:
  // { email: string; age: number | null; address: { city: string; zip: string } }
  save = async (value: Record<string, unknown>) => {
    console.log(value); // call your API here;
    // return MdyFormError[] to show server errors on the matching fields
  };
}
```

Every handle on `form.f` is a typed bundle of signals — `value()`, `errors()`,
`touched()`, `dirty()`, `valid()`, `pending()`, `set(v)` — and a typo on a
handle path is a **compile error** (enforced by the library's own
`@ts-expect-error` type tests).

Prefer template-only forms? See [Declarative mode](docs/guides/usage-modes.md).

## Why not Reactive Forms?

Reactive Forms is official, mature and battle-tested — if that is what your
team needs, keep it. This library trades ecosystem maturity for:
compile-checked field paths, signal-based state (zoneless-friendly, no RxJS)
and built-in async/cross-field validation, drafts, undo/redo and devtools.

"No RxJS / no `@angular/forms`" means precisely: no runtime dependency, no
Observables in the public API, none used internally. The optional `/interop`
entry point is the single exception — it declares `@angular/forms` as an
*optional* peer for CVA-based migration.

Full, honest comparison: [Compared with Reactive Forms](docs/guides/comparison-reactive-forms.md).

## Layers

```text
 Typed API (mdyForm)   Declarative API    Dynamic JSON config
          \                  |                  /
              Shared Form Engine  (@modyra/core)
                             |
             Angular Signals binding (this package)
                             |
        Headless integrations  or  UI renderer catalog
```

The form engine — typed field trees, validation, drafts, undo/redo — lives
in [`@modyra/core`](packages/core), a framework-agnostic package with zero
dependencies that runs in plain Node. This package binds it to Angular's
native signals (`angularReactivity`), so form state participates in change
detection with no bridging layer; renderers, wizard, dynamic forms and
devtools are ecosystem layers on top. React/Vue adapters can implement the
same four-primitive reactive contract.

## Entry points

| Import | Contents | Extra peer deps |
| :--- | :--- | :--- |
| `@modyra/core` (separate package) | Framework-agnostic form engine | — |
| `@modyra/forms` | Angular binding: engine + renderers + tools | — |
| `@modyra/forms/core` | Headless engine only, no components/CSS | — |
| `@modyra/forms/zod` | `mdyFormFromSchema()` | `zod` (optional) |
| `@modyra/forms/interop` | `mdyCva` for Reactive Forms | `@angular/forms` (optional) |

## Documentation

- [Mental model](docs/guides/mental-model.md) — the state graph, field lifecycle, operation semantics
- [Typed forms](docs/guides/typed-forms.md) — schema, handles, `patch`/`getChanges`, async validation, undo/redo, **drafts (read the security note)**, wizard, Zod
- [Usage modes](docs/guides/usage-modes.md) — declarative, explicit adapter, headless, validation semantics
- [UI toolkit](docs/guides/ui-toolkit.md) — 15-renderer catalog, enterprise select, dynamic forms, CSS tokens
- [DevTools](docs/guides/devtools.md) — hotkey overlay, masking, production notes
- [I18n](docs/guides/i18n.md) — UI strings (en/it/de/fr/es), date/time value models, localized parsing
- [Reactive Forms interop](docs/guides/interop.md)
- [Compared with Reactive Forms](docs/guides/comparison-reactive-forms.md)
- [Troubleshooting](docs/guides/troubleshooting.md) — why is `canSubmit()` false? why is a field pending?

Project policies: [security](SECURITY.md) · [contributing](CONTRIBUTING.md) · [changelog](CHANGELOG.md)

## Compatibility and status

- **Angular 21+** — the engine relies on stable signal APIs (`linkedSignal`,
  `effect` semantics, signal-based inputs/queries) shipped in recent majors;
  older majors are not tested and not supported.
- TypeScript strict mode; the library compiles with `strict` and
  `strictTemplates`.
- Peers: `zod` and `@angular/forms` are optional (only for `/zod` and
  `/interop`).
- Status: young library, actively developed, single maintainer. 16 unit/type
  test suites and a tree-shaking bundle check are runnable today
  (`npm test`, `npm run test:bundle`); browser, axe and visual tests are
  planned. Pin your version and read release notes.

## Local development

```bash
npm run setup   # install + build the library
npm start       # demo app
npm test        # 16 suites (unit + type tests)
```

## License

MIT © [Lorenzo Muscherà](https://github.com/lorenzomusche)
