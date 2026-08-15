---
"@modyra/widgets": patch
---

`MDY_FORM_SHELL_STRUCTURE` publishes its declared type

Its two nodes have different shapes — one names a parent, the other does not — so an inferred type is
a union of two object literals with optional members, and the two TypeScript implementations write
that union's members in different orders. The emit-equivalence gate reported the difference.

The constant is annotated as the `MdyWidgetStructure<MdyFormShellPart>` it already is, so the emitted
declaration is the same from either compiler. A consumer reading `part` off a node now sees
`MdyFormShellPart` rather than the literal of that position.
