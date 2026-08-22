---
"@modyra/angular": minor
---

Five things the catalogue declares and this adapter did not draw or say.

- **The timepicker's segments are spinbuttons again.** They carried the native `min`/`max` and
  neither the role nor `aria-valuenow`, so a screen reader announced an edit box holding nothing
  where the other renderers announce a value in a range.
- **The number field draws its steppers by default.** `showSpinButtons` now defaults to `true`: the
  parts are the kind's anatomy, the foundation hides the native arrows, and a field drawing neither
  had no stepping affordance at all. Steppers on a disabled field are disabled with it. Pass
  `[showSpinButtons]="false"` for the box alone.
- **An option a document disabled cannot be chosen.** The native list drew it like any other and took
  it when it was picked.
- **The filter box in a multiselect popup has a name and says what it filters.** It was named by its
  placeholder, which stops naming it the moment somebody types into it.
- **The datepicker's opener names the view on screen.** `aria-controls` was fixed on the day grid,
  which is replaced when the month or year list opens, so the reference resolved to nothing exactly
  while the popup was in use. The range calendar's month and year views also had no widget id, so
  their names pointed at `__label`.
