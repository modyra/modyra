---
"@modyra/widgets": minor
---

A reading says whether it was read

The first piece of the inspection layer (ADR 0188). Nothing hands out a bare value: a datum either
carries one and says where it came from and how, or carries the reason it does not — `unsupported`,
`absent-probe`, `threw`, `not-attempted`.

`undefined` from a probe means all four of those at once, and a reader shown a blank cell takes the
first: that the value is absent. It may mean nobody looked, and those are different findings with
different repairs.

`readPartAttribute` is the first collector and the shape the rest take: given an element and a part,
knowing nothing about who asked. All four endings are reachable through it — no element for the part
is `absent-probe`, while an element *without* the attribute is a **read** `null`, because it was
there and was asked.

The layer is checked by planting rather than by reading, which is what ADR 0188 says decides whether
it is worth building: make an unread render as an empty string and the guard goes red; make the
wrapper test truthiness instead of `undefined` and `false`, `0` and `""` are reported as unread —
the same defect inverted, and the one that passes for prudence.

On `@modyra/widgets/testing`: `reading`, `readingOf`, `unread`, `readingText`, `readPartAttribute`, the `MDY_NOT_READ` phrase every surface says, and the `MdyReading` a collector returns.
