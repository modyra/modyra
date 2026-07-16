# Reactive Forms interop — `@modyra/angular/interop`

Adopt incrementally in an existing codebase: the `mdyCva` directive makes any
renderer a `ControlValueAccessor`, so it plugs into `formControlName` /
`formControl` / `ngModel` without an `<mdy-form>`. `@angular/forms` is an
**optional** peer — zero weight if you skip it.

```html
<form [formGroup]="group">
  <mdy-control-text mdyCva name="email" formControlName="email" label="Email" />
</form>
```

## Ownership rules in CVA mode

- Value, touched and disabled state sync both ways.
- **Validation belongs to Reactive Forms**: attach `Validators.*` to the
  `FormControl`. Do not also register mdy validators (directives or adapter
  calls) on a CVA-bound renderer — two validation systems on one control
  produce confusing, unmerged error states.
- The renderer's error display reflects the mdy adapter state, not the
  `FormControl` errors; render Reactive Forms errors with your own markup as
  usual.

## Angular Signals Forms

An official bridge to Angular's experimental `@angular/forms/signals` is
planned **only once that API stabilizes** — no compatibility promises before
that. The interop entry point is the intended home for it.
