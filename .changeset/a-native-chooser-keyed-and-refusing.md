---
"@modyra/vue": patch
---

`MdySelectField`'s native chooser keys options as the controller does and marks unavailable ones disabled

In the native shape, each `<option>` had `String(value)` as its value, so every object-valued
option read `[object Object]` and a choice landed on the first of them. An option the document
declared `disabled` could also still be chosen. Options now carry the controller's key and their
`disabled` state. No migration.
