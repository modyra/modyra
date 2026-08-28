---
"@modyra/widgets": minor
---

`isWidgetKind`, `keyMeans`, `bindingForIntent` and `capabilityOf` — the questions the adapters were already asking

Every renderer reached the catalogues the same way and wrote the same expressions to do it:
`keyBindingFor(kind, key, open)?.intent === "open"`, `CONTRACTS[kind].capabilities.x === true`, a cast
asserting a string is a kind. Twenty-five sites across three adapters, and each one a chance to spell
the question differently — which is how a single declaration came to mean three things. Some sites
compared the intent, some checked only that a binding existed, and the two answers differ on a key
declared with another meaning.

The kind is always an argument. A helper closing over a kind reads well in the renderer that wrote it
and cannot be reused by the next, and the shape of these questions is what a fourth adapter needs on
its first day.

`capabilityOf` raises rather than answering when a capability is not a yes or a no.
`dismissOnOutsidePointer` is a named strategy and `anchoring` is a record of measurements; asked as
booleans they would come back `false`, which reads as "this kind does not do that" for six kinds that
do. A boolean question about a non-boolean value has no true answer, so it does not invent one.

No behaviour changes: this is the body that was already there, put where it can be asked instead of
copied.
