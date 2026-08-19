---
"@modyra/zod": patch
---

A leaf derived from an optional piece starts at an empty that piece accepts. `z.string().optional()`
parses `undefined` into `undefined` — success with no `data` — and reading that as a default seeded
`null`, which every optional piece refuses. A form of optional fields therefore called itself valid
while holding four values its own schema rejects, and parsing what the form holds is the last thing a
consumer does before sending it. The seeds that already worked are unchanged: a default is its
value, a nullable is `null`, a string is `""`, a boolean is `false`. See ADR 0086.
