---
"@modyra/vue": patch
---

`MdyOptionField` stops putting `aria-disabled` on its radio inputs

The native `disabled` is what signals a switched-off choice. The radio's `aria-disabled` restated a
state the `optionControl` part does not declare. The row still carries the disabled class wherever
the kind declares it. No migration.
