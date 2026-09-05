---
"@modyra/widgets": minor
"@modyra/vue": patch
---

A part that shows something is told what, by the contract. ADR 0207.

The catalogue declared what a widget is made of and said nothing about what a part *displays* — so
every renderer invented it. `"Select file"` written into a lit template and again into a plain
renderer; a `#4361ee` fallback chosen twice, independently; and the renderer that delegated those
parts to a walk over the declared structure drew them **empty**, because a walk knows the shape and
nothing else.

A projected part may now carry content, in a vocabulary with exactly two members — `text` and
`color`. A renderer translates mechanically: text becomes the part's text, a colour becomes what
DESIGN.md says a colour is. It does not decide *what*.

**Closed on purpose.** A free channel — a string a renderer interprets, or a style bag — would be a
surface with no letter of intent, and no check could say what was meant by it. Closed, a third kind of
content is a change to a published type, classified by both instruments, rather than something a
renderer adds on its own. `color` rather than `swatch` because `swatch` already names a part in the
colours catalogue, and one word should not mean an element in one place and a value in another.

The slider's readout, the file field's prompt and its clear mark, and the colour swatch are projected
now; `@modyra/vue` reads them. `@modyra/lit`, `@modyra/plain` and `@modyra/angular` still write those
few strings themselves — each a small mechanical adoption rather than a decision, and stated as
unfinished rather than implied complete.
