---
"@modyra/widgets": minor
---

The shell's state classes are derived, and the accessible-name rules are reachable.

`MDY_FIELD_STATE_CLASSES` restated what `MDY_FIELD_SHELL_CLASSES`, the shell's part states and
`MDY_STATE_MODIFIERS` already held — and restated it in a *second vocabulary*: `labelStates` said
`"has-error"`, the modifier, where the shell states say `"hasError"`, the state. Two tables for one
fact drift the moment one of them is edited, and they drift silently, because a theme rule keyed to
the spelling nobody updated simply stops matching. Every member is now derived from the one table
that already declared it, and the shell's states moved to `structure.ts` beside the shell's classes,
where the name of a part and what it may be doing are one fact rather than two.

The derived values are identical to the literals they replace, with one exception worth stating:
`fieldStates` is now `["open", "touched"]` rather than `["touched", "open"]`, because that is the
order the catalogue has always declared and the order its test asserts. It affects the order two
class names appear in on the field root, and nothing else.

`MDY_SEMANTICS_REQUIRING_NAME`, `partsRequiringName` and `MdyAccessibleNameSource` are now exported.
They said how a part comes by the name a screen reader announces — a listbox, a dialog or a grid with
no name is announced as an unlabelled container — and were reachable only from inside the package, so
an adapter writing its own checks could not consult the rule it was being held to.

`MDY_POPUP_OPENERS` and the relation tables are keyed by `MdyWidgetKind` instead of `string`. A
misspelled or stale kind was silently ignored, and `relationsFor` guards each lookup, so a wrong key
**dropped the relation** rather than failing — a field whose errors reach no assistive technology,
which is the exact failure declaring the relations was meant to make catchable. Narrowing the key
immediately found `projectOverlayOpenerA11y` and `overlayControlledId` taking a bare `string`; both
now take a kind.
