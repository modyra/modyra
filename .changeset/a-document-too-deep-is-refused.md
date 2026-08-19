---
"@modyra/core": patch
---

A document nested past what the walk can carry is refused, not thrown out of

`flattenDynamicForm` walked a document's schema recursively, so a document nesting fifty thousand
groups raised a `RangeError` out of `parseDynamicForm` in both modes — an exception carrying no path,
catchable by no name, and indistinguishable from a bug in the caller's own code. The layout half of
the same parser has always answered with a diagnostic.

The walk is an explicit stack now, in document order, so the parser's own refusals are what a deep
document meets.
