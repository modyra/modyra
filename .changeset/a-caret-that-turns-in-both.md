---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
"@modyra/styles": patch
---

One caret, one meaning, both kinds

The multiselect's caret pointed the same way whether its list was open or shut, while the
single-choice list's turned. The catalogue declared `open` on one kind's `arrow` part and not on the
other's, so nothing was inconsistent enough to fail: each contract agreed with itself.

`multiselect.arrow` now declares `open`, and the three renderers write the modifier the same way the
select's do — derived from the part's own class rather than spelled out, so a rename in the catalogue
moves the rule and the renderer together.

**The two carets were also different shapes.** The select drew `CHEVRON_DOWN` from the icon table
while the multiselect left its box empty for the stylesheet's fallback square. Both now draw the same
icon; the fallback stays for a host that ships no icons, which is what it is for.
