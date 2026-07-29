---
"@modyra/core": minor
"@modyra/widgets": patch
"@modyra/plain": minor
"@modyra/angular": minor
"@modyra/studio-contract": patch
"@modyra/studio-ui": patch
---

A placement belongs to a column, and now says so everywhere

Contract v3 shipped a gap: a slot's `at` parsed anywhere a slot could appear, but only a column could
act on it. A slot in a section was accepted and then silently ignored by every renderer — the exact
failure the strict parser exists to prevent.

**Placement is now refused where it cannot be honoured.** `at` is valid only inside a `columns` row,
including for a section at the top of a layout, which occupies no column. A slot with no `at` is
still a field name written longhand and is fine anywhere.

**And it is now possible where it was needed.** A group compiles to a section, so a group in a row
could be moved and hidden per size in Studio and the compiler dropped both without a word. A section
occupying a column carries the same `at` a slot does, read by the same code in both renderers — the
column is the element either way. Studio's group box gains the controls its fields already had:
left/right, columns-across, and the eye.

Also closed, all of them ways the same feature could be silently lost:

- A `column` past a row's tracks — what a row narrowing under it leaves behind — is trimmed at
  compile time. It used to reach the parser, be refused, and take the whole layout down with it.
- The compiled version is read off the finished layout rather than tracked while building it, so a
  document cannot claim v3 for a placement that was trimmed away after the slot carrying it was
  emitted.
- `layoutNodeAttributes` reads only numbers from `at`. Row counts and slot placements share the key
  across the layout union, and a placement reaching it became `NaN` tracks.
- A group in a column laid its legend out on one unwrapped line: a dozen controls, 267px of them in a
  135px column, overflowing onto the column beside it where they took the clicks meant for its
  buttons. The action bar now folds inside its own column — scoped there deliberately, since at full
  width it fits on one line and folding it would only make every row taller.
