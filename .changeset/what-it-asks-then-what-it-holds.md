---
"@modyra/widgets": patch
---

A combobox says what it asks, then what it holds

A `<label for>` names a button, and that was the defect rather than the fix: the accessible name
computation takes the caption and stops, so the button's own content — which for a select trigger
*is* the chosen value — was never appended. A person reaching the field heard what it asks and not
what it holds.

The projection names the trigger by two references, the second being the trigger itself: a
self-reference contributes the element's own content, so the name reads "Country, France" without
the value needing an id of its own. The `<label for>` stays — it no longer supplies the name, and it
is still what makes clicking the caption reach the control.

The platform's own chooser is left alone. A `<select>` has a value the reader announces separately,
so `for` gives "Country, combo box, France" already, and overriding it would take apart what the
platform does right. See ADR 0175.
