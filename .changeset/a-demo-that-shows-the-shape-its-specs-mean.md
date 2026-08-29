---
"@modyra/lit": patch
---

A datepicker says what it is asking

lit's datepicker input was named by nothing: it carried the role, the popup relation and the
reference to its list, and no caption. A control named by neither `aria-labelledby` nor `aria-label`
is announced by its own text, which for a typeable date is whatever was last typed into it.

It reads `fieldNameAttributes` now, through a door on the base element rather than a rule per
component, so the caption wins where there is one and the words the field can offer stand in where
there is not — and never both.
