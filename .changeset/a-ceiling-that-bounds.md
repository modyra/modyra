---
"@modyra/styles": patch
---

A chip's ceiling bounds it again.

The previous release replaced two constant caps with `max-width: 100%`, meaning "as wide as the strip
and no wider". **Inside a scroller `100%` resolves against the scrolled content**, and the scrolled
content is as wide as the chips make it — so the ceiling was the thing it was meant to bound, and a
long value grew past the field that holds it:

```
before   field 684px  ·  chip 1299px  ·  label 1177 of 1177, nothing cut
after    field 684px  ·  chip  668px  ·  label  594 of 1177, cut with an ellipsis
```

The machinery for shortening was still there — `overflow: hidden`, `text-overflow: ellipsis` — with
nothing left to bite on.

The ceiling is now `100cqw` against the widget's box, which takes its width from the field rather than
from the chips. The strip cannot be the query container: its own width *is* the chips, and a container
that sizes to its contents cannot also size them — asked to, it collapses to zero.

The strip still scrolls. Scrolling is for reaching the chips past the edge, not for reading one chip in
instalments.
