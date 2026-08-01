---
"@modyra/widgets": minor
---

Every class a renderer emits is declared by the contract

Enumerated exception lists on each adapter — 25 on Plain, 40 on Angular, 6 on Lit — recorded classes
the renderers used and the contract had never described. They are gone: every one is now declared,
and no adapter carries an exception list.

Most became `presentation` classes on their kind. Structure the themes style that the contract does
not otherwise constrain — a spacer, a header label, a variant marker — declared so a theme can
enumerate what it may target and a renderer knows what it may emit, and deliberately **not** promoted
to parts. A part has anatomy: an element, a parent, an order, a place in every relation and state
check. Claiming that for a visual container would freeze the DOM far past what has to be shared,
which is the one thing this contract sets out not to do.

`MDY_SHARED_UI_CLASSES` covers what belongs to no single widget: the shared button, the overlay
machinery, the surface treatments.

An adapter that needs a hook the contract has no opinion on namespaces it, and the inspector takes an
`adapterPrefix` — a rule rather than a list, so the distinction between "my own hook" and "invented a
contract class" stays checkable.
