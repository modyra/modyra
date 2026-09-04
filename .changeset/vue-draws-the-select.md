---
"@modyra/vue": minor
---

`@modyra/vue` draws the select, in both of its shapes.

Which one a field gets is not an option on the component: `variantOf` answers `custom` for a select
that filters and `native` for one that does not, and the two are different controls — a combobox
this package builds, and the chooser the platform draws and owns the keyboard of. `searchable`
defaults to `false`, which is the contract's default, so a field configured the same way is the same
control in every adapter.

For the combobox, every behaviour is read from a published door rather than decided in the
component: `focusPartOnOpen` for where focus goes when the panel opens, `keyBindingFor` for which
key opens, moves, commits or cancels, and `popupHoldsAnAction` for whether Tab stays — `false` for
this kind, so Tab closes the panel and is left to the browser.

For the chooser, the contract's rule is asserted rather than assumed: a `<select>` carries no
`aria-expanded`, `aria-controls` or `aria-haspopup`, because a chooser that claims to be a combobox
is lying about what it is. It carries an entry standing for "nothing chosen", disabled, without
which index 0 is a real option and the field reads as answered while the form holds nothing.

**A classification this release deliberately does not take.** `test:type-surface` calls the props
change on `MdySelectField` **major**, and read on its own that is right: a consumer who wrote the
component with no `searchable` got the combobox and would now get the chooser. No such consumer can
exist — the component was added in this same unreleased window and has never shipped with the other
default — so the release-facing change is still the addition described above. Recorded here rather
than settled quietly, because the baseline was accepted in the same commit and a later reader would
otherwise find a major move with a minor bump and no reason.
