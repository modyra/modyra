---
"@modyra/widgets": minor
"@modyra/lit": patch
"@modyra/angular": patch
"@modyra/plain": patch
---

A chip key is compared, not interpolated into a selector — and every object value stops collapsing into one

Two defects with one root, both invisible to a suite that only ever chose values that were strings.

**A structural key is not a legal selector.** The key that tells one chosen value from another is
derived from the value, and for an object it is the value's own contents as a string —
`{"id":1,"name":"Red"}`. Eight places built `[data-key="${key}"]` from one. The first quote closes the
selector and the browser raises `SyntaxError`: landing focus after a removal, focusing a chip after a
move and measuring midpoints during a drag did not misbehave, they threw, and took their handler with
them. Two of five representative held values do this — an object, and any string carrying a quote.

`elementByDataKey` reads the attribute back and compares it. Escaping would also work and needs a
second set of rules — attribute values and class names do not escape alike — where zero will do.

**Three derivations of one order, and one of them was wrong.** The strip lays chips out in the order
the value holds them, and all three renderers worked that out for themselves. Two used the contract's
key function; one used `String(value)`, which agrees on every primitive and turns every object into
`[object Object]`. Its strip *painted* correctly — painting reads the controller — while every gesture
that indexes into the strip indexed into a list of one. Five chips reordered as though there were one.

`chosenKeyOrder` is now the contract's answer, asked for by name. Three renderers read it; none
derives it.

The agreement between the three was never verified, only assumed: no test used an input where they
part ways. See ADR 0166.
