---
"@modyra/widgets": minor
"@modyra/angular": patch
---

No renderer diverges from the contract, on any adapter

The four divergences Angular still recorded are resolved, and two of them were resolved by fixing the
contract rather than the renderer.

- The multiselect's label pointed at an id no element carried — a broken reference, not a difference
  of opinion. Its search button carries that id now. The label also sat inside the input wrapper
  where the contract declares the two as siblings, and is a sibling now.
- `nativePicker` required a `<label>` wrapping the native colour input, because the contract was read
  off one renderer. The other deliberately un-nested that input: a focusable control inside a
  focusable control is nested-interactive. Requiring the first pattern mandated the weaker of the
  two, so the contract now admits either and no longer says where the native input sits.
- The pickers' openers carried no relation. They bind it now, and the relation declares the
  `combobox` role it needs: `aria-expanded` and `aria-controls` are only allowed on a typeable
  control once it says it is a combobox, which axe caught the moment the attributes appeared without
  it.

The timepicker's relation names its popup rather than a dialog, because a renderer whose panel is not
modal has no dialog to name.
