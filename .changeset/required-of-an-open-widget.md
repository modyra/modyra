---
"@modyra/widgets": minor
"@modyra/angular": patch
---

A part inside the overlay can be required, and is required *of an open widget*.

`inspectWidgetDom` takes `open`. A part that only exists inside the popup cannot be demanded of a
closed widget, so until now such a part had to be optional — which meant nothing checked it at all.
Left unset the option demands nothing, so every existing resting suite is unchanged.

With that, `calendar` becomes a required part of both pickers. All three renderers draw one and two
themes lay it out, and it was optional only because the contract had no way to say "required once
this is showing".

Angular gains the open-state conformance run its siblings have, and a reach ratchet beside it: 40 of
the 45 parts that exist only while open are rendered by an open widget there, and a renderer that
quietly stops drawing part of its popup now fails on the count rather than passing a conformance run
performed on a smaller subject.
