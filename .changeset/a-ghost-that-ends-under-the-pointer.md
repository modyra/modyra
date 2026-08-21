---
"@modyra/widgets": major
"@modyra/styles": patch
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A ghost that ends under the pointer, and the slices that carry nothing

The ghost had two lengths, chosen by which ring the pointer was over, so it snapped between them. Its
end is the whole of what it says — *this is where your finger is* — and a hand that stops somewhere
else is reporting a position nobody is at. It now reaches exactly as far as the pointer does, capped
at the hand's length because past that the face runs out and a longer hand would spill over its own
numbers.

**No floor.** A finger 15px from the centre gets a 15px stub, which looks like nothing much and is
exactly right.

`MdyTimepickerDialGhost` gains `reach`; the renderers write it as `--tp-ghost-reach` and the `--inner`
modifier stops applying to the ghost, since `reach` supersedes it for length. `timepickerDialGhost`
takes two more options — **breaking** for a caller passing the options object positionally, additive
for everyone else.

`timepickerDialUnavailableArcs` answers which stretches of a ring carry no time anybody can land on.
A face declared with `minuteStep: 15` draws four numbers, and the other 356° look exactly like them:
continuous, uniform, and offering nothing. The arcs are the positions the granularity **took away** —
the ones an undeclared face would draw and this one does not — each covered by the knob's own angular
half-width, with neighbours run together so a dead stretch reads as one.

Not the space between the numbers that remain. An hour face has visible gaps between its knobs and
every hour in it is selectable; the first version of this dimmed those and would have said a picker
was constrained when it was not.

Two widths, deliberately: snapping is still nearest-value, so every angle resolves to a number
including inside these arcs. What is dimmed is where you can land on **the number you are pointing
at**, which is the narrower question and a display one.
