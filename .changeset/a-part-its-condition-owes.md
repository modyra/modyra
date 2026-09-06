---
"@modyra/widgets": minor
---

The presence vocabulary gains a reader

The contract gates optional parts on named conditions — `fieldIsRequired`, `documentDeclaresIt`,
`kindOffersIt` and ten more, over 185 nodes — and `partIsOwed` answers whether one is owed. **Nothing
read it.** The structure walk decided from `optional` and `variant` alone, so a part gated on a
condition was a part nothing asked for: a renderer omitted the required mark on all seventeen kinds
and stayed conformant for the life of the feature, and the defect was found by measuring rather than
by any check going red.

`inspectWidgetDom` now accepts `holds` and `offers` and asks `partIsOwed` when given them. A caller
that cannot derive the facts is not made to invent them: without them the walk decides as it always
did.

The kit puts a field into the state a condition names and into the state that makes it false, because
only the pair can fail — a renderer that always draws the part and one that draws it correctly are
the same answer while the condition holds.

**Two limits, stated rather than papered over, because each was a wrong accusation first.**

`documentDeclaresIt` is not read yet. It is a fact **per part** — the document declared *this* part's
content — and the contract publishes no mapping from a part to the declaration that fills it. Asked
as one flag for the widget it reported a text field's prefix missing because a supporting line had
been declared. It joins the list the day the mapping exists.

Whether the field is in the state is **read from the widget**, not assumed of the mount. The first
version demanded the mark because it had asked for the state, and reported five kinds of a renderer
whose fixture declares no rule at all. A mount that cannot be put in the state is now named in the
run's note — eleven of them today — so an abstention is never read as a pass.
