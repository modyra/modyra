---
"@modyra/widgets": major
"@modyra/angular": patch
---

`partSelector` moves from the testing door to the package's own

**Breaking: `partSelector` is no longer exported from `@modyra/widgets/testing`.** Import it from
`@modyra/widgets`. It also takes an optional third argument for part states, and infers its kind, so
every existing call still compiles.

Finding a part by the classes the contract declares is not a testing question — every renderer asks
it, and the ones that could not import it wrote the class name out as a literal instead. Eight of
those literals were in one renderer. A selector written by hand is a copy of the vocabulary that no
rename reaches: the class moves, the selector matches nothing, and the only symptom is a part that
quietly stops being found.

The move kept the two things the original got right and a first draft of this change lost:

- **it escapes the name**, by hand rather than with `CSS.escape` — that is a browser global this
  package must not require, since it loads and computes in a process with no DOM;
- **it answers `null`**, both for a part with no classes of its own (five controls have none) and for
  a part the kind does not have. Delegating to `partClasses`, which raises for an unknown part, broke
  a caller that sweeps every part name there is — for that question, "this kind has no such part" is
  an answer rather than a mistake.

**Angular's four shadowed `minSpace` numbers are gone.** Three renderers carried `450` and one `250`,
beside a spread of `overlayAnchoringFor` that lands after them and wins — so the literals decided
nothing while reading as though they did, and they disagreed with the catalogue that was actually
being used. The base's fallback stays, for a control the catalogue does not know.
