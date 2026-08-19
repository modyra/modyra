---
"@modyra/core": patch
---

A document whose `version` this reader does not have is refused as a version: it reports
`MDY_DYNAMIC_UNSUPPORTED_VERSION` at `/version` naming the version it carries, in both the flat and
the tree form. A tree document from a publisher one version ahead was refused as a malformed field
list, sending its host hunting for a broken field that does not exist. The flat reader also accepts
version 4 — v4 is v3 plus per-node conditions — and its message names all four versions instead of
three.
