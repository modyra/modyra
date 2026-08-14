---
"@modyra/studio-model": patch
---

A layout nobody can walk is dropped and named, instead of crashing a package downstream

Two ways an arrangement stopped a host.

**The depth guard was defeated by depth.** `STUDIO_LAYOUT_MAX_DEPTH` is a judgement about
arrangement — six levels is more than a form should need, and past it the walk reports and carries
on. What can be *processed* is a different question: `structuredClone` recurses, so a layout a few
thousand levels deep raised a `RangeError` **inside the clone**, before any guard ran.

```
depth 8      LAYOUT_TOO_DEEP reported, project handed on
depth 4000   RangeError
```

A project that deep is what a generator, an import or a loop in an editor produces, and the
difference between a diagnostic and a `RangeError` is the difference between a message and a host
that stopped.

**A section dropped into itself** — what a drag produces — survived, because `structuredClone`
*preserves* cycles rather than breaking them. It was reported as `LAYOUT_TOO_DEEP`, which is
technically true and the wrong message: a reader goes looking for a deep nesting they do not have.
The crash then landed one package later, in `arrangementDiagnostics`, counting something that has no
count.

A layout is now walked over an explicit stack on the **raw input, before the clone** — a guard that
runs after the clone is one the clone can defeat. A cycle is reported as `LAYOUT_CYCLE`, a layout
past the structural bound as `LAYOUT_TOO_DEEP`, and in both cases the layout is dropped and the
project opens: this module's own rule is that a stale arrangement degrades to "unarranged" and never
blocks opening a project.

A layout that is merely deeper than the arrangement bound is unaffected — it still loads, with its
warning and its layout.

Found by `battle-tests/adversarial/studio/`.
