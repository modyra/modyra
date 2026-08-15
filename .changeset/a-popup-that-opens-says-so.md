---
"@modyra/widgets": major
"@modyra/plain": minor
"@modyra/lit": minor
---

A popup that opens says so

`overlayLifecycleTransition` answers `announce: "opened" | "closed" | null` for every open and close,
and the words are published in five message tables. `@modyra/angular` read the field; `@modyra/plain`
and `@modyra/lit` read neither. In a page: the datepicker opens, `aria-expanded` becomes `"true"`, and
no live region receives anything. `aria-expanded` answers someone who asks the control — a popup drawn
in the top layer is exactly the case where nobody who was not asking is told it appeared.

Both renderers now announce where they show and hide the popup, in the element's own language, once
per edge. Neither announces during teardown: an element being disposed is not a popup a person closed.

**`setOverlayOpen` returns `boolean`** — whether this call is the moment the popup opened or closed —
so a renderer that reflects its open state on every render can tell a change from a repaint. The first
call for a popup is its initialisation and answers `false`. A caller ignoring the result is unaffected;
anything implementing that signature now returns the flag.

`MDY_SHARED_REGION_ATTRIBUTE` marks the renderer-wide live region. One region serves every widget and
has to outlive all of them — created and removed around a message, it is a region the screen reader
was not watching when the text arrived — so `inspectUnmount` no longer counts it as an element an
instance left behind.

`MdyFieldElement.messages` is public in `@modyra/lit`: the overlay controller speaks for the element
and reads the element's table rather than resolving a second one.
