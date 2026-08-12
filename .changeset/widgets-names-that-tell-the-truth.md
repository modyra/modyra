---
"@modyra/widgets": major
---

Names that tell the truth, and one home per rule

**The overlay had two homes.** `MDY_OVERLAY_GAP` was in `overlay.ts`,
`MDY_OVERLAY_VIEWPORT_MARGIN` in the geometry module beside it. Two constants that govern the same
decision have to be read together or they are not a rule; the geometry and the anchoring that reads
it are one file now.

**The package's two hubs no longer import each other.** `contract.ts` and `structure.ts` each took
one thing from the other, and neither could be read or extracted alone. `MdyPartMap` — a record of
`MdyPartContract` — moved beside the thing it is a map of, which was the whole cycle.

**The text family is called what it is.** `createFieldController` serves text, email, password,
textarea, number and slider; calling it and its projection `field-*` meant a reader looking for the
text field did not find it, and a reader looking for the base every kind shares found a text field.
Renamed to `createTextFieldController` / `projectTextFieldA11y` / `MdyTextField*`.

`MdyFieldState` deliberately keeps its name. It is genuinely the base — value, invalid, disabled,
interactivity, touched, dirty, pending — and every kind's state is that plus what the kind adds. What
was text-specific were the *options* and the *intent*, which carry `inputType`, `inputMode` and
`autocomplete`; those moved to `text-field-types.ts`.

**Two files named for what they were not.** `timepicker-field-types.ts` held two hundred lines of
dial geometry, keyboard policy and ARIA — now `timepicker-dial.ts`. `slider-field-types.ts` declared
no type at all: its one function lives with the controller that serves sliders.

Migration is a rename with no behaviour change:

| before | after |
| --- | --- |
| `createFieldController` | `createTextFieldController` |
| `projectFieldA11y` | `projectTextFieldA11y` |
| `fieldPartIds` / `fieldRootClasses` | `textFieldPartIds` / `textFieldRootClasses` |
| `MdyFieldController` | `MdyTextFieldController` |
| `MdyFieldControllerOptions` / `MdyFieldIntent` / `MdyFieldA11yOptions` | `MdyTextField…` |
