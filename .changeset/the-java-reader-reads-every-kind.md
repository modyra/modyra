---
"@modyra/core": patch
---

The Java reader reads every field family, and nests layout as deep as the others

`sdk/java/modyra-contract` knew five of the contract's eight field families and refused a document
carrying a date range, a file or a colour field; it now reads all eight, as the TypeScript and Rust
readers do. Its layout depth cap is 32, the value `MDY_LAYOUT_MAX_DEPTH` sets for the other two.

**Migration for Java consumers.** `MdyDynamicField` is a sealed interface and now permits three more
records: `MdyDynamicDaterangeField`, `MdyDynamicFileField` and `MdyDynamicColorsField`. A `switch`
that was exhaustive over the old five no longer compiles; add the three cases or a `default`. The
Java SDK is at 0.1.0 and sits outside `contract:diff`, so no tool classifies this break — this note
is its record. The `@modyra/core` header carries the note into a release; the npm package itself
does not change, since changesets has no entry for a package outside the npm workspace.

**Known gap.** The date range record does not yet carry the calendar options (`locale`,
`firstDayOfWeek`, `minDate`, `maxDate`), the same gap the single date record has. The reader ignores
unknown properties, so those values are dropped on a read-then-write round trip rather than refused.
