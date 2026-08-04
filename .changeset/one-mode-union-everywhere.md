---
"@modyra/widgets": patch
"@modyra/angular": patch
"@modyra/plain": patch
"@modyra/lit": patch
---

One declaration of the multiselect mode union, referred to everywhere else.

`"single" | "multi"` was written out in five places besides the one that owns it: an exported alias
in `@modyra/widgets` (`MdyChipMode`), a parameter in its behaviour module, a Lit property, a Plain
parameter, and an Angular signal input. Each was free to drift from the value a form document
actually carries.

`MdyMultiselectMode` in `@modyra/core` is that value — the mode is a field of the Dynamic Form
Contract, which both SDKs carry. Every other site now refers to it.

`MdyChipMode` stays exported and keeps its meaning; it is now an alias rather than a second
declaration, so nothing needs changing at a call site.

Also: the type-surface audit records what a single-target alias points at, rather than recording it
as opaque. Re-pointing an alias is the change most worth seeing, and it was invisible — including for
`MdyWidgetVariant`, which the baseline held as `(opaque)`.
