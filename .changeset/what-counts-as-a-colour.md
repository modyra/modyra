---
"@modyra/lit": patch
"@modyra/plain": patch
"@modyra/widgets": patch
---

One field, one answer to what a typed colour is

The colour field had two rules. One renderer carried its own regular expression — `/^#[0-9a-fA-F]{3,8}$/` —
and it disagreed with the contract on five strings, **in both directions**:

```
#ffff  #fffff  #ffffffff  #12345     kept as the value there, refused by the contract
fff    "  #fff  "                    refused there, accepted and normalised by the contract
```

`#fffff` is a length no colour has. Stored, it becomes a value that paints as nothing: the field
visibly holds something and nothing shows it. And `fff` is what people type — refused in one renderer
while another accepts it is the same control answering two ways.

Both now call `createColorsFieldController`, which is where that rule already lived along with the
one nobody duplicated: **typing never closes the panel and choosing a preset does**, because `#0` is
on its way to being a colour and a field that committed or rejected on every keystroke would take a
half-typed value away from the person typing it.

Adoption goes from 44 of 51 renderer/kind pairs to 46. Angular's colour field still holds its own
open state through its overlay directive; its value already goes through the contract.
