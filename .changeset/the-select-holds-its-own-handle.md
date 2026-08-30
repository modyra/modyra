---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
---

The select reads its field instead of being told about it — and empty stops meaning wrong

**Breaking: `createSelectFieldController` no longer reports `invalid` for a required field nobody has
touched**, and its interface gains `setDescribedBy`, `setOpen` and `setPopupRendered`.

`createSelectFieldController` was written to close a split — the select was the one kind driven by
imperative setters where every other kind takes a field handle and reads it — and then nobody adopted
it. Two reasons, and neither was effort:

**It forwarded none of the three facts only a renderer has.** Which of the two texts under the field
is on screen; whether the panel is up; whether the panel's contents are in the document at all, since
a renderer that builds them on open has nothing for `aria-controls` to name while closed. A renderer
that adopted it lost all three.

**It carried the older verdict rule.** It reported `invalid` from `showsAsInvalid` — true the moment a
required field is drawn empty — and a renderer that had adopted that rule by hand *overwrote it*, with
a comment saying why. The override winning was the only thing keeping that renderer's answer right.

Asked outside the repository: `aria-invalid` is a verdict on an act, not a state. A field that is
empty and never touched contains nothing; `required` is the word for what is missing, and a screen
reader already says it. On a long form, twenty required fields announcing themselves invalid to
somebody tabbing through to learn what the form asks spends the word before the first real error. But
a value that arrived already wrong — from a draft, from a server — speaks at once, touched or not,
because a draft nobody is told about is a draft that gets resent.

Both are `visibleErrorsOf`, so it is one call rather than two rules. `showsAsInvalid` remains what it
is — whether the form would refuse this field — and is still exported. See ADR 0165.

Two checks asserted the old answer and were changed with their reasons recorded. One is a mutation
spec whose `correct` value **is** the declared right answer, so changing it is the decision taking
effect rather than a test being made to pass.

Adoption goes from 46 of 51 renderer/kind pairs to 48. The three that remain are Angular's, whose
value pipeline is its own question.
