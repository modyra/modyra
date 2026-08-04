---
"@modyra/widgets": patch
---

The conformance CLI names its own coverage instead of overstating it.

Two of its eight sections — keyboard behaviour and the accessibility audit — cannot run in a Node
harness, because pressing a key and computing an accessible name need a real browser. The run said so
in a parenthetical and then printed `CONFORMANT`, which is the line a reader stops at and the one a
consumer wires into CI.

A run with unexecuted sections now reports:

```
CONFORMANT WHERE CHECKED  ·  17 kind(s)  ·  6 of 8 section(s) run
  Not established: Keyboard behaviour, Accessibility audit.
  Run the browser suites for these; this exit code does not cover them.
```

The exit code is unchanged — it still reports whether the sections that ran found anything, which is
what it has always meant. Only the verdict text changes, so a consumer asserting on the exit status
is unaffected; one grepping for the exact word `CONFORMANT` still matches.
