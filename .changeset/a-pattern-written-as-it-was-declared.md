---
"@modyra/core": patch
---

A rule already anchored at both ends is written into `pattern` unchanged.

`<input pattern>` is implicitly anchored, so a rule that is not anchored is padded — `a+` becomes
`.*(?:a+).*` — and the group is what keeps an alternation from binding across the padding. A rule
that already carries `^` and `$` needs neither: it was still wrapped, and `^[A-Z]+$` reached the DOM
as `(?:^[A-Z]+$)`.

Nothing a browser does changes. What changes is what a person reads — in the DOM, in a screenshot, in
a report of what the control asks for — and `constraints().pattern` now returns the rule as it was
declared. Padding and its group are unchanged wherever a rule is not anchored at both ends.
