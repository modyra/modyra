---
"@modyra/widgets": patch
"@modyra/angular": patch
"@modyra/lit": patch
"@modyra/plain": patch
---

The 24-hour face really shows twenty-four hours, and the keyboard can be reached

Three things stood between the previous change and it working, and only one of them was the change.

**A component stylesheet was quietly overruling the foundation.**
`timepicker-renderer.component.scss` carried its own copy of `.mdy-timepicker-dial__number` —
byte-for-byte the foundation's rule, transform included. Component styles are
emulated-encapsulation, so they wear an attribute selector and outrank the foundation wherever the
two speak: the inner ring drew at the *outer* radius and every second hour sat on top of a first
one. Twenty-four numbers were there all along, twelve of them hidden behind the others. Removed —
the foundation said the same thing — and measured after: outer radius 100, inner 60.

**Nothing gave the dial focus.** The face has been focusable since it became a slider, but
`restoreOverlayTriggerFocus` runs on *close*, so opening the picker left focus on the toggle and the
first arrow went to the page. The dial takes focus when the picker opens on it, and when a user
switches to it from the number boxes.

Focusing on open is not enough on its own, so **the arrows now work from anywhere in the clock** —
except a text input, because the hour and minute boxes have their own arrow handling and taking their
keys would make them impossible to correct. The difference matters: reach for Confirm to commit and
the arrows would otherwise go dead. The handler lives on the clock root, not on the face as well;
left on both, a keydown on the face would bubble and turn the hand twice.

**And the mark could land on the wrong hour.** `timepickerSelectedDialValue` still answered the
12-hour hour while the face offered 0–23, so at 14:00 Lit and plain marked `2`. It takes the format
now and answers in the units the face shows — the same rule that decides which numbers are on it,
because the numbers and the mark disagreeing is only a matter of time otherwise. Tested for every
hour of the day, and for midnight and noon, which is where an off-by-twelve hides.

The demo test compares the two pickers against each other rather than against remembered numbers,
and it scopes to the picker it opened: a closed overlay panel is `visibility: hidden`, which still
has a box, so "the first face with a height" finds the picker nobody opened. That mistake cost two
measurements before it was noticed.
