# Usage modes in Angular

`@modyra/angular` offers three ways to drive one engine, and lets them mix inside a single
application — or a single form, which is what makes a gradual migration possible. All three share
the same validators, renderers and devtools.

For the framework-independent picture — how a form is created, driven and rendered without any
framework — see [usage modes](./usage-modes.md).

| Mode | Source of truth | Best for |
| :--- | :--- | :--- |
| **Typed** (`mdyForm()`) | A TypeScript schema | New code — compile-time checked field bindings |
| **Declarative** | The template | Small forms, prototypes, template-only teams |
| **Explicit adapter** | The component class | Programmatic registration, custom integrations |

Typed is the recommended default. See the [typed forms guide](./typed-forms.md).

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
import { MdyDeclarativeAdapter } from "@modyra/angular/adapter";
import { min as mdyMin, required as mdyRequired } from "@modyra/core";

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

## Headless — `@modyra/angular/adapter`

Bring your own design system: the `adapter` secondary entry point exposes the
engine only — `mdyForm()`, the declarative adapter, validators, field/form
state types, DI tokens, i18n and utilities — with **no renderer components
and no CSS**.

```ts
import { mdyForm, field } from "@modyra/angular/adapter";
import { required as mdyRequired } from "@modyra/core";

const form = mdyForm({ email: field("", [mdyRequired()]) });
// form.f.email.value(), errors(), pending() … drive your own widgets
```

Same module instances and DI tokens as the primary entry point, so headless
fields and the ready-made renderers can coexist during a migration.

## Validation

Three ways to attach validation, and they compose:

1. **Directives in the template** — `mdyRequired`, `mdyEmail`, `mdyMinLength`, `mdyMaxLength`,
   `mdyPattern`, `mdyMin`, `mdyMax`.
2. **Pure functions** — compose `required()`, `min()` and the rest with `compose` or `composeFirst`,
   then register them through `upsertValidators` or an `mdyForm()` schema.
3. **Async validators** — in the schema:

   ```ts
   field("", [], { asyncValidators: [checkUnique], asyncDebounceMs: 300 })
   ```

   or through `adapter.upsertAsyncValidators(name, key, fns, { debounceMs })`.

4. **Cross-field validators** — `crossField(paths, fn)` receives the whole form value and attributes
   its error to every field involved, or to the form itself when `paths` is empty. Declare them in
   `mdyForm(schema, { validators: [...] })`, or bind `[formValidators]` on `<mdy-form>`.

How errors merge, when each kind clears, and what `valid` and `canSubmit` mean are engine behaviour
rather than Angular behaviour — see [the mental model](./mental-model.md#where-errors-come-from-and-when-they-clear).
