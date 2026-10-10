---
"@modyra/vue": patch
---

The native `MdySelectField` drops its "nothing chosen" entry once a value is chosen

The disabled empty entry is the `placeholder` part, which the contract makes conditional on
`valueIsAbsent`. It used to stay in the list after a choice. It now stays only while nothing is
held, or while the document supplied its own `placeholder` text. Plain does the same.
`placeholder` now defaults to `undefined` instead of `"Select…"`. The text shown when no
placeholder is given is still "Select…", now read from `MDY_I18N_MESSAGES_DEFAULT.selectPlaceholder`.
No migration.
