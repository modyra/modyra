---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
---

Where the keyboard stands when a list opens

A multiselect panel opened with nothing singled out, so the first arrow press was spent picking a
starting point — showing nothing, and indistinguishable by ear from an arrow that did not work — and
the key meaning "choose this one" had no target, which two renderers answered from the trigger
instead.

The cursor is now primed when the panel is raised from the keyboard: on the first value already
chosen, and on the first option on screen when nothing is chosen. Raised by a pointer it stays empty,
because the next thing is a click and a cursor would draw a ring on an option nobody touched.

`open` and `toggleOpen` carry the modality as an optional `by`, and `MdyOpenModality` is exported.
A caller that says nothing keeps today's behaviour exactly — a panel that opens with nothing singled
out — so the change is additive, but silence is the pointer answer rather than a neutral one: a host
that opens from a key should say so. See ADR 0179.
