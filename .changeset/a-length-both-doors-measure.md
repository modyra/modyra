---
"@modyra/core": patch
---

A field name longer than a path may be is refused at the flat door too

`MDY_MAX_DYNAMIC_PATH_LENGTH` is 512, and it is a *length* rather than a depth for the reason written
where it is declared: a path is the payload key, the draft key, the widget id and a string every
renderer carries per field, so the cost of a name is paid at every read of every value.

The nested door held documents to it. The flat door did not — a name of 513 characters, or of a
hundred thousand, was accepted with no diagnostic — and the flat door is the one an untrusted
document arrives at: `fields: [{ name, kind, label }]` is the whole of version 1 and the field half
of every version since.

Both doors now refuse under the same code, `MDY_DYNAMIC_PATH_TOO_LONG`. A document carrying such a
name loses that field, as it already did through the other door.
