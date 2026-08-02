---
"@modyra/widgets": patch
---

A contract table cannot be keyed by a part that does not exist.

`PARENT_CANDIDATES`, `SHELL_CLASS_FALLBACK` and `MDY_SHELL_PART_STATES` are keyed by part name and
are **deliberately partial** — most parts need no parent hint, are not shell parts, and carry no
shell states, so a lookup that misses is an answer rather than a mistake. That rules out the
`PART_SEMANTICS` treatment (throw on a miss), and typing them to a union is no better: the union
would have to be derived from the catalogue these tables help build, and a type derived from the
data it validates checks nothing.

What was left to get wrong is the other direction — a **key naming a part that does not exist**. It
goes on being looked up, never matches, and silently contributes nothing: the parent hint stops
applying, the shell class stops being inherited, and the widget still renders, slightly differently,
forever. The keys are now checked once at load, and a stale one throws.

It found two immediately. `PARENT_CANDIDATES` was keyed by `decrement` and `increment`, which no kind
declares — removed here. Why they were written is recorded as finding I in `docs/contract-gaps.md`
and is not resolved by removing them: `@modyra/angular` does render spin buttons, they wear
`mdy-spin-btn`, the themes style them, and the contract declares no part for either. That is the
inverse of every other finding in that document — emitted and styled and declared by nothing, rather
than declared and wired to nothing — and it needs a decision rather than a patch.
