---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

The caption names the group, each control names itself

A date range is two boxes under one caption, and each box was told two things about its name: it
pointed at the caption *and* carried "Start date" or "End date". `aria-labelledby` wins the name
computation, so both boxes announced the caption and neither said which end it was — the names meant
to tell them apart were never spoken.

The pair is a `group` carrying the caption's words; each box carries its own role name and no
reference to the caption. A reader hears "Stay, group — Start date" on entry and "End date" on the
second, which is the reading a sighted person gets from the layout.

The words rather than a reference: a caption a document did not write is never drawn, and a reference
to it then resolves to no element.

ADR 0175 states the rule for every case of one caption over several controls, and the test for
whether it applies: can a person meaningfully fill in one and leave the other empty? A start without
an end, yes — two controls. A day without a month, no — segments of one control, which is why the
timepicker is untouched.
