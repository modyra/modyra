---
"@modyra/lit": patch
---

A colour field's hex box carries the name its document declared

Three renderers honoured a declared name on a colour field and this one did not, so a document that
named the control was ignored in exactly one place. It stayed invisible because the field still had
*a* name — the caption's — so a check asking "is this control named" answers yes. The question that
finds it is "named **what**".

Two earlier spellings of that line both dropped the declaration: one glued the English word "(hex)"
to a caption written in the document's language, and the one that replaced it used the caption alone,
which looked correct and was not.

The mechanism is a beat, not a missing branch. A document declares the name as an attribute on the
element, and the base captures it into a field **after a render commits** — so on the pass that draws
the control the words are still on the host, and from the next pass they are held with the attribute
removed. A template reading either place alone sees nothing on one of the two passes. Both are now
asked by one accessor, `declaredName()`, which the base's own capture uses too rather than spelling
the same pair of sources twice.
