---
"@modyra/widgets": major
---

`MDY_WIDGET_CONTRACT_VERSION` is 2

Asked against the previous tag rather than the committed snapshot, this release removed
`datepicker.actions` and `daterange.actions` and turned `multiselect.searchButton` from a `button`
into an `input` with `role="combobox"` — four major entries — while the published contract version
stayed at 1. A renderer written against "contract version 1" at 2.1.2 and one written against
"contract version 1" now implement two different anatomies.

The constant names the **anatomy**: an adapter reads it to say *"the parts I build are the parts this
number describes"*, and it moves whenever a part stops existing, changes its element, or gains a role.
That meaning is now written where the constant is declared rather than left to be inferred from an
audit's `!== 1`.

Anything pinned to `1` fails until it is re-read — which is what pinning it is for.
