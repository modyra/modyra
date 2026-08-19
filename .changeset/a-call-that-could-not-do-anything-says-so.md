---
"@modyra/core": patch
---

A call that could not do anything says so

`devWarnings` is documented as reporting "the calls that could not do anything", and five doors that
take a field name accepted one nobody declared, did nothing with it and said nothing: `patch`,
`patchValue`, `record.upsert`, `record.patch` and `setDisabled`. A typed consumer is covered by their
compiler; these are the doors where the keys come from data — a document, a server response, a saved
project — and there a typo is indistinguishable from a write that landed, because the form shows what
it already held either way.

Each now names what it ignored, in the sentence `setValue` already used.
