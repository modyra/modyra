---
"@modyra/core": patch
"@modyra/widgets": patch
"@modyra/zod": patch
"@modyra/angular": patch
"@modyra/lit": patch
"@modyra/plain": patch
---

A rule declares what it enforces, and the control offers it.

`maxLength(50)` used to let someone type five hundred characters and hear about it afterwards: the
constraint reached the error list and never the input. Only `min`/`max` on numbers had made the
crossing, and each renderer wrote those by hand.

Now every rule with a native counterpart declares it — `required`, `min`, `max`, `integer` (a step of
one), `minLength`, `maxLength`, `pattern`, `email` — a field reports the total as
`MdyFieldState.constraints` / `MdyFieldHandle.constraints`, and every renderer offers what its kind
can carry. The translation lives in `@modyra/widgets` (`nativeConstraintAttributes`), once. A rule
with no native counterpart declares nothing and stays exactly what it was.

**A declared fact now survives composition.** `compose()` and `composeFirst()` carry the sum of what
they combine. This fixes a silent defect as old as `compose`: `compose(required(), maxLength(3))`
produced a field that was **not marked required** — no `aria-required`, nothing for a screen reader.
Where two rules bound the same thing the tightest wins; two different patterns cancel, because an
input carries one and their intersection is a rule nobody wrote.

**A Zod schema crosses over untouched**: `z.string().min(3).max(8)` reaches `minlength`/`maxlength`.
Only what has a native counterpart crosses — `z.number().gt(10)` deliberately does not, since
`min="10"` would admit exactly the value it refuses.

**The boundary is the model.** Attributes constrain typing. A value arriving from a draft, a server
or `set()` is kept whole and judged by the rules, as ADR 0029 requires of a widget.

Also in this change:

- **A conditional section now covers the collections inside it**, rows already declared included.
  *Out of play if any condition says no* was written three times and one copy did not know about the
  others; it is written once now, in `conditions.ts`.
- **`createForm` forwards `devWarnings`.** The switch the guides promised for silencing development
  diagnostics could not be reached from a typed form at all.
- New development diagnostics, each silent in the ordinary case: a binding that cannot put back in
  play what the schema left out, two patterns that cancel each other, and a `when` predicate that
  gives two answers for the same value.

`MdyFieldState.bounds`, added in an unreleased changeset, is now `constraints` and carries the whole
family. Nothing published ever had it.

See ADR 0030.
