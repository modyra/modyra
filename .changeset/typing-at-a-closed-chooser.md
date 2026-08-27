---
"@modyra/widgets": minor
---

Type-ahead answers at a closed single-choice control, and the differ learns what widening is

Declaring type-ahead yesterday restricted it to the open phase, on the reasoning that a character
typed at a closed control opens nothing and is the platform's business. That was wrong about the
platform: every native chooser moves to the option beginning with that letter *without opening*, and
the framework-free renderer does the same. The binding said a gesture was not owed at a control that
has always offered it.

It now answers in both phases where **one** choice is held. Where several are, there is no "the"
choice for a letter to move and the strip has its own use for keys, so it stays open-only until
something measures otherwise.

**And `contract:diff` gained the distinction the change exposed.** Dropping a phase from a binding
*widens* it — a key that answered only while open now answers always, and nobody relying on the open
behaviour loses anything. Compared as strings that read as one binding removed and another added: a
major for a change that takes nothing away. The tool was right that the old spelling is gone and
wrong about what a consumer can survive, and that disagreement is worth more than either verdict.
Narrowing a binding to one phase is still major.
