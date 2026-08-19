---
"@modyra/widgets": major
"@modyra/plain": patch
---

Every option a document declares is one a person can reach. An option's key — and the id built from
it — came from its value, so two options a document declares with the same value produced one key,
one element and one id: a list of three offered two, and the one that vanished was the second. The
controller now gives each painted option a key of its own and publishes them as
`MdySelectState.optionKeys`, in the order the options are painted. Selection still follows the value,
so two options that say the same thing remain one choice, and the parser still reports the duplicate
as the document defect it is.

An option value carrying whitespace or the id delimiter is percent-encoded where it becomes part of
an id: `aria-activedescendant` and its family are space-separated lists of ids, so an option valued
`New York` produced a reference to two elements that do not exist and pointed a screen reader at
nothing.

**Breaking for a consumer that builds `MdySelectState` itself**: `optionKeys` is a required member. A
renderer keying options by value should read it instead.
