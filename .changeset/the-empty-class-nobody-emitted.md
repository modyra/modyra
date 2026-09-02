---
"@modyra/widgets": major
---

The select's empty state is named what every renderer already emits

The catalogue declared `select.empty` as `mdy-select__empty`. Nothing emitted it. Lit and Angular
both render `mdy-select__no-results`, all three themes style `.mdy-select__no-results`, and Plain
draws no empty state at all — so the declared class had zero emitters from the day it was written
and zero rules pointing at it.

It is now `mdy-select__no-results`: what ships wins, because anybody who wrote CSS by looking at the
page wrote that, and nobody can have depended on a class no renderer ever produced.

`contract:diff` calls this major, and it is right for the question it asks — a declared class left
the contract. The migration is the part it cannot see: **if you styled `mdy-select__empty`, that rule
has never matched anything.** Point it at `mdy-select__no-results` and it starts working.

Found by rewiring a renderer to ask the catalogue for its class names instead of restating them:
substituting the declared class for the literal would have changed what Lit emits and stripped the
empty state's styling in all three themes. A name spelled in two places is a name that can disagree
with itself, and this one had.
