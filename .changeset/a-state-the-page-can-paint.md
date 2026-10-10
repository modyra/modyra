---
"@modyra/vue": patch
---

Vue fields now carry the state classes the contract defines for the input wrapper and the caption

The classes come from `shellStateClasses`, given the field's state: `mdy-input-wrapper--error`,
`--readonly`, `--disabled`, and `mdy-label--has-error`, `--filled`. A field marks itself as
refused when it shows errors, which is the same condition the control's `aria-invalid` uses. A
field is filled when the contract's `valueIsPresent` says so. Before this, the root's
`--touched`/`--open` were the only state classes Vue rendered. A refused field therefore looked
valid to every theme, and a read-only form looked editable. No migration. Themes that already
target these classes now style Vue fields as well.
