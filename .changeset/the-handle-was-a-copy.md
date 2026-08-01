---
"@modyra/angular": patch
"@modyra/widgets": patch
---

Fixes `handle.readonly is not a function`, thrown on the first render of any text field bound to a
typed form.

`@modyra/angular` declared its own `MdyFieldHandle` interface, written out member by member beside
the engine's. When the engine's handle gained `interactivity` and `readonly` — the two halves of what
a user may do — the copy did not. `_buildHandle` built a handle satisfying the copy, TypeScript
agreed, and the first widget controller to read `handle.readonly()` threw at runtime.

The type is now derived from the engine's rather than restated: the signal members re-branded as
Angular signals, the imperative half passed through unchanged. `markAsTouched(): void` is
structurally a zero-argument accessor, so a blanket mapping would have rewritten it as
`Signal<void>` — the commands are excluded by name.

The same mistake cannot be silent again: removing either member now fails the build rather than the
browser. A regression test asserts both are callable on a handle from `mdyForm()`.

Also in this change: the canonical snapshot used by the renderer-equivalence suite reads each state
from its most universal signal instead of from a class. `disabled` was read from a wrapper modifier
that only some kinds carry — a checkbox, a toggle and a file field are natively disabled and carry no
class at all — so half the catalogue reported no state. It now reads the native and ARIA attributes,
and all seventeen kinds report alike.
