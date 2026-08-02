---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/angular": patch
---

The select's keyboard contract is complete, consumed, and proven by real key presses.

`selectKeyboardAction` was missing two of the behaviours the contract itself describes, and one
renderer of three was using it at all.

- **`ArrowDown` on a closed list opens it.** It returned `move`, an action on options nobody can see.
- **`Tab` closes the list and lets focus carry on**, with `restoreFocus: false` — a list left open
  follows the user to the next field, and focus pulled back traps them in the one they just left.
  `restoreFocus` is no longer typed as always-`true`, because Escape and Tab want opposite answers.
- **`@modyra/plain` consumed none of it**, handling keys with a switch of its own that disagreed with
  the contract on exactly those two keys. It now dispatches the contract's action.
- **`@modyra/angular` cancelled `Tab`'s native meaning**, so focus stayed inside a panel being torn
  down and the overlay's focus rescue pulled the user back into the field they were leaving. Found by
  pressing the key in a browser, which is the only place that question can be asked.
- Angular also opened the list on a `move` it could not perform — a renderer covering for the policy,
  which is the pattern this milestone exists to remove. Gone.

Six behaviours now run against a real browser: what opens, what does not, where focus goes when the
list opens, where it goes on Escape, and where it goes on Tab. The policy stays a pure function with
its own unit test; the browser proves that pressing the key does what the policy says.
