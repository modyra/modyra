---
"@modyra/core": minor
"@modyra/widgets": minor
"@modyra/plain": minor
---

A field name is an identity, and two of them cannot collide

Generated ids are `${widgetId}__${part}`. A field named `a__label` therefore lands on the same id as
field `a`'s label, in a different role — and the browser is perfectly happy to hold two elements
with one id, so `getElementById`, `label[for]` and every ARIA IDREF quietly stop being
deterministic. The failure is invisible until two particular fields share a page.

**`__` is now forbidden in a field name** rather than escaped. Escaping would have encoded `_`,
changing the id of every field whose name contains one, and those ids are consumer-visible —
selectors and tests are written against them. Forbidding costs nothing by comparison: an id built
from a name containing the delimiter was never deterministic, so nothing correct is taken away. The
dynamic parser drops such a field with a warning, as it already does for names containing `.`;
`mountMdyForm` throws, because a typed call site can be told at the call site.

`MDY_ID_DELIMITER` and `isValidWidgetId` are exported so a consumer can check a name before
building one. The delimiter lives in `@modyra/core` — the parser needs it and core cannot import
`@modyra/widgets` — and is re-exported from `@modyra/widgets` where the id policy lives.

**`mountMdyForm` also rejects duplicate names.** Two definitions sharing one used to collapse
silently: the second overwrote the first in the name map, the `rendered` set stopped the first from
drawing, and the form came out with one instance where the caller asked for two — a difference
visible only by counting. The dynamic parser already refused duplicates; the typed entry point now
holds the same precondition, and names the duplicate.

**If you have a field whose name contains `__`**, rename it. It was already producing colliding ids;
this only makes the collision say so.
