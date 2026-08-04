---
"@modyra/core": patch
---

The SDKs carry the multiselect mode, and say what they ignore.

`mode` has been in the Dynamic Form Contract all along, and neither SDK modelled it. Java's
`MdyDynamicOptionsField` had no such component and `@JsonIgnoreProperties(ignoreUnknown = true)` on
top; Rust's `Field` had no such member. So a server that parsed a form and re-emitted it **silently
turned a counter multiselect into a toggle one** — and now that the widget contract picks an anatomy
by that value, the re-emitted document describes a different widget than the one it was written as.

Both SDKs now carry it, and both are tested by round trip rather than by inspection.

**`@JsonIgnoreProperties(ignoreUnknown = true)` is gone from all five field records.** An SDK that
reports success on a document it did not understand is the same silence one level up. The policy is
now stated once in the parser instead of five times on the records, and unknown properties are
**reported** as `MDY_DYNAMIC_UNKNOWN_PROPERTY` diagnostics rather than dropped — lenient enough that
a document written against a later contract still parses, honest enough that nothing disappears
without a word.

Rust also validates the value: an unrecognised mode is `MDY_DYNAMIC_UNKNOWN_MODE`, and a mode on a
kind that has none is `MDY_DYNAMIC_UNEXPECTED_MODE`. A mode nothing describes is worse than none,
because the widget contract would check the field against no anatomy at all.

The five headless adapters are unaffected: they render no markup, so no anatomy depends on the mode
there.
