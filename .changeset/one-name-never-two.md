---
"@modyra/widgets": patch
"@modyra/angular": patch
---

One name on a control, never two

A multiselect's trigger was named by the caption in two renderers and by its own words in the third,
so the same field said the same thing through two mechanisms — and any renderer carrying both would
have said only the first, because `aria-labelledby` wins the name computation and silences whatever
sits beside it.

All three point at the caption now, and say the words only where a document wrote no caption. The
contract's comment says which of the two applies and why, so a fourth renderer does not have to pick.

Angular's `labelId` is computed rather than captured at construction: a field initializer spells the
id the component had before the host gave it one, which resolves to no element.
