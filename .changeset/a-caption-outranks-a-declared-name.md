---
"@modyra/vue": patch
---

A caption outranks a name the document also declared

Six of these components let a declared `ariaLabel` silence the field's caption; two did not. The same
document therefore produced two different behaviours depending on which control it asked for, and
the comment sitting beside the expression said the intended rule — "the name it has **where nothing
captions it**" — while the code wrote the name whether or not something did.

Two names on one element is not two names: the computation takes `aria-labelledby` and stops, so the
`aria-label` beside it is text nobody hears, and where they disagree the one a developer is reading
in the source is the one that does not speak (ADR 0175). The rule now comes from
`fieldNameAttributes`, which Angular, Lit and Plain already ask, instead of from six copies of an
expression with one author each.

Measured as the resolved name, not as the markup, across all eight kinds:

| | captioned + declared name | declared name, nothing captions |
|---|---|---|
| before | six say the declared name, two the caption | the declared name |
| after | the caption, through `aria-labelledby` | the declared name, through `aria-label` |

The second column is asserted too: a repair that only ever answered "the caption" would have deleted
the feature rather than fixed it, since a control nothing captions still needs a name.

The colour field keeps its own branch, because its rule is a different one: where nothing captions it
the name comes from the message table rather than from the document, and that is a default the shared
door does not have.
