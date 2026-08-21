---
"@modyra/widgets": major
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

A chip that holds a quantity is a spinbutton

In counter mode a multiselect chip holds a number that arrows change, which is what
`role="spinbutton"` describes. It now carries the role, `aria-valuenow`, `aria-valuemin` and an
`aria-valuetext` that reads the label with the count — so the value is announced when it changes
rather than only when the chip is entered, and `ArrowUp`/`ArrowDown` do on the chip what the role
promises. Outside counter mode the chip holds controls and no value, so it stays `role="group"`.

**A key can now be scoped to a part.** `MdyKeyBinding` gains `on?: string`, and `keyBindingFor` takes
the part asking:

```ts
keyBindingFor("multiselect", "ArrowDown", open);          // the control: opens the popup
keyBindingFor("multiselect", "ArrowDown", open, "chip");  // a chip: steps the quantity
```

The table could previously only answer per kind and state, so one key meaning two things by position
was decided by whichever binding was declared first. Every chip binding — the arrows, `Home`, `End`,
`Backspace`, `Delete` and `Alt`+arrows — now says `on: "chip"`, and a renderer that asks as the chip
and gets nothing back lets the key reach the control, which is how `ArrowDown` still opens the popup
from the trigger.

**A contract variant can declare roles.** `MdyWidgetVariant` gains `roles`, alongside `elements` and
`required`, so `multiselect`'s `multi` variant states the chip's spinbutton role where the base
contract states `group`. `satisfiesSemanticElement` takes the declared role into account, so a
renderer emitting the variant's role is conformant rather than caught by a mirrored list in a test.

- **`multiselect.chip` and `multiselect.options` declare roles** (`group` for both) where they
  declared none. A third-party renderer that emits neither now fails the DOM contract.
- **`scrollChipStripByWheel` is exported** — the strip's wheel behaviour under ADR 0127, which all
  three renderers had written out identically.
- Angular's dynamic form forwards `mode`, which it was dropping: a document declaring a counter
  multiselect got a toggle one.
