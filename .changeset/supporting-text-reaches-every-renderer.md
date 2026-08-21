---
"@modyra/angular": minor
---

A document's supporting text reaches the slot in Angular too

`MdyDynamicFieldBase.supportingText` gave every field a way to say what its description should read,
and this adapter had no route for it: supporting text arrived only by projecting an
`mdySupportingText` template, and a document has no template to project. So the words existed in the
contract and reached three renderers of four.

Every control gains a `supportingText` input, and the dynamic form forwards the document's. The
projected template is now `projectedSupportingText`, which is what it always was — the *other* way to
supply the same slot, for a hand-written host.

Angular already had the half the other two lacked: it omits both the element and the
`aria-describedby` that names it when there is nothing to say, rather than pointing a reader at an
empty slot.
