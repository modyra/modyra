---
"@modyra/core": patch
"@modyra/widgets": patch
---

Every published `MDY_*` constant is frozen all the way down

Twenty-two of the thirty-six already were; sixteen were not, and five of those were frozen on the
surface only — an array frozen around live objects is a table anything sharing the page can rewrite
one entry at a time. The kind lists, the diagnostic table, the icon geometry, the four locale message
tables and the widget relation, transition and keyboard tables are now frozen at every level, with
`Object.freeze` written where the value is built rather than through a new shared helper.

Nothing in this repository mutated any of them, and the documented way to change UI strings is
`provideModyraLocale(locale, { overrides })` or a table of your own — so nothing documented is taken
away. `contract:diff` and `test:type-surface` are unmoved, which is what says no `as const` was lost.
