---
"@modyra/styles": patch
---

The themes carried the same orphaned rules

The foundation's state rules were repaired when a boolean's drawn part moved inside its label; the
themes restate some of the same rules in their own idiom and were not. Six survived in three files —
`modyra-material.css`, `modyra-ios.css` and `modyra-ionic.css` — plus one in the foundation itself,
which had escaped because it was the **first line of a two-line selector list** and only the second
line was rewritten.

That last one is worth naming: a toggle answered a keyboard focus and did not answer a pointer
resting on it, because `:focus-visible` and `:hover` sat in one rule and one of them was fixed.

All seven now ask the wrapper with `:has()`, the way the foundation already did elsewhere.

`state-rules-reach-their-part.test.mjs` now reads every sheet rather than the foundation alone, and
covers `radio` beside the two booleans. It records one rule it cannot reach —
`.mdy-radio-group--horizontal` — because this renderer has no `layout` input and never emits that
class, where Angular and Lit do. The exemption is asserted in both directions, so a renderer that
grows the variant fails until the exemption is removed.

Two of the seven are **repaired by pattern and not measured anywhere.** The checkbox
`:focus-visible` rules in `modyra-ios.css` and `modyra-ionic.css` need a pointer or a keyboard focus,
which jsdom cannot produce, and the browser tier builds and links the foundation sheet alone — so no
tier loads a theme at all. They were changed because they carried the same orphaned combinator as
the five that were measured, which is a good reason and not evidence.
