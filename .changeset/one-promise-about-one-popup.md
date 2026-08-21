---
"@modyra/angular": patch
---

One promise about one popup, read from the catalogue

Angular wrote `aria-haspopup` as a literal at ten openers, and two of them disagreed with the
contract and with the other renderers: the datepicker promised a `dialog` where the catalogue and
plain both say `grid`, and the colours field promised a `dialog` from one button and a `listbox` from
the button beside it — over the same popup. The attribute is announced with the control, before
anything has opened, so a person acts on a word that was chosen by whoever typed that line.

Every opener now takes the projection `projectOverlayOpenerA11y` already returns, through the
`mdyPart` directive that most of them were already carrying. Three shapes, because ARIA allows three
different things:

- **The control that holds the value** takes the whole projection, role included.
- **A button that only opens the popup** takes the same projection without the role — a combobox is
  the element holding the value, and an icon button is not one.
- **A range's two text inputs** take the promise alone. They open the calendar with `ArrowDown`, and
  `aria-haspopup` is a statement a textbox may make; `aria-expanded` and `aria-controls` are not, and
  adding them is a critical `aria-allowed-attr` violation.

`MdyDatePickerComponent` also declared no `widgetKind` and so inherited `"text"`, which is what let
its opener promise nothing at all once the promise was read from the kind.
