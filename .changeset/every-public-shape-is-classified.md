---
"@modyra/core": patch
"@modyra/widgets": patch
---

Every exported shape in the 1.0 packages is classified.

`contract-diff` snapshots the widget *catalogue* — parts, relations, states, capabilities — and had
never seen a TypeScript type. So every public interface was outside classification, and it showed:
four changes in recent memory reported `patch` because the differ had nothing to compare, including
a projection's shape and a required field added to an interface four adapters implement.

`npm run test:type-surface` records **205 exported shapes** from the *emitted* declarations, with
member names and optionality, and classifies a change the way `docs/contract-compatibility.md` says:

- optional → required, or a member removed: **major**
- a new optional member, or a newly exported shape: **minor**

Accept an intended change with `npm run type-surface:accept`.

This is what freezes `MdyFormError`, `MdyDynamicDiagnostic` and the parse result: not by forbidding
change, but by making a change to any of them a reviewable diff with a level attached.

**What it still cannot see** is member *types* — that `payload` exists and is optional, not that it
is `unknown`. A widening is invisible, and saying so is better than implying otherwise.
