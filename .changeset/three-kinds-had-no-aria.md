---
"@modyra/widgets": minor
"@modyra/plain": patch
---

A range, a colour and a file field announce their state

`daterange`, `colors` and `file` are rendered without a widgets controller — the range policy, the
colour transitions and the file selection all live in `@modyra/widgets`, and the renderers own only
DOM and events. What went with that split by accident was the accessibility projection: nothing
built one for these three, so they applied the *static* part contract and nothing state-driven.

The state matrix caught six rows of it — `aria-invalid` and `aria-disabled` absent on all three. The
hole was wider than the rows. There was no `aria-required` and no `aria-describedby` either, so the
error list was rendered, styled, and tied to nothing: a screen reader was never told a range was
invalid, and never told why.

`projectFieldShellA11y` is new in `@modyra/widgets` — the shared half of `projectFieldA11y` with the
input's own concerns left out, since `type`, `inputmode`, `autocomplete` and `readonly` all belong
to a text control and none of these three kinds is one. The Plain renderers apply it, and the shell
label now names a control on all three.
