---
"@modyra/widgets": patch
---

Unselecting a multiselect choice unselects it

`option[]` is a multi-set on purpose — `MDY_CHIP_CLASSES` carries `counter`, `count` and `step` for a
chip that raises and lowers a quantity — and the two presses mean different things:
`multiselectValueTransition` removes **one** occurrence for `decrement` and **the option** for a
toggle.

The controller reimplemented the toggle and spliced one occurrence out. A value of `["a","a","a"]`
took three presses of a chip that shows no count to clear, and after the first press the chip was
still selected with two held:

```js
multiselectValueTransition(["a","a","a"], { type: "toggle", value: "a" })   // []       the contract
controller.dispatch({ type: "toggle", optionKey: "a" })                     // ["a","a"] what happened
```

It also compared by identity while the rest of the widget keys an option by what it holds
([ADR 0051](../docs/architecture/0051-an-option-is-recognised-by-what-it-holds.md)), so an object
option could never be switched off at all.

The controller now goes through the published transition. `increment` and `decrement` are unchanged —
a counter chip still steps a quantity one at a time.
