---
"@modyra/core": patch
---

The Java reader names why it refused a layout node

`sdk/java/modyra-contract` reported every refused nested layout node as
`MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE`, so a document nested too deep or with a malformed node told its
author to look for a misspelled field. It now uses the codes the TypeScript and Rust readers give the
same cause: `MDY_DYNAMIC_INVALID_LAYOUT` for depth and shape, `MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE`
for an unknown or repeated field and for a slot that cannot be placed. Which documents are refused
does not change.

**Migration for Java consumers.** Code that matched `MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE` to catch
every layout refusal also needs `MDY_DYNAMIC_INVALID_LAYOUT`. The `@modyra/core` header carries the
note into a release; the npm package itself does not change.
