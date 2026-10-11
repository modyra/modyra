---
"@modyra/widgets": patch
---

`defaultOptionKey` keys an array option apart from every other array option. Arrays holding objects, nested arrays, `null`, `undefined`, or strings that are empty or contain `,` or `[` used to join to the same `String()` text, so selecting one of them could select another. Those arrays are now keyed by what they hold, the way an object option is. An array of plain numbers, booleans or ordinary strings keeps the key it had (`["a", "b"]` is still `a,b`).

Migration: only the arrays listed above get a new key. Their part ids and `aria-activedescendant` values change too, so a selector or test that pinned one of those ids has to read the new key. Before this change those keys could be shared by two options anyway.
