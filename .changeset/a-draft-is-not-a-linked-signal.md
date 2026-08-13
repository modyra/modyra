---
"@modyra/core": major
"@modyra/angular": patch
"@modyra/vue": patch
"@modyra/solid": patch
---

A draft is not a linked signal

Asked whether the reactive contract should grow a linked signal — a writable
signal that resets when its source changes — the four places that looked like it
turned out to be three things.

Two were caches and stale, and a plain `computed` removed them. Two are drafts,
and a linked signal would make them **wrong**: a draft is what protects a choice
in progress from what arrives elsewhere, so resetting it when the value changes is
the yank it exists to prevent — a calendar jumping to a range that came from the
server while the user is choosing one. They re-seed on *open*, which is an event,
not a dependency.

So `linked` does not enter `MdyReactivity`, and `capabilities.writableComputed`
leaves it: a capability every one of the eight adapters answered `false` and no
consumer ever asked about. Adapters that spelled it delete the line.

Recorded as ADR 0034, including the check the decision does not have: nothing
asserts that an external write during an open popup leaves a draft alone.
