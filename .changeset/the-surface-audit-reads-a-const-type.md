---
"@modyra/widgets": patch
---

The surface audit reads a constant's type as a value, not as part of its name.

A constant was recorded `const-> T`, which carries no `": "` — so the whole
string became the member's key. Renaming a type *inside* the declaration made
the old key vanish and a new one appear: one type change reported as a removal
plus an addition, of a key nobody can read, classified major twice. Written
`const: T` it parses the way every other member does, and the same change reads
as `is now \`X\`, was \`Y\``.

The baseline moves by 136 members and by nothing else: 997 entries before, 997
after, no name added, none removed, no type changed. It was produced by
rewriting the recorded file rather than by rebuilding one, so "reformatted, not
changed" is a property of how it was made and not a claim about it.

`audit-coverage-and-demo` matched the old spelling to keep constants out of its
population, so the new one put one back in and turned that gate red on a name
nobody had touched. It now matches the member's name rather than a neighbour's
formatting.
