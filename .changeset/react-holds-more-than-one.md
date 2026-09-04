---
"@modyra/react": minor
"@modyra/widgets": patch
---

`@modyra/react` draws the multiselect, in both of the modes the catalogue declares.

`single` is a set of toggles: each choice is a button wearing a check. `multi` is a bag, where a
choice can be taken more than once, so each row owes a stepper and a count — and draws its option as
a container rather than a button, because a button inside a button is not a thing a browser will
render. The mode is the declared type rather than a string: a mode outside the two produces a variant
name the catalogue does not declare, which downstream means *no* variant requirements rather than a
refusal, so the checks for the shape quietly stop applying.

The conformance kit mounts one variant per kind, so the mode it does not mount is the one nothing
would otherwise ask about — drawing a bag's rows as buttons passes the kit and fails the focused
bench, which reads what each mode owes from the catalogue's own variant declaration.

The way back from a destructive act and the way to clear are drawn whether or not there is anything
to undo, and say so with `aria-disabled` rather than `disabled`: a control that comes and goes moves
the one beside it under the hands of somebody aiming at it.

`useMdyMultiselectField` takes the optional element lookup `useMdySelectField` gained, for the same
reason: a command naming a part resolves to nothing without one.

**`@modyra/widgets`: one derivation for a choice's key, across all three controllers that hold a
list.** The select and the multiselect already defaulted to `defaultOptionKey`; the option field
defaulted to `String`, under which every plain object is `[object Object]` — an object-valued list
gave every choice one key, so two choices became one and holding either marked both. All three doc
comments described the `String` default, so two of them described a behaviour their own file did not
have.

For a primitive the two derivations agree exactly, which is why every fixture in this repository
concurred. It stayed invisible because each renderer passes its own `keyFor`: the workaround was in
four adapters, and the defect was reachable only by a consumer holding a controller directly — which
is who a headless package is for.
