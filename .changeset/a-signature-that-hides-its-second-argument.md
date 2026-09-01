---
"@modyra/widgets": patch
---

The conformance kit documents the argument it actually passes

The tool's header showed `mount(kind)` while the kit calls `mount(kind, { … })` in three shapes — a
configured variant, a field with no rules, and a field with exactly these rules. A renderer written
from the documented signature never receives what a document declares, so a section asking whether a
part appears *because the document declared it* cannot be answered, and reports a defect the
renderer does not have.

The header and `MdyStateFixture`'s own type now say what arrives and which section sends it. A mount
that ignores `asked` is conforming for every section that does not use one; what it may not do is
take the argument and drop it, because the sections that pass one report against what they asked
for.
