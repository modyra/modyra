---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/styles": minor
---

A closed multiselect shows what was chosen, not everything on offer

The field drew its whole option list inline, so three options ate 148–209px of a control and thirty
would have eaten ten times that. The closed control now shows the **chips for what was chosen**, in one
line that scrolls, inside the control a person presses; the options are seen in the popup, where there
is room for them.

**The anatomy, and what moved.**

```
inputWrapper                the field's box, carrying its state classes
└── trigger                 what a person presses; role="combobox"; the label names it
    ├── chips               what was chosen, in the value's own order
    │   └── chip            a container: label, count, remove — and the two steppers in counter mode
    ├── placeholder         when nothing is chosen
    └── arrow               the trailing affordance, decorative
popup
└── options                 the options, in one place
```

- **`searchButton` is removed.** The magnifier is gone and the control opens the popup, so
  `MDY_POPUP_OPENERS.multiselect.opener` is `"trigger"` and `role="combobox"` moves with it — a
  button that holds no value should never have carried the role that says it does. A consumer
  selecting `.mdy-multiselect__search-btn` selects `.mdy-multiselect__trigger` now.
- **`listbox` is removed.** It existed to name the popup's copy of a grid the field also drew. With
  one grid there is one part, and two names for it could only disagree.
- **`options` moved into the popup**, so a renderer that keeps an inline copy fails the DOM contract
  rather than being caught by a test. Angular was drawing both, every option twice.
- **`chip` is a container**, not a button, because it holds controls. `chipRemove` is new. A repeated
  value is a **quantity** — `increment` takes `["a"]` to `["a","a","a"]` — so one chip per distinct
  value carries the count and the steppers, and undoing one decision is one gesture rather than three.
  `.mdy-chip--counter` remains styled and emitted by nobody under the scroll decision.
- **`readonly` joins the shell's control states.** It was supported by every field, declared by none,
  and painted nowhere: a form locked for review looked exactly like one waiting to be filled in.
  `.mdy-input-wrapper--readonly` keeps full contrast and pointer events, because a read-only field is
  in play and a disabled one is not.
- Three i18n strings name the chip's controls: `chipRemoveLabel`, `chipDecrementLabel`,
  `chipIncrementLabel`.

**Lit's datepicker and timepicker now open from their control**, which the contract has named as their
opener all along. Reading the opener from the catalogue rather than from a list written out in a test
is what exposed it — and the same list, joined into one selector, had been returning a daterange's
start input for the datepicker's opener, so three unrelated widgets read as broken.
