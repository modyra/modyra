---
"@modyra/core": patch
---

An overlapping alternative is refused however it is written

The pattern guard compared a repeated alternation's branches by their first characters, and gave up
at a character class — so the same ambiguity written as a class walked through:

```
^(a|a)*$          refused
^([a-z]|[a-z])*$  allowed — 279ms at 22 characters, 4.5s at 26
^(\w|[a-z])*$     allowed — 338ms / 5.4s
```

Roughly ×16 per four characters: the exponential signature, not a slow pattern. The last one is what
makes it ordinary rather than contrived — nobody writes `(a|a)`, and people do write "word characters
or letters" without noticing the second is contained in the first.

Branches are now compared by **what they accept**: a class, a class escape (`\w`, `\d`, `\s`), a dot
and a literal are four notations for a set of characters, and two branches are ambiguous when their
sets share one.

The line that keeps this usable is unchanged and pinned: `^([a-z]|[0-9])+$`, `^([a-z]+|[0-9]+)$` and
`^(.|\n)*$` are **not** refused — a digit is not a letter, and `.` does not match a newline. A branch
beginning with a nested group or a backreference stays undecidable and allowed.

Found by `battle-tests/adversarial/security/overlapping-alternatives.battle.test.mjs`, which also
pins the boundary.
