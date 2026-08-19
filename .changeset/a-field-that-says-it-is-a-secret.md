---
"@modyra/core": major
---

A field that says it is a secret is treated as one

`sensitive` was declared by the Dynamic Form Contract, type-checked by the parser and offered by the
editor, and nothing that protects a value read it: a field marked sensitive was written to draft
storage in clear text and printed in full by the devtools panel.

It is now a property of the field — `field(initial, validators, { sensitive: true })`, or the
document's flag carried onto the descriptor — and the form excludes those paths from drafts, the
panel masks them, and `form.sensitivePaths()` publishes the list for anything else that copies values
out. ADR 0089.

**Breaking.** `MdyFieldDescriptor` and `MdyAnyFieldDescriptor` gain a required `sensitive` member:
descriptors built as object literals rather than through `field()` need it. A field already marked
sensitive in a document stops being autosaved, which is the repair.
