---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

`beginChipReorder` — one gesture instead of three, down to the six pixels

The drag that reorders a chip strip was written out identically wherever a strip is drawn: the same
threshold, the same dragging class, the same document-level listeners, the same swallowed click, the
same midpoint measurement. The renderer still binds the press its own way — that part belongs to a
framework — and everything between the press and the drop is now one function.

Three details decide whether it works, and each was one every renderer had to get right unaided:

- **the threshold.** A drag may start anywhere on a chip, its own buttons included: they cover most
  of it, and a chip draggable only by its bare edges is a chip nobody can drag. Travel is what
  separates a press that belongs to the button from one that belongs to the strip.
- **the swallowed click.** A press that began on a button and ended as a gesture still produces a
  click nobody asked for. Taken once, in the capture phase, and only after an actual drag — the next
  real press on that button has to still work.
- **no pointer capture.** Capturing follows the gesture just as far and retargets every later pointer
  event, the one that becomes a `click` included, so the chip's own buttons stop receiving clicks
  entirely: found, pressed, nothing happens.

`MDY_CHIP_DRAG_THRESHOLD` is published because it is the number that decides whether those buttons
still work. Too small and a steady finger reorders the strip instead of pressing what it is on; too
large and a drag has to be exaggerated before anything moves.

The check reads the dragging class **during** the gesture, not after. Afterwards the teardown has
taken it off either way, so a check that only looks at the end cannot tell a press that was never a
drag from one that was — which is exactly the mutation that survived the first version.
