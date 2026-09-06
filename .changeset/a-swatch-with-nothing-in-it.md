---
"@modyra/plain": patch
"@modyra/lit": patch
---

The colour swatch shows the colour the contract names

`MdyPartContent.color` is the contract's answer for what a part displays, and the colours field
publishes it — the held value, or the colour declared for an empty field. One renderer read it. On the
single control whose whole job is to show a colour, the four produced **three** answers for a field
holding nothing:

    plain      background-color: transparent
    lit        background-color:            (nothing after the colon)
    vue        the declared colour
    angular    the declared colour

Lit's was a copied literal behind a `??`, which does not fire on the empty string a cleared field
holds — so the declaration came out malformed rather than merely different, and the two renderers
that agreed did so by each having copied the same hex.

Plain and lit now read `content.color`. **Where** it is painted stays each renderer's own — the
contract says the renderer paints it and DESIGN.md says where — so nothing about the property moved;
what the swatch shows is no longer decided four times.

The custodian asserts both states, and asserts the empty one as `""` and `null` separately: the empty
string is what a cleared field actually holds and the one a nullish check misses. Planting `??` back
in place of `||` reproduces the renderers' defect exactly, and it goes red.
