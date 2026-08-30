---
"@modyra/core": minor
---

Version 1 of a dynamic form document is no longer accepted

Three runtimes read this contract and only TypeScript accepted `version: 1` — the Rust and Java
readers have 2, 3 and 4. A version two of the three refuse is not a version the contract has; it is
one parser being lenient, and a document that builds in one place and does not exist in the other two
is what a cross-runtime contract exists to prevent. ADR 0136 records the decision.

Migration, and it is one line: a document declaring `"version": 1` declares `"version": 2`. Nothing
else about it changes — version 1 differs from 2 in the envelope's number and not in the fields.

The refusal says which version it refused, which versions this contract has, and what to write
instead. A bare field array is unaffected: it declares no version, it is the shape most callers pass,
and it is still read.
