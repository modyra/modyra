---
"@modyra/studio-ui": patch
---

A width says whether this size decided it, or inherited it

Setting a row to one column at `md` also changed `lg`. That is the mobile-first rule working —
a size that says nothing reads the nearest smaller one that does — but nothing on screen said so.
The control showed `1×` at `lg` exactly as it showed `1×` at `md`, so an inherited number was
indistinguishable from a decision, and there was no way to stop inheriting once you had started.

The columns-across control now leads with an **auto** option that names the number this size would
show anyway and where it comes from — `auto 1× from md` — and is selected whenever this size has
stated nothing. Picking a number states one for this size only. Picking `auto` takes the statement
back, which had no control at all before.

The distinction is carried by the option's own words rather than a shade: dimming it put the text
under the AA contrast ratio, and words are what a screen reader gets.

Reported as *"nel canvas non vedo per ogni breakpoint il layout che ho deciso"* — and it was true:
what you had decided and what you were merely inheriting looked the same.
