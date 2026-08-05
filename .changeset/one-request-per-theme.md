---
"@modyra/styles": patch
---

A theme is one request.

The source is composed — a theme imports the token file and the foundation, the foundation imports
the structural sheet — and that shape was shipped as written. A browser cannot discover an `@import`
until it has downloaded and parsed the file containing it, so linking a theme was three serial round
trips before the first rule applied, every one of them blocking render.

Each published entry point now carries its whole graph inlined. Measured on the modern theme over a
150 ms link at 1.6 Mbps, gzipped, three runs each:

| | time to a styled page |
| --- | --- |
| before | 701 ms |
| after | **415 ms** |

The source files are unchanged and still composed; this is a property of what is published. Only the
entry points named in `exports` are flattened — the internal sheets stay small, because flattening a
file nobody links to costs its full size and buys nothing.

The cost is the package: 29 kB to 111 kB, since five themes each carry the foundation. That is a
one-time cached install against 286 ms on every first paint for every end user.

No API change: the same import specifiers resolve to the same names.
