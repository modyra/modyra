---
"@modyra/lit": patch
"@modyra/plain": patch
---

Choosing the second object-valued option stops writing the first.

A native `<select>` carries a string on each `<option>`, and lit wrote `String(option.value)` there —
so an object-valued list gave every option `value="[object Object]"`. The browser could not tell them
apart, and the change handler looked the picked string up in the list and answered with whichever came
first.

Measured before and after, both renderers, two object-valued options:

```
before   option values distinct 0 of 2   ·  picking Beta left the field on Alfa
after    option values distinct 2 of 2   ·  picking Beta shows Beta
```

This one reaches the model rather than the page: a person's own selection was silently replaced by
another. plain's radio, segmented and select derived their projection keys the same way and are
corrected with it.
