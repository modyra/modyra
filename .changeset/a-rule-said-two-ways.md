---
"@modyra/core": minor
---

A field can be given its rules by name

`field("", [], { rules: { required: true, minLength: 3 } })` says what
`field("", [required(), minLength(3)])` says, without the imports — which is what most fields
actually need. The rules are appended to the validator list, so the two can be mixed and a rule
written either way is the same rule.

**The vocabulary is derived from the validators, never listed.** Each rule that offers itself to a
document declares the name and the arguments it takes, on itself:

    withFacts(fn, { minLength: min }, { rule: "minLength", takes: ["number"] })

Inference was the alternative and it fails on a case that already exists in shape: a first parameter
tells you `required(message?)` takes nothing and `minLength(min, message?)` takes a number, but a
rule like `startsWith("MDY-")` reads as message-only and gets called with no argument — code that
compiles and validates nothing. The rule knows; nothing else does.

Eight rules declare themselves: `required`, `email`, `integer`, `minLength`, `maxLength`, `min`,
`max`, `pattern`. **`oneOf` deliberately does not** — a field's `options` is the declarative form of
that list, and carrying it twice would let one copy disagree with the other. The reasoning is on its
definition and a test refuses a declaration there, so it cannot be undone by an edit that looks like
completeness.

A name nothing declares is refused with the list of what is available, and a field that cannot build
a rule it was given throws rather than enforcing less than it was told to.

`declarationOf`, `declaredRuleNames`, `declaredRuleShape` and `buildDeclaredRules` are exported for a
document reader that needs the same vocabulary.
