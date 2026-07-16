# Compared with Angular Reactive Forms

An honest comparison — Reactive Forms is a good, official API. This library
exists because Signals allow a different trade-off, not because Reactive
Forms is "wrong".

## Side by side

The same form in both APIs:

```ts
// Reactive Forms
readonly form = new FormGroup({
  email: new FormControl("", { nonNullable: true, validators: [Validators.required, Validators.email] }),
  address: new FormGroup({ city: new FormControl("Rome", { nonNullable: true }) }),
});
// template: <input formControlName="email" />  — "email" is a string, typos are runtime bugs
// value: Partial<…> with disabled-field caveats; state via valueChanges (RxJS)
```

```ts
// @modyra/angular
readonly form = mdyForm({
  email: field("", [mdyRequired(), mdyEmail()]),
  address: group({ city: field("Rome") }),
});
// template: <mdy-control-text [field]="form.f.email" />  — typos do not compile
// value: fully typed; state via signals (form.f.email.valid(), form.state.canSubmit())
```

## Concrete differences

| Aspect | Reactive Forms | @modyra/angular |
| :--- | :--- | :--- |
| State model | `FormControl`/`FormGroup` classes, RxJS streams | Signals: `value()`, `valid()`, `pending()` are `computed` |
| Field binding | `formControlName="email"` (string) | `[field]="form.f.email"` (compile-checked) |
| RxJS | Required (`valueChanges`, async validators) | Not used: no runtime dependency, no Observables in the public API, none internally |
| Async validation | `AsyncValidatorFn` (Observable/Promise) | Promise-based, debounce + last-wins built in |
| UI controls | Bring your own / Material | Optional built-in renderer catalog, or headless `/core` |
| Change detection | Works everywhere | Signals-first; zoneless-friendly |
| Stability & ecosystem | Official, mature, huge ecosystem | Young, one maintainer, smaller surface tested |
| Migration cost | — | Incremental via `mdyCva` (CVA interop) |

## Choose this library if…

- You want field bindings checked by the compiler, not by runtime errors.
- Your app is signals-first (or zoneless) and you don't want RxJS in forms.
- You want async/cross-field validation, drafts, undo/redo and devtools
  without assembling them yourself.
- You can accept a young library (pin versions, read the changelog).

## Stay with Reactive Forms if…

- You need the stability and support guarantees of an official Angular API.
- Your team already has deep Reactive Forms expertise and tooling.
- You rely on ecosystem packages built around `AbstractControl`.
- You target Angular versions older than 21.

## Performance

No published benchmarks yet — we make **no performance claims** until
reproducible measurements exist. Architecturally, per-field signals mean a
keystroke recomputes that field's `computed`s rather than re-validating the
whole tree, but verify with your own workload.
