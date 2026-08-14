---
"@modyra/core": minor
---

`oneOf` recognises an option by what it holds, so a draft's round trip is not tampering

A draft is written as JSON and read back as JSON, and `oneOf` compared options with `Object.is`:

```js
const OPTIONS = [{ id: 1, label: "One" }, { id: 2, label: "Two" }];
field(null, [oneOf(OPTIONS)]);

// user picks OPTIONS[0]           → valid
// draft saves, form reopens       → { id: 1, label: "One" }, a different object
//                                 → "not an offered option", form invalid
```

A user who left a form half-filled and came back was told their own choice was not on the list, with
no way out but to pick the same thing again.

`oneOf` and `eachOneOf` now compare an object option by its members, recursively — for the shapes
JSON round-trips: plain objects, arrays, dates and primitives. A class instance, a `Map` or an option
carrying a function keeps identity comparison.

**The guard is exactly as strict.** A member missing, a member added, a member of the wrong type, a
member differing in case, an id that was never offered, a bare label instead of the option — all
still refused. Two structurally identical options in one list do become indistinguishable, which is
the correct answer to the question `oneOf` asks.

`getChanges()` is unchanged and still compares leaves with `Object.is`.

Found by `battle-tests/adversarial/persistence/option-identity.battle.test.mjs`. Recorded as
[ADR 0051](https://github.com/modyra/modyra/blob/main/docs/architecture/0051-an-option-is-recognised-by-what-it-holds.md).
