---
"@modyra/core": minor
"@modyra/plain": minor
"@modyra/lit": minor
---

The line under a control can be written, and an empty one takes no room

**Every field drew a supporting-text slot, named it with `aria-describedby`, and nothing could put
words in it.** The slot was the promise and the half that keeps it was missing: no field type carried
the text, and the shell's element was fed from a projection that has an id and classes and no
content. A screen reader following the reference arrived at an empty element, which is worse than no
reference at all.

`MdyDynamicFieldBase.supportingText` is the missing half — a format, a limit, why the field is there.
Not an error: an error is a verdict on the value and comes and goes with it, and this is a property of
the field that does not change when the value does.

**And an empty slot now takes no height, in the renderer that was reserving it.** Three renderers gave
three answers to what sits under a field, so one stylesheet laid out three different forms:

```
                     gap between two controls, before → after
plain                84 → 56      an empty errors list at 24px, plus 24px of slot margins
lit                  60 → 56      an empty supporting-text slot
angular              56 → 56      neither
```

Plain rendered `.mdy-control__errors` at full height with nothing in it, and both it and Lit reserved
the supporting-text slot. Reserving height for a message before there is one is defensible — it stops
the form jumping when one appears — but reserving it in one renderer of three is not a choice, it is a
disagreement. All three answer the same way now, on every stylesheet.

The element is hidden rather than removed, because `aria-describedby` names its id unconditionally:
removing it leaves the reference pointing at nothing, which is the defect one step worse than the one
being fixed.
