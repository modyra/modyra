---
"@modyra/lit": minor
"@modyra/angular": minor
---

A text-like control asks the platform for the input its kind declares.

`text`, `email` and `password` share one anatomy and differ in exactly one thing: the native input
they want. The contract has always stated it — `controlType` — and these two renderers ignored it,
taking the answer from an attribute a host wrote by hand and defaulting to `"text"` when the host
wrote nothing. `@modyra/plain` and `@modyra/vue` already read the declaration; these two now do too.

The cost was silent. An email field whose author forgot the attribute rendered as plain text: no
email keyboard on a phone, none of the platform's own handling, and nothing anywhere saying so. A
typo in the attribute did the same.

Both gain a way to name the kind — `kind` on `<mdy-text-field>` and on `<mdy-control-text>` — and the
explicit type stays an override, because a host may have a reason the catalogue does not know. What
changed is the default: unset, the kind answers instead of a spelled-out `"text"`. A host that names
neither still gets a text input, so nothing that worked stops working.

`widgetKind` is deliberately untouched in both: the three kinds share an anatomy, so every answer the
base takes from the catalogue is the same for all of them, and widening a published type to say
something no rendering depends on would have been a breaking change bought for nothing.
