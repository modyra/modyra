# Usage modes

`@modyra/angular` has one Signals engine and three ways to drive it. All
three share the same adapter, validators, renderers and devtools — you can mix
them inside one application (and even inside one form) while migrating.

| Mode | Source of truth | Best for |
| :--- | :--- | :--- |
| **Typed** (`mdyForm()`) | TypeScript schema | New code — compile-time checked field bindings |
| **Declarative** | Template | Small forms, prototypes, template-only teams |
| **Explicit adapter** | Component class | Programmatic registration, custom integrations |

The typed mode is the recommended default: it is the reason this library
exists. See the [typed forms guide](./typed-forms.md).

## Declarative mode

Zero boilerplate: define structure, values and validation directly in the
template. Fields are keyed by `name` and created lazily on first use.

```html
<mdy-form [formValue]="{ speed: 50 }" (submitted)="save($event)">
  <mdy-control-text
    name="username"
    label="Username"
    mdyRequired
    mdyMinLength="3"
  />

  <mdy-control-slider name="speed" label="Max Speed" [min]="0" [max]="100" />

  <button type="submit">Save</button>
</mdy-form>
```

Validator directives (`mdyRequired`, `mdyEmail`, `mdyMinLength`,
`mdyMaxLength`, `mdyPattern`, `mdyMin`, `mdyMax`) are reactive: changing
`[mdyMin]` at runtime re-registers the validator. Cross-field validators bind
via `[formValidators]` on `<mdy-form>`.

Trade-off vs typed mode: `name` is a string — a typo silently creates a new
field instead of failing to compile.

## Explicit adapter mode

Full control: create the adapter yourself to seed values, register validators
programmatically and drive submit with an async action (returned
`MdyFormError[]` are shown on the matching fields).

```ts
import { Injector, inject, signal } from "@angular/core";
import { MdyDeclarativeAdapter, mdyRequired, mdyMin } from "@modyra/angular";

export class Component {
  private readonly injector = inject(Injector);

  readonly adapter = new MdyDeclarativeAdapter(
    signal({ name: "", age: 18 }), // seed values
    signal("valid-only"), // submit mode
    this.injector, // enables async validators
  );

  constructor() {
    this.adapter.upsertValidators("name", "cmp", [mdyRequired()], true);
    this.adapter.upsertValidators("age", "cmp", [mdyMin(18)]);
    // Async validation with a real pending state:
    this.adapter.upsertAsyncValidators("name", "cmp", [
      async (v) => ((await isNameTaken(v)) ? ["Name already taken"] : []),
    ]);
  }

  readonly save = async (value: Record<string, unknown>) => {
    const res = await api.save(value); // your own API layer (pseudocode)
    return res.ok ? [] : [{ path: "name", kind: "server", message: res.error }];
  };
}
```

```html
<mdy-form [adapter]="adapter" [action]="save">
  <mdy-control-text name="name" label="Full Name" />
  <mdy-control-number name="age" label="Age" />
</mdy-form>
```

Any object implementing the exported `MdyFormAdapter` interface works too.

## Headless — `@modyra/angular/core`

Bring your own design system: the `core` secondary entry point exposes the
engine only — `mdyForm()`, the declarative adapter, validators, field/form
state types, DI tokens, i18n and utilities — with **no renderer components
and no CSS**.

```ts
import { mdyForm, field, mdyRequired } from "@modyra/angular/core";

const form = mdyForm({ email: field("", [mdyRequired()]) });
// form.f.email.value(), errors(), pending() … drive your own widgets
```

Same module instances and DI tokens as the primary entry point, so headless
fields and the ready-made renderers can coexist during a migration.

## Validation (all modes)

1. **Directives** — `mdyRequired`, `mdyEmail`, … in templates.
2. **Pure functions** — compose `mdyRequired()`, `mdyMin()`, … with
   `mdyCompose`/`mdyComposeFirst`; register via `upsertValidators` or an
   `mdyForm()` schema.
3. **Async validators** — in the schema
   (`field("", [], { asyncValidators: [checkUnique], asyncDebounceMs: 300 })`)
   or via `adapter.upsertAsyncValidators(name, key, fns, { debounceMs })`.
   The field's `pending` signal is true for the whole debounce+run window,
   results are last-wins (stale responses are discarded), and `canSubmit`
   waits for them.
4. **Cross-field validators** — `crossField(paths, fn)` receives the whole
   form value and attributes its error to every involved field (or to the
   form itself with an empty `paths` array). Declare them in
   `mdyForm(schema, { validators: [...] })` or bind `[formValidators]`.

### Error semantics

- Errors carry a `kind` (`"validation"`, `"async"`, `"cross-field"`,
  `"server"`, …), a `message` and — at form level — a `path`.
- A field's `errors()` merges, in order: sync validators, async validators,
  cross-field errors attributed to it, server errors from the last submit.
- Server errors clear as soon as the field's value no longer matches the
  value that was submitted.
- `state.valid()` is true when every field is valid **and** no cross-field
  error is outstanding; `canSubmit()` additionally waits for `pending()` and
  `submitting()`.
