---
"@modyra/widgets": major
---

Three type aliases removed; the name the contract owns is the one to use

`MdyChipMode`, `MdyLayoutBreakpoint` and `MdyLayoutSlotPlacement` are gone. Each repointed a name
that lives in `@modyra/core`, and each is replaced by that name:

| removed | use instead |
| --- | --- |
| `MdyChipMode` | `MdyMultiselectMode` |
| `MdyLayoutBreakpoint` | `MdyDynamicBreakpoint` |
| `MdyLayoutSlotPlacement` | `MdyDynamicSlotPlacement` |

The migration is a rename: the types are identical, so an import swapped for the one it aliased
compiles unchanged. Nothing about a chip's mode, a breakpoint or a placement has changed shape.

Why they existed and why they go: a widget must not re-declare what a document declares — two
declarations of the same two strings are a place for them to disagree — and an alias was one way to
say so. Using the owning name directly says it with one name instead of two, and the reason now sits
on the member that carries the value rather than on a second published name.

`MdyDynamicFormConfig` in `@modyra/core` is deliberately **not** removed. It aliases
`MdyDynamicFormDocument`, and its declaration says what it is for: it is the name consumers type
their documents as. That is a decision, not a leftover.
