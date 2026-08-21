---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A ring that does not change its mind while the finger holds still

Resting a finger on the outer part of an inner number put it exactly on the edge between the two
rings — and a hand is never still. Measured, a 6px wander changed the ring **four times**: each one
the hand jumping its own length and the face swapping which twelve numbers it picks from, several
times a second.

The edge is not wrong and moving it does not help: any edge has this, because a finger can rest on
any edge. *Where the rings divide* and *whether to change* are two questions, and one comparison was
answering both. What was missing is memory.

`timepickerDialRing` takes the ring it last answered — state every renderer already held and handed
to the two neighbouring functions on the next line — and leaving a ring now takes reaching **halfway
from the edge to the other ring's own numbers**, derived from where they are drawn rather than
picked. Without a previous ring, the first answer of a gesture, it falls through to the edge
unchanged, so ADR 0120's derivation still decides where the rings divide.

Asserted as four properties, and the fourth is the one a fix that simply refused to change ring would
fail: the rings still divide once across the radius, a wander at the edge changes nothing, no wander
of half a box changes the answer twice anywhere on the face, and a deliberate move from one ring to
the other still arrives — in exactly one change.

`timepickerDialUnavailableArcs` also answers for **every ring a face has** when asked without one,
and each arc carries its own `span` and `ring`. Three renderers were each deciding "does this face
have an inner ring", which is a question about the face.
