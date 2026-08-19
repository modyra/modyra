---
"@modyra/widgets": patch
---

An option whose value is an object is the same choice when it comes back as a fresh object — which is
what a restored draft, a refetch and an import all produce. The reconciler compared object values by
reference, so a select showing two options rendered three: the same customer twice, once by its label
and once by its own JSON, with both entries sharing the key a part id and `aria-activedescendant` are
built from. Objects are compared by the key an option is identified by, which is the rule `oneOf` and
`defaultOptionKey` already use (ADR 0051). Primitives are unchanged, and a value the list genuinely
does not hold is still kept and still shown.
