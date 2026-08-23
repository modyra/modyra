---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A quantity says where it is, and says so once per gesture.

Stepping a counter chip down was silent until the step that deleted the value: the sentence a
selection change produces compares the *distinct values* a field holds, and taking three of something
down to two changes none of them. So the only step that spoke was the destructive one, and a person
stepping down heard nothing until what they were counting was gone.

Two things had to be true of the repair, and they pull against each other:

- **A live region cannot be read on every step.** A held arrow key queues one polite sentence per
  press, played out after the person has let go — a backlog of values several steps in the past. A
  `spinbutton` does not have this problem because the platform reads a *value* and coalesces rapid
  changes itself; a control that gives up that role (ADR 0138) takes the coalescing on.
  `settledVoice` is that coalescing: it says the value a gesture ended on, and its schedule is
  injectable so a test can settle it without waiting.
- **The floor is announced on arrival, not on crossing.** `quantityAnnouncement` says
  `"Alfa, 1, minimum"` when a quantity *reaches* one, so the next step down is a known act. Warning at
  the moment of deletion is too late: the value is already gone and the person is being told rather
  than asked.

All three renderers announce identically, by keyboard and by pointer.
