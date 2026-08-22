---
"@modyra/lit": patch
---

An id nobody else publishes

lit's datepicker calendar carried an id no projection emits and no other renderer draws — added while
chasing a dialog the page could not point at, and left where it did not belong. ADR 0134 is the rule
it broke: where the projection emits an id, the renderer applies it; where it does not, no renderer
invents one. The timepicker's dialog id stays, because that one is the projection's.
