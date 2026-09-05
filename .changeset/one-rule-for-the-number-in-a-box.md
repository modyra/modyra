---
"@modyra/widgets": minor
"@modyra/vue": major
"@modyra/lit": patch
"@modyra/plain": patch
---

One rule for the number a person typed

A numeric field holds a number — that is its own value contract — and three renderers disagreed about
how to get one out of a box. Plain parsed the text. Lit read `valueAsNumber`, which is unimplemented
in some DOM implementations this library runs in and answers `NaN` for a box that plainly holds a
number, emptying the field on every keystroke. Vue did not convert at all: the model held `"1"` where
the contract says `1`, so every rule about bounds was judging text — and text compares by spelling,
where `"10"` is below `"9"`.

`numberEntered` is now the one rule, and the two edges are the ones that cost something on the wire:
`Number("")` is `0`, and a numeric field is nullable, so clearing the box must not supply a quantity
nobody typed — an order line of zero, a price that is free, a discount that is all of it. Text that
is not a number is nothing, not `NaN`.

**Migration for `MdyTextField` (Vue): none, for a document that passes a handle of strings.** Its
`field` prop is now a union of handles — `MdyFieldHandle<string> | MdyFieldHandle<number | null>` —
rather than a handle of a union, because a handle's type argument is invariant and the second form
would have broken every existing string handle for a change that does not concern it. A string handle
stays a member of the union.

**Where it can break**: code that *extracts* the prop's type and uses it in contravariant position —
a function typed on the component's field that calls `setValue` with a string — may stop compiling.
That is the truth in the tool's `major` verdict, and it is worth stating rather than claiming nobody
breaks. The change itself widens what the component accepts; nothing it accepted before is refused.
