---
"@modyra/widgets": major
"@modyra/plain": minor
"@modyra/lit": major
"@modyra/vue": minor
"@modyra/angular": major
---

A control's supporting text and the reference that names it come from one answer

`supportingText` is declared on all seventeen kinds — `presentWhen: "documentDeclaresIt"` — and four
renderers gave four answers to whether one existed: one asked its host, one asked a slot, one asked
the field, and one answered `false`. Whether the element then held any words was decided separately
again. Measured against a document that declared some: angular said them on 16 kinds of 17, lit on 9
of 10 reachable, plain on 7 of 17, vue on none.

The projection now carries the words, and names the element holding them in `aria-describedby` only
when it has been given some. A renderer cannot point at an empty room, because the pointer and the
content are the same answer. `applyPart` writes a part's declared `content.text`, so a renderer that
already applies its parts draws the words without being changed at all — the mechanism was declared
and had no applier.

**Migration.** The question "is there a description" is replaced by "what does it say":

- widgets — field controller options take `supportingText: () => string | true | null` where they
  took `describes: () => boolean`; a11y projections take `supportingText: string | true | null`
  where they took `descriptionVisible: boolean`; `setDescribedBy` takes `supportingText` where it
  took `descriptionVisible`. `true` is for a renderer whose description is a template or a slot it
  cannot read — there are words, and the projection cannot carry them, so it emits the reference and
  leaves the content alone. `null` and `""` are the same answer: no words, so no reference.
- angular and lit — `setDescribedBy` changes shape, which is why both are major.

**A behaviour change that is the point, not a side effect.** A select used to name its description
whether or not anything was written there — the reference defaulted on. It now names it only when
there are words. A control with nothing under it describes itself by nothing.

This is one coherent unit across five packages rather than a batch of five, because the divergence
*is* the shared rule: repaired renderer by renderer, each repair would have been a fifth answer to
the question this deletes. Verified per consumer, both halves of the pair — a document with words
and one without.
