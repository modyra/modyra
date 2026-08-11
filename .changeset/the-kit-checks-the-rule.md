---
"@modyra/widgets": patch
"@modyra/angular": patch
"@modyra/lit": patch
---

The conformance kit checks two rules a renderer used to be trusted on.

**Declared rules reach the control**: a field that states `maxLength(8)` must produce a control that
carries it. **A value the options do not contain is shown**: what a widget will not erase, it has to
display, or the form holds something nobody can see or remove.

Both were true of the framework-free renderer and asserted in its own suite, which is exactly the
arrangement that lets the next renderer be the one that forgets. The kit found two on its first run:
Lit's textarea and Angular's textarea carried no length constraint at all. Both fixed here.

A config says it forwards the kit's new inputs by exporting `declaresRules = true`; without it both
sections report **not run** rather than failing, because the kit cannot tell a renderer that ignores
a constraint from a config that never handed it one. The kit reads the control through `parts()`,
the one thing every config provides.
