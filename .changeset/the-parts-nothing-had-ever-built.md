---
"@modyra/core": minor
"@modyra/plain": minor
"@modyra/widgets": major
---

The optional parts that only exist once something is supplied are built and checked for the first
time, and building them found three contract defects.

`clear` no longer hangs from `fileItem`. Every renderer puts one clear button beside the file list,
because clearing empties the field rather than one row — the contract asked for it inside an item.
`mdy-file-name` and `mdy-file-meta` join the file kind's presentation classes; both were rendered and
neither was declared.

Plain gains the two affordances it never had. `loading` on select and multiselect shows on the
control, matching the other adapters, so its state matrix no longer reports the state as undrivable.
`prefix` and `suffix` render on the free-text kinds when the field supplies content for them — an
empty affix is a gap the theme still spaces, so they appear only when there is something to put in
them. Both arrive as optional properties on the dynamic field config.

New coverage, each falsified by breaking the renderer it checks: a file field with files chosen, a
text field with both affixes, Lit's slotted affixes, and the value-chip presentation the multiselect
catalogue declares as its compact alternative — declared, styled and reachable through
`multiselectChipClasses`, and until now never once constructed.
