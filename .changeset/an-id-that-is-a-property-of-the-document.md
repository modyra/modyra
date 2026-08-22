---
"@modyra/lit": major
"@modyra/angular": major
---

An id that is a property of the document, not of what mounted first

lit and Angular minted every widget id from a mount counter — `mdy-field-0__label`,
`mdy-control-datepicker-2__label`. The same field declaration got a different id depending on what
else was on the page first, which made three things impossible: a consumer could not write
`aria-describedby="when__label"` in their own markup and have it resolve, a stylesheet or a test could
not name one, and server-rendered markup disagreed with a client mount the moment their order did — a
hydration mismatch on an accessibility attribute rather than on visible text.

ADR 0135: **a widget bound to a field derives its id from that field's path, within its form's id
scope.** plain already did. All three renderers agree now, and the same document renders the same ids
every time it renders.

```
before   mdy-field-0__label · mdy-control-datepicker-2__label
after    when__label        · orders.0.due__label
```

**A widget with no field keeps a mount counter**, and its ids are explicitly not stable: an unbound
control is a documented shape in both packages and there is nothing to derive an id from.

**Two forms built from one document need a scope**, which is what `idScope` is for — an input on
Angular's controls and an `id-scope` attribute on lit's elements. Two fields called `when` on one page
collide visibly without it, and that is the better failure: two counters never collided and never
meant anything either.

**Migration.** If you named a Modyra-generated id — in your own `aria-*`, a selector, or a test — it
is now `<field-path>__<part>`. Angular's per-renderer `fieldId` members are gone; the base class
derives it for all fifteen.
