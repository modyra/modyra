---
"@modyra/vue": patch
---

A native form submit carries each Vue field's value under the field's path

A `<form>` holding a Vue select, multiselect, radio, segmented or colors field now sends the value
the field holds under `field.path`, as the other renderers do and as `submissionFor` declares:

- **select** and **multiselect** send the held value from hidden inputs, one per selected value in
  order for a multiselect. Both previously sent nothing in the custom shape; the native `<select>`
  sent the option key under the scoped widget id, and it no longer carries a `name`.
- **radio** and **segmented** share the field's path as their `name` inside a form, so the checked
  option arrives under the path rather than under the scoped widget id. Outside every form the set
  still groups by the scoped id.
- **colors** sends from the hex box; the native picker is unnamed, so the colour is sent once.

A disabled field sends nothing, and a value set from outside the field is the value that is sent.

**Migration.** A server that read a radio, segmented or native select field under its
scoped widget id reads it under the field's path instead.

**Not changed.** A date range sends `<path>.start` and `<path>.end` from its two boxes, which show the
date in the reader's locale, so the values are the localized text rather than ISO dates. That is the
shared contract's shape for this kind in every renderer, and is not changed here.
