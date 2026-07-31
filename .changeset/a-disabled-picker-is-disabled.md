---
"@modyra/widgets": patch
---

A disabled select, datepicker or timepicker is really disabled

The state matrix caught these as `STATE_NOT_APPLIED`: the widget said `aria-disabled="true"` and the
control stayed operable. A disabled datepicker still accepted a typed date, a disabled timepicker
still accepted a typed time, and a disabled select's trigger still opened its listbox. Assistive
technology was told one thing and the keyboard did another.

The three projections now emit the native `disabled` alongside the ARIA, which is what the
multiselect trigger has always done — the inconsistency had no reason behind it. The select trigger
also gains `aria-invalid`, which it computed for its classes and never exposed.

Every adapter that applies the projection's attribute map inherits this. Adapters that hand-write
their bindings do not, and Angular already binds `[disabled]` and `aria-invalid` on these kinds by
hand, so it is unaffected.
