---
"@modyra/styles": patch
"@modyra/angular": patch
---

Two arrows that pointed the same way, and a description nothing named.

**The arrows.** A chip's two move controls are drawn from one mask, and the rule giving the later one
its own direction was `.mdy-chip__move:last-of-type`. `:last-of-type` counts buttons, and the last
button in a chip is the one that removes it — so the rule never matched and both arrows pointed left.
The names were right, so a screen reader could tell the two apart and an eye could not. The general
sibling combinator asks what the rule meant: is there a move control before this one.

**The description.** `@modyra/angular`'s multiselect writes how many values are chosen into its
supporting text, and the base withholds that element's id unless a *consumer* supplied words — so the
sentence was on the page and `aria-describedby` named nothing. A person who could not see the chips
was told the field's name and nothing about what it holds, with the text saying so one element away.
The kind names its own description now, as the other two renderers do.
