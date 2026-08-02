---
"@modyra/widgets": minor
"@modyra/lit": patch
---

A radio group describes itself by an element that exists.

`projectOptionFieldA11y` chose its `aria-describedby` target from `errors.length` — whether errors
*exist* — rather than from whether the error list was *rendered*. A renderer that defers its list
until the field is touched has errors long before it shows them, so a required, untouched radio
group pointed at an error list that was not in the document.

The field shell already solved this: `projectFieldShellA11y` takes an `errorsVisible` flag and its
comment says why — *"deriving this from `errors.length` would make `aria-describedby` name an
element that is not in the document."* The option projection never got the same treatment.

`MdyOptionFieldA11yOptions.errorsVisible` now answers it, defaulting to "there are errors" so no
existing caller changes. Because this projection sits **behind** the controller — unlike the shell's,
which renderers call directly — `createOptionFieldController` takes
`errorsVisible?: (state) => boolean` and passes it through; a renderer cannot answer for itself
otherwise.

`@modyra/lit`'s radio and segmented elements now declare what their templates actually do
(`touched && invalid`). Measured before and after on the state fixture: `aria-describedby` went from
naming a missing `…__errors` to naming the supporting text that is really there.

Found by `scripts/conformance-cli.mjs`, which crosses the state fixture's mounting with the DOM
contract's checking — a combination no existing suite makes. Lit's own DOM suite mounts without
validators, so the required-and-untouched state it needs was never reached.
