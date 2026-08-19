---
"@modyra/core": patch
---

A name the contract refuses at one door is refused at every door

`buildFlatFormSchema` refused a field name carrying whitespace, the id delimiter or a prototype key;
`buildDynamicFormSchema` — the tree route, the one a parsed document goes through — took the same
name and built a form from it. Which pair of functions a consumer called decided whether their
document worked, and a name that reaches a widget id needs the same answer either way: whitespace
splits an `aria-describedby` reference into several, each resolving to nothing.

The rule now lives in one place (`assertSafeDynamicName`) and both routes read it.
