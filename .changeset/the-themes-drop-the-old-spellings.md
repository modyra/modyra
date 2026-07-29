---
"@modyra/styles": minor
---

The themes drop the spellings from before the contract

Eighteen classes were styled by the shipped stylesheets and emitted by no renderer in any adapter.
They are what the contract's own vocabulary replaced — `mdy-switch` before the toggle's wrapper was
`mdy-toggle`, `mdy-multiselect__chip` before the chip primitive, `mdy-multiselect__option` before the
chip took over the option, `mdy-radio-group-label` and `mdy-segmented-label` before a group's label
was the shell's, `mdy-colors__swatch-toggle` and `mdy-colors__native-picker` before the colours field
was rebuilt, `mdy-datepicker__input-group` before the picker became a row, `mdy-range-calendar`
before the range shared the calendar. Rules that match nothing, kept alive only because deleting CSS
felt riskier than leaving it.

Removed from all five stylesheets, and the contract-coverage allowlist shrinks from 138 entries to
120 — none added. What the browser resolves is unchanged: every deleted selector matched nothing.

`--mdy-toggle-thumb-size-checked` goes with them. It was documented as deprecated and "remove with
the next major", and it is inert already: the foundation reassigns it to `--mdy-toggle-thumb-size`,
so a theme setting it was overwritten, and nothing reads it. Ionic's setting of it is removed too.

Two selectors were narrowed rather than deleted, because their live half is real:
`.mdy-input-wrapper input:not(.mdy-checkbox, .mdy-switch)` loses the dead half of its negation — a
toggle's wrapper is `.mdy-toggle`, so that rule never reached it — and
`.mdy-renderer--open .mdy-multiselect-overlay__panel:not(…--overlay)` loses a `:not()` that always
passed.

**Found while doing this, not fixed here.** The themes styled
`.mdy-multiselect-overlay__panel--above` and `--overlay`, but the renderer puts the placement on the
shared panel as `mdy-overlay-panel--above` / `--overlay`. The multiselect's above-placement and
modal-placement styling has therefore never applied — a rule matching nothing, which is exactly the
silent failure the contract exists to prevent. The dead selectors are removed; the fix is to style
the class the renderer emits, and it belongs with contractualising popup placement.

**Deliberately kept**, because they are a missing capability rather than a dead spelling:
`mdy-datepicker__backdrop`, `mdy-timepicker__backdrop`, `mdy-select__overlay-backdrop`,
`mdy-datepicker__popup--modal`, `mdy-timepicker__popup--modal`. A modal placement needs a backdrop
and the contract has no `backdrop` part; a popup does not reflect the placement it ended up in.
Those five are the whole remaining dead list, and each is a contract entry to add.
