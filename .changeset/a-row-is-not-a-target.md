---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
"@modyra/styles": patch
---

A checkbox or toggle row is no longer a pointer target

**Read this before upgrading: it is a breaking change released under a minor.** The anatomy below
changes, and a stylesheet that reaches the box through the input's *sibling* stops matching. The
shipped themes move with it; a stylesheet outside this repository does not. Selecting by state
rather than by position survives the change:

```scss
// before — the track was the input's next sibling
.mdy-toggle input:checked + .mdy-toggle__track .mdy-toggle__thumb { }
// after — the track is inside the label; ask for the state, not the position
.mdy-toggle:has(input:checked) .mdy-toggle__thumb { }
```

All three renderers built the wrapper as a `<label>`, and a native label forwards a click from
anywhere inside it — so the empty space to the right of the words toggled the field. The wrapper is
now a container, and the words are the `<label for>`.

**The drawn box moved inside the words**, and that is the part worth reading. The native input is
visually hidden in every renderer, so once the wrapper stops being a label the `<label>` is the only
element left that forwards a click: a box outside it is decoration nobody can press. Measured before
and after — the box went inert, then came back:

    before   row toggles · box toggles · words toggle
    interim  row inert   · box INERT   · words toggle
    after    row inert   · box toggles · words toggle

`MDY_WIDGET_CONTRACT_VERSION` moves **3 → 4**: `inputWrapper` is a `container` on these two kinds,
`label` is a `label`, and `indicator`/`track` are parented to it.

**Migration.** A stylesheet or test selecting `label.mdy-checkbox`, `label.mdy-toggle` or
`.mdy-toggle > .mdy-toggle__track` selects nothing now — the wrapper is a `div` and the box is inside
the label. Anyone relying on the whole row being clickable loses it deliberately. The shipped
stylesheet moves with the anatomy: `cursor: pointer` leaves the row for the label.

WCAG 2.5.5 is met as DESIGN.md § *the target is not the box* already meets it elsewhere — the target
is a centred overlay, so the visible box keeps its size. See ADR 0117.
