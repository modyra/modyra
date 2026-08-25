---
"@modyra/lit": patch
---

A single-choice control marks a single choice.

With option values that are objects, lit's radio group and segmented control marked **every** option
as the chosen one while the model held a single value. A radio group with two radios checked is a state
the control's own meaning forbids: a person cannot tell what the form holds, and pressing either is
what they have already done.

Both derived a projection key with `String(option.value)`, which renders every plain object as
`[object Object]` — so every option read the *same* entry, and the one marked as chosen marked all of
them. They read `defaultOptionKey` now.

Whether a value is this option's is asked once, in `isChosen`: identity first, then the key. Asked only
by identity — the other half of the same defect — a fresh object from a restored draft or a refetch
matched no option at all, and the model held a value nothing admitted to.

Three key sites in the multiselect's option grid are corrected the same way; they spelled
`String(option.value)` where the previous release corrected `String(value)`.
