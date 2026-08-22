---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
---

Somewhere to stand when a field leaves play

Disabling a focused element blurs it — that is the platform. What followed was this library's: the
person who was typing landed on `body`, their next Tab starting at the top of the document, with
nothing said about where they went. It is reachable without anybody clicking: a document's rule takes
a field out of play when another field changes, so a value arriving from a fetch can empty the
keyboard's position mid-word.

Read-only is the proof that it need not cost them their place — a read-only field keeps the keyboard —
so `keepKeyboardInPlay` puts a disabled one somewhere too: the next thing that can take focus after
it, the previous one otherwise, and the widget's own root as the last resort, so the next Tab starts
from where they were rather than from the top of the page.

The two renderers ask at the moment each can: plain before it takes the control out of play, lit when
the focus leaves with `relatedTarget` null — which is the platform taking it rather than a person
moving it, and the one case worth acting on.
