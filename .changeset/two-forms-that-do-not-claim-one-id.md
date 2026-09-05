---
"@modyra/widgets": patch
"@modyra/vue": minor
---

Two forms on one page do not both claim `when__label`

A widget's ids come from the field's own path, so the same document renders the same ids every time
and a consumer can write one down in advance. Two forms built from *that same document* are the case
the path cannot answer — they are identical by construction — so a scope goes in front, and the
question "is this scope already taken" decides which form gets which.

Vue never asked. Its components required a `widgetId` from the document and used it whole, so a host
rendering two forms handed both the same one: every id claimed twice, and a reference from the second
form resolving into the first — silently, because a duplicate id is an error nowhere. `widgetId` is
now optional and derived when absent, and `idScope` names a scope where a host wants to choose it.

**And "already taken" had one answer where two were needed.** A caller that can see the page knows a
form which is alive but *unmounted* holds nothing, so a remount reuses the ids the unmount gave back
— the property a hydrated page depends on. A caller whose widgets all compute their ids before any
of them is mounted is asking an empty document, which answers "free" for a scope another form has
just taken. The two are both right about different things, so the caller now chooses by what it can
observe: passing the page predicate says "the page is the authority", and passing nothing puts the
registry in charge. The registry tracks holders weakly and releases a scope when a form is destroyed,
which is what keeps a remount landing on the ids it had.
