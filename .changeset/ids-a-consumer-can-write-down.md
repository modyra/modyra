---
"@modyra/angular": patch
"@modyra/widgets": patch
---

Angular's select publishes the ids the contract spells

A published id is `<widget>__<part>__<key>`, and this renderer minted `pick-opt-0` from the option's
*position* while the other two spelled the contract's form — so a consumer reading the published
format and writing a selector reached two renderers and missed the third, and an id moved when the
list was filtered rather than naming the same option throughout. The trigger published the bare field
id where the others publish `__trigger`.

Both now come from the id factory, and from *this* control's current widget id rather than the
adapter's: the adapter is constructed once and holds the id the control had at that moment, which is
the mount id — so its view spelled `mdy-control-0__option__…` while every id computed later in the
same component spelled `pick__…`. An id is a function of the document (ADR 0135).

The keyboard policy's comment is corrected too: it said a list opens with nothing active, which is
neither what the controller does nor what the authoring practices describe, and it nearly bought a
repair that made `Enter` straight after opening choose nothing.
