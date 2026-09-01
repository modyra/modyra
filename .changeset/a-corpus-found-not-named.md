---
"@modyra/core": patch
---

Both SDK suites read every document in the shared corpus

The Java and Rust suites named their fixtures by hand — `include_str!` in one, `resolve(name)` in the
other — so a document added to the corpus was read by nobody until somebody remembered. That is how
three documents came to be unread by two of the three readers while both suites reported their
passes as complete: the number a list reports is the number it was given.

Both now walk the directory. Each document's expected verdict comes from the corpus too — a
`.expected.json` beside it, whose absence means "this one parses clean" — so enumeration does not
force every fixture to be valid, and a document meant to be refused is not mistaken for a
regression.

A document is a file whose name carries no second suffix, which covers the next kind of companion
without being edited for it.
