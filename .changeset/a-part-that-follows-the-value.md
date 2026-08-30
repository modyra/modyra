---
"@modyra/widgets": minor
---

Parts that follow the value say so, and the placeholder's condition was wrong

**`MdyPartPresence` gains `valueIsAbsent`.** A consumer switching exhaustively over the vocabulary
must handle it.

**`placeholder` was declared `documentDeclaresIt` and that was wrong.** The document supplying the
words is necessary and not sufficient: a placeholder is shown because the words exist *and* there is
nothing yet to show instead. A renderer following the old declaration would draw a placeholder beside
the value it stands in for. Correcting a wrong declaration is still a breaking change for anyone who
implemented it.

Seven more parts now say when they are there, and each was read out of a renderer's source and then
confirmed against a rendered page: `chip`, `chipRemove`, `chipMove` and `fileItem` exist per chosen
value; `value` is what a chosen value is shown as; `clearAll` and `clear` offer to take a value away
once there is one. 169 of 185 optional nodes carry a condition.

`chips`, `chipRow` and `fileList` are **not** among them, though the obvious reading says they should
be: they are containers built once and kept, and only their contents follow the value. Thirteen parts
stay silent — a spinner's buttons, a loading mark, an overflow count, an undo offer — because each
one's condition needs a reading their sources have not been given.

A new check holds the page to the declaration: for every part declared to follow the value, mount
with nothing and with something, and the part must appear on one side and not the other. It reads
presence as *shown* rather than as present in the DOM — this renderer builds a part once and hides
it, so counting nodes reports every one of these as always there, which is what two earlier probes
concluded before this existed.
