---
"@modyra/core": major
"@modyra/styles": minor
---

The colour arithmetic ships with the themes it generates

`@modyra/core/color-utils` and `@modyra/core/theme-compiler` move to
`@modyra/styles`, which gains a JavaScript entry beside its stylesheets. Between
them they were 1065 lines — the second and sixth largest files in a package
described as a form engine — and nothing in that engine ever executed one of
them.

Measured before moving, because a move that grows a dependency edge is worse than
the misplacement it fixes: `color-utils` imports nothing, `theme-compiler` imports
only `color-utils`, no package imported either, and `@modyra/styles` had no
`@modyra` dependency at all. A leaf moving to a leaf; the graph cannot grow a
cycle from it.

Migration, for the thirty-one names that leave core:

```diff
-import { MDY_PALETTE_MODELS } from "@modyra/core/color-utils";
-import { compileMdyTheme } from "@modyra/core/theme-compiler";
+import { MDY_PALETTE_MODELS, compileMdyTheme } from "@modyra/styles";
```

Their tests move with them and run as `npm run test:styles`, which is part of
`npm run test` — a move that leaves its tests unreachable has deleted them
without saying so.

Recorded as ADR 0035, including the check it does not have: nothing enforces that
the two modules stay dependency-free, which is the property the move rests on.
