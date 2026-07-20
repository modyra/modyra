# @modyra/angular

Angular binding for the [Modyra](https://github.com/modyra/modyra) form
engine — one of four first-class bindings (React, Vue, Lit are the others),
and the one shipping a ready-made UI layer: typed forms on native signals,
a full accessible UI catalog, devtools, multi-step wizard, declarative mode
and Reactive Forms interop. No `FormControl`, no `FormGroup`, no RxJS.

## Install

```bash
npm install @modyra/angular
# optional theme package (skip if you go headless):
npm install @modyra/styles
```

```json
// angular.json → styles
"styles": ["@modyra/styles/default.css", "src/styles.scss"]
```

**Angular 21+** is required (the library relies on stable signal APIs —
`linkedSignal`, `effect` semantics, signal-based inputs/queries).

## Entry points

| Import                    | Contents                                  | Extra peer deps                  |
| :------------------------ | :---------------------------------------- | :------------------------------- |
| `@modyra/angular`         | Full bundle: adapter + UI + tools         | —                                |
| `@modyra/angular/adapter` | Headless Angular adapter layer only       | —                                |
| `@modyra/angular/ui`      | UI primitives and built-in renderers only | —                                |
| `@modyra/angular/zod`     | `mdyFormFromSchema()`                     | `@modyra/zod` + `zod` (optional) |
| `@modyra/angular/interop` | `mdyCva` for Reactive Forms               | `@angular/forms` (optional)      |

## 60-second example

```ts
import { Component } from "@angular/core";
import { field, group, mdyForm } from "@modyra/angular/adapter";
import {
  MdyFormComponent,
  MdyTextComponent,
  MdyNumberComponent,
} from "@modyra/angular/ui";
import {
  email as mdyEmail,
  min as mdyMin,
  required as mdyRequired,
} from "@modyra/core";

@Component({
  selector: "app-signup",
  standalone: true,
  imports: [MdyFormComponent, MdyTextComponent, MdyNumberComponent],
  template: `
    <mdy-form [form]="form" [action]="save">
      <mdy-control-text [field]="form.f.email" label="Email" />
      <mdy-control-number [field]="form.f.age" label="Age" />
      <mdy-control-text [field]="form.f.address.city" label="City" />
      <button type="submit" [disabled]="!form.state.canSubmit()">
        Sign up
      </button>
      <button type="button" (click)="form.reset()">Reset</button>
    </mdy-form>
  `,
})
export class SignupComponent {
  readonly form = mdyForm({
    email: field("", [mdyRequired(), mdyEmail()], {
      asyncValidators: [
        async (v) => ((await isTaken(v)) ? ["Email taken"] : []),
      ],
      asyncDebounceMs: 300,
    }),
    age: field<number | null>(null, [mdyMin(18)]),
    address: group({ city: field("Rome"), zip: field("") }),
  });

  save = async (value: Record<string, unknown>) => {
    const res = await api.signup(value);
    if (!res.ok) {
      return [
        { path: "email", kind: "server", message: "Email already registered" },
      ];
    }
  };
}
```

> **Validators are factories:** write `required()`, not `required`
> (Reactive Forms muscle memory trips here). Errors come back as arrays of
> message strings; use `composeFirst()` to stop at the first failure.

## What you get

- **Compile-checked field paths** — `[field]="form.f.emial"` does not
  compile (enforced by the library's own `@ts-expect-error` type tests).
- **Sync, async and cross-field validation** — debounced, cancellable
  (`AbortSignal`), last-wins async runs with `pending` state; server-side
  checks that read the rest of the form via `serverValidator()`.
- **Typed field arrays** — `array()` for repeatable rows:
  `form.f.items.push(...)`, `@for` over `form.f.items.rows()`.
- **Drafts, undo/redo, `getChanges()`** — autosave/restore (versioned,
  TTL'd, sensitive-field aware), history, minimal-patch tracking.
- **Accessible UI catalog** — text, textarea, number, checkbox, toggle,
  radio, segmented, select (search/multi/chips), slider, datepicker,
  daterange, timepicker, colors, file — themed by `@modyra/styles`.
- **Devtools overlay** — inspect state live; sensitive-looking paths are
  masked.
- **Wizard** — multi-step forms over the same engine.
- **Declarative mode** — template-only forms when the typed API is overkill.

## Documentation

- [Complete checkout example](https://github.com/modyra/modyra/blob/main/docs/examples/angular.md)
- [Typed forms guide](https://github.com/modyra/modyra/blob/main/docs/guides/typed-forms.md)
- [UI toolkit](https://github.com/modyra/modyra/blob/main/docs/guides/ui-toolkit.md)
- [Usage modes](https://github.com/modyra/modyra/blob/main/docs/guides/usage-modes.md)
- [Reactive Forms interop](https://github.com/modyra/modyra/blob/main/docs/guides/interop.md) · [Comparison](https://github.com/modyra/modyra/blob/main/docs/guides/comparison-reactive-forms.md)

Status: young library (0.x), actively developed, single maintainer — pin
your version and read release notes.

## License

MIT © [Lorenzo Muscherà](https://github.com/lorenzomusche)
