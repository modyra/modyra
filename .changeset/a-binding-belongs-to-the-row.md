---
"@modyra/core": patch
---

A disabled or readonly binding travels with its row

`setDisabled` and `setReadonly` lived on the field record, keyed by path — and a row's path is not
its identity:

- a keyed row renamed from `a` to `b` arrived without the binding, and the cell the consumer had
  excluded was **submitted** again;
- a positional row moved from index 0 to index 1 left the binding at index 0, where it suppressed the
  cell of whichever row arrived there — a value silently absent from the payload, and another
  silently present.

Everything else a row carries crossed both — value, touched, dirty, verdicts — and a binding made
before a row exists already waits for it, so a binding is row state rather than a subscription to a
spelling. It now travels with the row across `rename`, `insert`, `remove` and `move`.

What travels is the value, not the signal: the signal belongs to a control bound to the old path, and
a control stays where it is while rows move under it. A control that follows its row states its
binding again on the next render. See ADR 0044.

Every handle a form hands out is also registered with its owning runtime now — collection handles and
row trees as well as field handles — so `observerFor` no longer falls back to a fresh runtime, and
observing one through a foreign runtime is reported rather than silently accepted.
