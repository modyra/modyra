---
"@modyra/widgets": minor
---

The contract names the states a part can be in

A part's classes said what it *is*; nothing said what it is *doing*. Selected, open, disabled,
today's date, the start of a range — 38 such classes lived as string literals in the renderers and as
rules in the themes, agreeing only because someone remembered. A theme styling `--focused` where a
renderer emits `--active` is a rule that matches nothing, and no test in this repo could see it.

`MDY_STATE_MODIFIERS` names each state once and fixes its spelling, `stateClass` derives the modifier,
and `partClasses(kind, part, states)` answers "what classes does this part carry right now" from the
catalog — the shape `multiselectChipClasses` already proved for the chip. A part declares the states
it can be in; asking for one it never declared throws rather than emitting a class no theme has.

Shell parts resolve through `MDY_FIELD_SHELL_CLASSES`, so a state on `inputWrapper` lands on
`mdy-input-wrapper`. A widget that renames a shell part has made it a different part and does not
inherit the shell's states: a multiselect's `inputWrapper` is the chip grid, and
`mdy-multiselect--disabled` is a class nothing has ever styled.

`multiselectChipClasses` gains `removable`, and spells `--selected` through the shared vocabulary
instead of its own constant. `widgetStateClasses(kind)` reports every class a widget can produce,
which is what an audit needs to hold the shipped CSS to the contract.

Additive: no existing export changes shape.
