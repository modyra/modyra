---
"@modyra/lit": patch
---

An element nobody bound says so

A Lit form is whatever a consumer writes: an element is registered once and bound by setting
`.field`. Forgetting one — a renamed handle, a branch that never assigns, a template that binds four
of five — produced an empty custom element and nothing else. No control, not even the `label` it was
given, and nothing on the console: a gap in the layout with no word anywhere to search for, in a
library that throws a sentence for a bad widget id and refuses a bad field name by name.

An element that painted with no handle now says so once, naming its tag and its label.

It is a warning and not a refusal, because throwing would reject the create-append-bind order every
host writes. It is asked three frames after connecting rather than immediately, so a host that
appends and binds on the next frame is never told it did something wrong. The element still paints
nothing: what was missing was the sentence, not the markup.
