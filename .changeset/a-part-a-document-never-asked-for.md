---
"@modyra/widgets": minor
---

A part can say what the page had to ask for before it is owed at all

`presentWhen` says when a part is on the page. It cannot say whether the question applies: a
multiselect's reorder grip is present when there is a value **and** only where a document asked for
reordering, which is not a state the widget is in — it is something the page decided before the
widget existed.

Read without that, the contract owed a drag handle to every multiselect holding a value. All three
renderers drew it only where reordering was asked for, which is right and was a rule none of them
could point at.

Three adapters agreeing against a declaration is the evidence that the declaration is what is wrong.
One adapter disagreeing would be a renderer defect; three is the contract saying something nobody
follows, and a rule nobody follows is a rule that has already stopped being one.

`MDY_PART_REQUIRES` carries the precondition per part, beside the presence table and derived the same
way. It uses `requires` — the word a key binding already uses to gate a gesture on the same fact —
because one vocabulary for one idea is what keeps a reader from checking whether two spellings differ.

Checked in three directions: the precondition reaches every kind that draws the part, it names a
capability that kind's own keyboard already gates on, and — the perimeter — the contract does not
become mostly conditional on what a page asked for, which would say very little about what a renderer
owes.
