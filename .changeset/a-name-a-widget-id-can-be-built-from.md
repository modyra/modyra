---
"@modyra/core": minor
---

A field name a widget id cannot be built from is refused where names are checked, instead of at
render time by another package. `isSafeFieldPath` — the guard published for a consumer to check
with — called `a b` and `a__b` safe, `createForm` held them, and the widget layer then threw when it
asked for the field's part ids: whitespace turns an `aria-labelledby` into two references that
resolve to nothing, and the delimiter makes an id that cannot be taken apart. A document naming one
has always been refused at the door; a form written in code now gets the same answer at the same
place.

**Breaking for a form whose field names carry whitespace or `__`.** Such a form could not render in
any adapter — the refusal came from `assertUsableWidgetId` — so what changes is where it is refused.
Rename the field, or, if the name is data rather than a name, put it in a collection: a row key is
data and is spelled into an id rather than refused.
