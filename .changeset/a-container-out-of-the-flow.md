---
"@modyra/plain": patch
---

An empty list that charged for a gap

plain's file field kept its list of attachments in the flow while it held nothing. In a column with a
gap an empty child is still a child: zero pixels tall and charged a full gap anyway — 29px against
the other two renderers' 21, from an element containing nothing.

The proof is inside plain rather than between renderers: the container beside it is equally empty and
costs nothing, being `hidden`. Same box, two treatments, one of them billed.

It is `hidden` now while empty. Under ADR 0180's amended test a container is kept only when it
appears outside the act a person is performing, or when a reference must land on it — the list fails
both: it changes because somebody just attached a file, and nothing names it.
