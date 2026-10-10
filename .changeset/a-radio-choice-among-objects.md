---
"@modyra/angular": patch
---

A radio group and a segmented control tell object-valued options apart, and honour a single option being disabled

Both keyed an option with `String(value)`, so every plain object became `[object Object]`: choosing
one option selected whichever was indexed last, and the checked state was compared by identity, so a
value that was structurally an option's but a fresh object matched none. They now key and match the
way the contract does (`defaultOptionKey`), as the other adapters already did.

An option's own `disabled` was ignored: only the whole field's state reached the inputs, and the
segmented control's arrow keys and drag selected a switched-off option. A disabled option is now
disabled in the page and stepped over by the arrows and by the pointer.
