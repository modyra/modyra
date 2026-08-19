---
"@modyra/core": patch
"@modyra/widgets": patch
---

A control offers the rule's pattern, and cannot loosen it

Two halves of one defect. `<input pattern>` is implicitly anchored — a browser reads it as `^(?:…)$`
— and a rule's expression is not, so a rule of `a+`, which accepts any value *containing* an `a`,
became a control that refused `xax`: the control turned away a value the form accepts and told the
person to match a format nobody wrote. `MdyFieldConstraints.pattern` is now the rule said the way the
platform reads one, padded at whichever end carries no anchor, so every renderer writes the same
attribute.

And a control's own pattern replaced the field's outright, so a control offering `^.*$` over a rule of
`^[a-z]{4,}$` invited exactly what the form was about to refuse. A control may ask for less and never
for more: its pattern is taken unless it can be **shown** to loosen — a probe the rules refuse and it
accepts. Absence of a counterexample is not a proof, and that limit is written where the probes are.
