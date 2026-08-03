---
"@modyra/widgets": major
---

A popup must frame something.

Four of the six overlay kinds declared no required part inside their popup, so an open widget could
render a positioning box with nothing in it and conform. `aria-expanded="true"` beside an empty popup
was a coherent-looking, broken widget.

No new declaration was added for this. `required` already said "this part must be there" and
`overlayOnlyParts` already scoped it to an open widget — the mechanism `datepicker` used for its
calendar — so four names joined four existing lists:

| kind | now requires |
| --- | --- |
| `select` | `listbox` |
| `multiselect` | `listbox` |
| `timepicker` | `container` |
| `colors` | `presets` |

Each was measured in both rendering adapters first: every one is drawn by Plain and by Lit today, so
no renderer needs new markup. `multiselect.listbox` is required to be **present**, not to be a
listbox — what role a chip grid should carry is the mode question ADR 0015 settles.

**Migration:** an adapter whose open popup omits its kind's part above now reports `PART_MISSING`.
The fix is to render it, which is what the popup is for.

**The conformance CLI gained a second anatomy pass.** It inspected every widget at rest only, and a
part required inside a popup is skipped at rest — so all four requirements would have been enforced
against nothing. `modyra-conformance` now drives each overlay kind open and inspects it there, six
kinds per adapter. An adapter passing the previous version can fail this one for a defect that was
always there.

`timepicker.dialog` stays optional and is now recorded as a defect: no adapter draws the element the
contract describes. Plain applies the part to the popup itself, Lit puts `role="dialog"` on
`container`. Where that role belongs is a separate question, open in `docs/contract-gaps.md`.

The decision behind this is [ADR 0014](https://github.com/modyra/modyra/blob/main/docs/architecture/0014-the-contract-names-the-responsible-element.md): the contract names the element responsible for something, not the region containing it.
