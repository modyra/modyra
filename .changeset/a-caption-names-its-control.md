---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
"@modyra/vue": patch
---

A captioned control is named by its caption, and the required asterisk is no longer part of that name.

Plain, Lit and Angular used to copy a field's caption into `aria-label` on its control, alongside the
caption's own `<label for>` association. `aria-label` does not add to a native label, it replaces it,
so the hidden copy won silently the first time the two differed. Those three now write `aria-label`
only when the document declares `ariaLabel`, which Vue already did. With no caption words, the
fallback is unchanged: the declared name, then the field's own name. ADR 0214.

The rule is exported once as `fieldAriaLabel` from `@modyra/widgets`: it returns the declared name,
`null` where a caption with words names the control, and the field's name otherwise.

The required marker (`*`) is declared decorative: `projectFieldShellA11y` and
`projectBooleanFieldA11y` now return a `requiredMarker` part with `aria-hidden="true"`. Plain and Vue
now write that attribute, as Lit and Angular already did, so a required field captioned "Email address" is announced as "Email address" rather than
"Email address *". `aria-required` still tells a reader that the field is required.

Two more places follow the same rule. In Lit, the multiselect trigger is named by `aria-labelledby` at
the caption, as the contract and the other renderers name it, rather than by a copy of the caption.
The colour field's hex box asks `fieldAriaLabel` too. In Angular, the options grid of an open
multiselect is named by the caption through `aria-labelledby`. It used to borrow the control's
`aria-label`, which is now null wherever a caption exists, so the grid was left unnamed.

**Migration.** If a test or tool finds controls by their `aria-label` attribute, it should find them by
their accessible name instead (`getByRole(role, { name })`). Under ADR 0214 the caption supplies that
name rather than an attribute. A test that matched the name with the asterisk included now has to
match the caption's words on their own.
