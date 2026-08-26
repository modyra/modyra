---
"@modyra/lit": patch
---

A select's reading position is drawn where it actually is

Moving through an open searchable select changed nothing on the page: the class lighting the option
under the cursor and the attribute naming that option are both products of a render, and only opening
the list and typing into it ever asked for one. What reads the cursor live — the key that commits —
kept working, so the right value arrived while both reports stood on the first option.

It struck both audiences at once. A person watching saw the same row lit at every press; a person
listening was told the same option while the selection travelled past the others, and then confirmed a
value they were never told they had reached.

Invisible to anything that checks the value, because the value was right. It exists only where the two
reports of one fact are compared with each other.
