---
"@modyra/widgets": minor
"@modyra/react": patch
"@modyra/preact": patch
---

A subscribable store over signals, published once

`@modyra/widgets` exports `createSignalStore(signals, reactivity)` and
`createFieldSignalStore(handle)`, plus the `MdySignalStore` type. A store notifies on any change to
the signals it watches, tracks only while something is subscribed, resumes with the latest value at
the next subscribe, and ends only at `destroy()`. A field store also ends when its form is destroyed.

`createStore` and `createFieldStore` in `@modyra/react` and `@modyra/preact` now delegate to these,
so the two adapters cannot drift apart. Their signatures and behaviour are unchanged; nothing to
migrate.

The widget contract differ classifies this change as `patch` because it reads parts, relations and
keyboard only. The type surface gains two exports, which is `minor`.
