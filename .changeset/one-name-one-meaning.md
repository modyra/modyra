---
"@modyra/core": minor
"@modyra/plain": patch
"@modyra/react": patch
"@modyra/preact": patch
"@modyra/angular": patch
---

A form from a flat field list, built in one place

`buildDynamicFormSchema` meant two things. In `@modyra/core` it takes the nested node a document
declares; in the React binding it took the flat list a parse produces — a different function with the
same name. The framework-free renderer had a third under `buildFormSchema`, a **superset** that also
rebuilds collections, and the Angular one inlined a fourth. Three implementations of one rule can
differ, and the only way anyone would have found out is a user reporting that the same document
behaves differently in two renderers.

`buildFlatFormSchema(fields, collections?)` and `applyFlatValidators(form, fields, key?)` are that
rule, named for what they take. The superset behaviour is the one that survived: a path cannot say
whether `lines.0` came from an array or a record keyed by digits, so the collections are passed rather
than guessed. The nested builder keeps its name — renaming a working export to make room for a new
one is a break with no gain.

`applyFlatValidators` asks for the one method it uses rather than a whole `MdyTypedForm`: one of the
three callers passes a component that owns a form, and a signature wider than its use turns a working
call into a cast.

`useMdyField` now applies the verdict rule. `errors` is what the field **shows** — a field the form is
not asking about shows none — and `heldErrors` is what it still carries, for a debugging view.
`showsAsInvalid` and `errorsVisible` come with it. The rule landed in the renderers a while ago and
had never reached the hooks.
