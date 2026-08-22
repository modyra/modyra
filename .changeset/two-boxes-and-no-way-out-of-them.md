---
"@modyra/widgets": minor
"@modyra/plain": patch
---

Two boxes and no way out of them

plain's date range trapped the keyboard. Tab anywhere in the field dismissed the popup, a dismissal
restores focus to the start input, and the popup did not have to be open for any of that — so every
Tab pulled the keyboard back where it began. Forty presses never reached the field below.

Two things were wrong and both are fixed where they belong:

- **A closed popup is not dismissed.** The handler now asks whether anything is open before acting,
  so Tab in a closed range is Tab.
- **`cancel` gains `restoreFocus`**, which is what tells Escape from Tab. Escape means *put me back
  where I was*, so focus returns to the opener. Tab is already carrying the keyboard onward, and
  taking it back is the trap the dismissal exists to avoid — which is what the keyboard table has
  said all along with `restoresFocus: false` on `Tab@open`.
