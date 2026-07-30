---
"@modyra/studio-ui": minor
---

Each size keeps its own layout

Setting a width at `sm` also changed `md` and `lg`. That is the mobile-first cascade working as CSS
defines it — a size that states nothing follows the nearest smaller one that does — and the previous
change made it *legible*, labelling the inherited value `auto 2× from sm`. Legible is not the same as
correct: each size is meant to hold its own arrangement, and changing one must never move another.

Studio now **pins the sizes a change would otherwise move**. Before writing a size, every larger size
with nothing of its own is given the value it is currently showing, so it stops following. Setting
`md` to one column on a two-column row writes `lg = 2` first, then `md = 1`; `lg` stays two columns.
Smaller sizes are never touched, because the cascade only runs upward.

The same rule applies wherever a size is authored — the row's track count, a field's visibility, and
a field's column within the row — so the behaviour is one rule rather than three.

Only the sizes that would have moved are written, so a row still states what it needs rather than all
four sizes every time anything is touched. The emitted contract is unchanged in shape and still
cascades legitimately; what changed is that Studio stops *relying* on the cascade the moment the
author states something.

`auto` remains, and is now the only thing that puts a size back to following a smaller one.

Reported as *"ogni layout deve avere la sua conformazione, non è che se cambio in SM allora anche MD
sarà così."*
