---
"@modyra/widgets": patch
"@modyra/plain": patch
---

Two defects the invalid state exposed, both found by comparing renderers rather than by reading them.

**An error list nothing pointed at.** Five field projections spelled the error list's id
`${widgetId}__error` while the shell — and the catalogue, where the part is named `errors` — spells
it `${widgetId}__errors`. One letter. Wherever the two halves of a reference came from different
sources, `aria-describedby` named an id that did not exist: a radio group's errors reached no
assistive technology at all, in the one state where that is the whole point. All five now use the
part's name.

**Two kinds that never said they were touched.** `select` and `radio`/`segmented` never called the
field shell's `syncState`, so their roots carried no `mdy-renderer--touched` and their wrappers no
error modifier — the treatments three themes key off. Every other kind in that renderer either called
it or set the class directly.

With both fixed, the invalid state now produces the same canonical observation on both renderers
across the kinds measured: the error list present, `aria-describedby` resolving to it, and the root
reflecting `touched`.
