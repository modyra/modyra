---
"@modyra/angular": major
---

Type `MDY_FLOATING_LABELS` by what it promises, not by the class that provides it

The token declared its own type as `MdyFloatingLabelsDirective`, and the directive imports the token
to provide itself. The two files named each other. Nothing objected: the reference is type-only, so
it compiles, ships, and stays invisible until somebody tries to move one of the two — which is the
kind of ring the cycle ratchet exists to refuse, and the kind it could not see until its reader
learned to follow `import(...)`.

`MDY_FLOATING_LABELS` is now typed `MdyFloatingLabelsSource`, an interface declared beside the token
and carrying the one thing anything asks of it — `mdyFloatingLabels: Signal<boolean>`. The directive
`implements` it. The dependency runs one way again, and it runs the way the rules ask: the directive
derives from the contract rather than the contract from the directive.

**Migration.** Injecting the token and reading `mdyFloatingLabels()` is unchanged. Injecting it and
reading anything else off it — in practice `mdyFloatingLabelsDensity` — no longer type-checks;
inject `MdyFloatingLabelsDirective` itself for that. Density is applied by the directive to its own
host element as a custom property and inherits from there, so a consumer reading it through the
token was reading a value it did not need to.

`contract:diff` classifies this `patch` and is right to: the widget contract's parts, relations,
keyboard and shared classes are untouched. `test:type-surface` classifies it `major`, on the line
that matters — a published token's type parameter was replaced. The second is the verdict a consumer
feels, and it is the one this release takes.
