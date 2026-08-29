---
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

Each renderer declares the select shapes it draws

ADR 0176 gave the select two anatomies; this is what makes them measured. Every conformance config
now says which shapes its renderer draws, and mounts one run per shape: lit and Angular hand a
non-filtering select to the platform and draw the combobox when it filters, so they declare both;
Plain draws the combobox whichever way the field is configured, so it declares one.

That is the answer to six findings that read as cross-renderer divergences. They were one renderer
supporting one shape and two supporting two, which nothing in the suite could say before — and
"repairing" any of them would have meant giving a native `<select>` combobox attributes it must not
have.
