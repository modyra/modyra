---
"@modyra/widgets": minor
"@modyra/react": patch
"@modyra/preact": patch
---

`comparableControllerOptions` and `stableControllerOptions` are published beside
`sameControllerOptions`, and the two hook-shaped adapters read them instead of each keeping a copy.
The rule for turning a configuration written at the call into one a controller can be memoized on is
one rule — what to compare, and what to do with handlers — and two copies of it are two answers
waiting to drift.
