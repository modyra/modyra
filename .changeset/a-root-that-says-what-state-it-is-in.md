---
"@modyra/vue": patch
---

A widget root reflects its state, and a disabled field takes no keyboard that was not there

Two defects the equivalence suite found on its first run, each true of every kind this renderer draws.

The widget root carried the classes the contract declares and none of the states the shell reflects,
so `--touched` and `--open` never appeared. A theme keys off them: a field somebody has been in still
read as pristine, and a field with its panel up read as closed. Twelve components each wrote the root
class themselves; they now compose `shellStateClasses`, which answers which classes are on *and*
which are off, so a field that stops being open loses the class that said it was.

Separately, disabling a field pulled the keyboard into that widget's own root even when nobody was
standing there. `keepKeyboardInPlay` acts on "focus rests on nothing" only when told the blur was
its own, and this renderer asked after the render — when a widget nobody had reached is
indistinguishable from one the person was just blurred out of. Whether the widget held the keyboard
is now sampled before the change, while it is still there to read.

Measured on a page with a neighbour, the second repair leaves the good case exactly as it was: focus
still moves to the next field when the one under the person goes out of play.
