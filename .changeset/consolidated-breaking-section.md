---
"@modyra/widgets": minor
"@modyra/core": minor
"@modyra/plain": minor
"@modyra/angular": minor
"@modyra/lit": minor
---

The breaking section, consolidated

`contract:diff --since v2.4.0` classifies this release **major**: 35 major entries against
275 minor. **It ships as a minor anyway, deliberately**, and this section is where that debt is
paid: the number does not warn you, so the text has to.

For `@modyra/plain`, `@modyra/lit` and `@modyra/angular` there is no debt — they are below 1.0,
where semver already permits breaking changes in a minor. It is `@modyra/core` and
`@modyra/widgets`, moving 2.4.0 → 2.5.0, that carry breaking changes under a number which by
convention promises none. Read this section before upgrading those two; a version range that
admits 2.5.0 will take it without asking.

The individual changesets carry the bumps; this one carries the migration, so the release page has
one place to read instead of 303.

## Removed from the public surface

**`timepickerDialAria`** — exported from `@modyra/widgets` at 2.4.0, gone now. It returned the
dial's ARIA shape at runtime; that shape is now **declared** in the contract:

    timepickerDialAria("hour", …).role === "slider"    // 2.4.0, computed for the dial face
    MDY_WIDGET_CONTRACTS.timepicker.hourControl.role    // "spinbutton", declared

These are not the same element renamed. Per ADR 0145 the dial face **lost its interactive role
altogether** — a `slider` that Tab could not reach, announcing a value the hour box was already
speaking. The hour and minute boxes kept the `spinbutton` role they always had; what is new is
that the contract now declares it instead of a helper computing it.

So there is no replacement call. Read the role from the contract, and expect nothing on the face.

**`MdySelectA11yProjection.listbox`** — the type survives, the member does not. It is now
`options`. A consumer that reads `.listbox` off the projection fails to compile; nothing about
this is visible in a changeset that speaks only of contract parts, which is why it is stated here
as a member.

## Parts renamed, and the two aliases that exist

`listbox` became `options` on both `select` and `multiselect`. Both keep a resolving alias under
the old name.

**The alias covers the name and not the position.** `multiselect.options` also changed parent —
`root` → `popup` — and `select.option` moved from `listbox` to `options`. Code that resolved the
part by name keeps working; code that walked to it by position does not, and the alias will not
tell it so.

## Parts removed with no alias possible

`multiselect.header` and `multiselect.searchButton` have no element behind them any more. An alias
would resolve to nothing, which is worse than a name that fails loudly — so there is none. This is
not an alias withheld; it is an alias that cannot be written.

The search button's relations went with it: `aria-describedby` → errors and supporting text,
`aria-controls` → popup. `label[for]` now targets `trigger`.

## Parts that became required

`multiselect.trigger`, `multiselect.wayBackAction`, `multiselect.clearAll`,
`multiselect.announcement`, `select.options`, and `file.clear` (previously optional).

Left optional, a renderer could omit them, and for `clearAll` and `wayBackAction` that omission
*is* the defect the decision removes: a control that appears and vanishes under a hand already
moving toward it. Presence follows what the widget can do, never what it is currently showing.

## Roles and elements changed

    datepicker.calendar    none → dialog
    daterange.calendar     none → dialog
    timepicker.popup       none → dialog
    timepicker.hourControl none → spinbutton
    timepicker.minuteControl none → spinbutton
    multiselect.chips      none → grid          parent inputWrapper → box
    multiselect.chip       none → gridcell      element button → container, parent chips → chipRow
    colors.toggle          element button → presentation

`multiselect.inputWrapper` no longer carries the `mdy-multiselect` class. It is not kept as an
alias: two elements under one name is the ambiguity the change removes, and keeping the class
would reinstate it.

## Parents moved

    slider.value           root → track
    multiselect.placeholder inputWrapper → trigger
    file.clear             dropzone → content
    file.fileList          dropzone → content
    file.rejected          dropzone → content

A stylesheet or query that descends from the old parent no longer reaches these. The part names
are unchanged, so resolving by name is the migration.
