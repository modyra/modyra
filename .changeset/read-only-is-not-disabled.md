---
"@modyra/widgets": patch
---

A read-only control no longer announces itself as disabled

Every a11y projection emitted `aria-disabled` as `state.disabled || state.readonly`, so a field a
form had marked read-only told assistive technology it was disabled. It is not: a read-only control
takes focus, its text can be selected and copied, and it is submitted with the form. Announcing it
disabled tells a screen-reader user they cannot interact with something they can.

`aria-disabled` now reflects `disabled` alone, in all seven projections. `aria-readonly` carries
read-only, and only on the kinds that declare the state — a slider, a checkbox and a radio group
have no read-only rendering and now say nothing rather than `aria-readonly="false"`.

**What this does not change, and is worth knowing.** Modyra still treats the two states identically
in every respect it controls: the same intent blocking in eleven places, both kept in
`form.value()`, both validated. In HTML a disabled field is neither submitted nor validated, and a
read-only one is both. That difference is real and is not implemented — it changes submitted
payloads, so it is planned separately rather than shipped here.
