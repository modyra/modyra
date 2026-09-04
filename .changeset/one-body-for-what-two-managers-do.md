---
"@modyra/core": patch
"@modyra/widgets": patch
---

Four bodies that were written twice are now written once, and two of them carried a difference
nobody had argued.

**`@modyra/core`** — the array and record managers shared `_destroyNestedUnder` and `nested`
character for character; both reach a collection by path, which is the one address the two kinds
agree on, so both moved to the module the managers already share.

Two divergences came out of comparing them line by line rather than from a failing test:

- reading a collection's values went through the door that **creates** a field in one manager and the
  door that creates nothing in the other. A read must not create, the host contract states the
  difference in as many words, and the array manager already used the non-creating door elsewhere in
  the same file — so this was an inconsistency inside one file rather than a considered choice;
- a collection declared inside a positional row was handed a warning function that **discarded** its
  messages. The same mistake — `setAll` given an array where the collection takes an object keyed by
  row key — was reported at the top level and inside a keyed row, and said nothing at all inside a
  positional one. It is now forwarded, and the deps declare `warn` as required, which is what the
  code always needed.

**`@modyra/widgets`** — `closePicker` was identical in the date and time controllers and `moveFocus`
in the date and range ones. Closing a panel is an act on the value (touched, not dirty — ADR 0167)
and moving the reading position must bring the month in view with it; written twice, each pair kept
its halves together only for as long as nobody edited one of them.
