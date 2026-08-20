---
"@modyra/core": patch
---

The pattern check reads the seam wherever it falls, and compares words whole

A hold-out corpus found a hole in each direction. Refused that should not have been: a list of words
— `(foo|bar|baz)+`, `(GET|POST|PUT)+` — because two alternatives start with the same letter, and a
quoted comma-separated list, because the comma at the end of its body is something `[^"]` can take
while the quote before it is not. Accepted that should not have been: `([A-Za-z]+[0-9]*)+`, whose
pinning digits may all be absent, and `([^x]+[^y]+)+z$`, which has no boundary anywhere and holds the
thread past a second and a half at thirty characters.

So the seam is read in every place it falls — trailing elements that may contribute nothing are
dropped first, the boundary is looked for across the whole fixed run after the stretchy part, and a
body that ends stretchy is ambiguous when two stretchy elements inside it can take the same
character. Literal alternatives are compared whole rather than by their first character; what makes
them ambiguous is one being a prefix of another. See ADR 0050.
