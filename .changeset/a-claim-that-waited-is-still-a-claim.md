---
"@modyra/core": patch
---

A path can hold live claims and waiting ones at the same time — one control bound before the row
existed, another after. When a whole-value write ended the row, the count moving into waiting
replaced what was already waiting instead of adding to it, so two bound controls became one.
Releasing one of them then emptied the path while a control was still bound, and the bindings kept
under that name — the disabled and readonly signals a consumer sets — went with it: a cell excluded
from the payload was back in it for the row that arrived next. The same loss happened one level down,
where a replaced nested collection ended its leaves' claims outright rather than putting them back
in waiting.
