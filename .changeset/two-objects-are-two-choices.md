---
"@modyra/vue": major
---

`@modyra/vue`'s option group identifies a choice by the key the contract derives, not by
`String(value)`.

Every plain object renders through `String` as `[object Object]`, so a list of object-valued choices
collapsed to one key: two different options submitted the same value, and a group holding one of them
marked all of them. The reference renderer has used `defaultOptionKey` for this since the same defect
was found there; this brings the Vue component onto it. For a primitive the two answers agree
exactly, which is why every fixture built on strings concurred and none could see it.

The selected choice is now decided by key as well. `===` between the value a field holds and a fresh
option object is false for two structurally equal objects, so a group asked which of its choices was
selected answered "none" about a value it was holding.

`field` and `options` widen from `MdyFieldHandle<string | null>` and `MdySelectOption<string>[]` to
`unknown`, which is what makes an object-valued list expressible at all. The type surface audit
classifies this `major` because a published prop type changed. Measured against the compiler rather
than assumed: a `MdyFieldHandle<string | null>` and a `readonly MdySelectOption<string>[]` are both
still accepted where the widened props are asked for, so existing call sites compile unchanged; the
direction that does not compile is a consumer who was *reading* the prop types back out as
`string`.
