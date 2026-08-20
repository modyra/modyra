---
"@modyra/core": patch
---

A stray member is reported on a layout slot, and at every depth

`MDY_DYNAMIC_MEMBERS.layoutSlot` had no reader. A slot — `{ref, at}`, a field and where it sits — is
the one node where the member carries the meaning: `at` says which column the field takes at which
size, so a slot written `att` is a placement that never happens, and the document parsed clean in
strict mode with the misspelling kept in the parsed layout and handed to whatever draws it.

The layout was also only checked at its top. A row inside a section inside a row could carry a member
nothing reads and nothing said so.

The parser now walks the whole layout tree and reports at the path where the member is written —
`/layout/0/columns/1/0` rather than `/layout/0`. A document that parsed clean in strict mode may now
be refused; what it carried was already unread. See ADR 0097.
