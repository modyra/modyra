---
"@modyra/angular": patch
---

Five things a document asked for and the dynamic form dropped

`searchable` decides which control a select *is* — a native chooser or a combobox with a filter — and
the case never bound it, so a document asking for one got the other with nothing said. The component
has always read it; the template was the only link that dropped it.

Auditing the neighbouring cases with the same question — *what does a case not bind that its component
reads?* — found four more: a colour field's own `presets`, a file field's `accept` and `multiple`, and
both calendars' `minDate` and `maxDate`. Each parses, validates and reached no control.

Measured across the three renderers on one document: the select is a combobox everywhere, the file
input carries `accept=".pdf"` and `multiple`, and Angular's palette draws the colours the document
named.
