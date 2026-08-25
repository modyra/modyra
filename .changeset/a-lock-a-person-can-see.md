---
"@modyra/styles": patch
"@modyra/plain": patch
---

A read-only field says so to the eye, not only to a screen reader

Every kind carried `aria-readonly="true"` when locked — measured, all twenty-four cases across the
three renderers — and **seventeen of them looked exactly as they had a moment before**. Somebody
listening was told; somebody looking tried to type, nothing happened, and nothing explained why.

The sheet already held the decision and the reason for it: a read-only field keeps its full contrast
and its pointer events, because it is *in play* — focusable, submitted, validated — and says it is
locked with a surface of its own rather than by fading, which is what `disabled` does. What was
missing was the state reaching the kinds that draw their own frame and never sit in an input wrapper:
a checkbox, a switch, a chooser, a slider.

The rule is now keyed on `[aria-readonly]`, the attribute the projections already emit, rather than on
a class each renderer has to remember — it was present in all twenty-four cases while the class was
in one. The plain renderer also passes `readonly` to its shell for the three kinds that were not.

**Zero of thirty-three now change nothing when locked.**
