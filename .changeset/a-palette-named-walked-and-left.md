---
"@modyra/vue": patch
---

`MdyColorsField` names, walks and leaves its palette the way its contract declares

- `presets` takes palette entries with labels (`{ value, label }`), as `colorPresetsOf` does,
  and each swatch is announced by its label. A swatch with no label is announced by its value.
- While the panel is open, ArrowUp, ArrowDown, Home and End move between swatches, using the
  bindings the contract declares.
- The custom entry opens the platform's colour chooser and leaves the panel open. It used to
  close the panel.
- The field takes the colour from the native input's `change` event, not `input`, so a colour
  the pointer only passes over during a drag is not chosen.

No migration. `presets` accepts strings as before.
