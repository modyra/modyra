---
"@modyra/styles": patch
---

A number field's value no longer runs under stacked steppers

In a field tall enough to stack the steppers (`--mdy-input-height` of 48px or more, every theme but
modern), the input reserved no room for them, so a long value was drawn under the controls. The input
now keeps one stepper target (24px) clear at its inline end when the steppers stack, as it already
kept two when they stand side by side. The reservation is a logical margin, so it sits on the left in
right-to-left layouts.

**Migration.** No API changes. In the stacked themes a number input's text area is 24px narrower, so a
field sized by its content is 24px wider, and screenshot baselines of number fields change.
