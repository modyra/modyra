---
"@modyra/widgets": major
---

The textarea says which element it is

`control` defaulted to the `input` semantic, which admits `<input>`, `<textarea>` and `<select>`.
For most kinds that is the right width — they do not care which of the three a renderer reaches for.
For the one kind named after its element it is a statement that is true and answers nothing: a
generator reading it learns "a native form control" and still has to guess between three tags.

The semantic vocabulary gains `textarea` and the kind declares it. `controlType` could not carry this
— that element takes no `type`, and giving the field a second meaning would make it a sentence rather
than a token, which is the shape this cycle has spent its time removing.

**Why major, measured rather than argued.** With the old declaration, a run where the part rendered
as an `<input>` was CONFORMANT: the statement could not be contradicted, so no check could fail.
With the new one, a part declared `textarea` that renders anything else is refused. That is a
narrowing of what satisfies the contract, and an adapter written against the looser statement is
entitled to notice. `MdyWidgetSemanticElement` also gains a member, which breaks an exhaustive switch
over it in the same way a new key intent does.

Both tools classify it `major` and agree, which is worth recording: on the previous three contract
changes they disagreed in one direction or the other.

Alongside it, a check that would have caught the defect that led here. A part rendering an operable
control — input, button, select, textarea — is refused when its declared semantic is one of the four
that admit every element. Those four exist for the arrows, ticks and dial hands; on a control they
are not a loose claim but the absence of one, and nothing could disagree with them. The rule asks the
table which semantics admit everything rather than naming one, so a fifth added later inherits it
instead of slipping under it, and it skips parts a variant declares — `presentation` on a varianted
part is the contract saying "the variant decides", not saying nothing.
