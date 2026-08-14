# ADR 0054: A list shows the choice it will not erase

Status: Accepted

## Context

`options-reconciliation.ts` opens by naming its own scope: *"Any control that offers a list faces
this: a form holds `"fr"`, the options arrive without it, and the control has to show something."* It
settles that the widget **does not write to the model to make itself consistent**, because erasing
the value destroys the one thing that would let the user fix it, and it adds the held value to the
painted list so the user can see and replace it.

Three findings showed that neither half was applied consistently.

**The index collapsed for object values.** `createSelectController` and
`createMultiselectFieldController` both defaulted `keyFor` to `String(option.value)`, and
`String({id: 1})` is `"[object Object]"` — as is every other object. The index held one entry,
whichever option was written last:

```
asked for { id: 1 }  ->  held { id: 3 }
asked for { id: 2 }  ->  held { id: 3 }
```

Not a failure to select: selecting the wrong thing, silently, while staying internally consistent.
The same module already reasoned about exactly this — `sameChoice` says *"Never loose between
objects: `String()` renders every plain object as `[object Object]`, so a comparison through it says
two different entities are the same one"* — and the reasoning simply never reached the place the key
is derived.

**The survivor was unreadable.** It was built as `{ value, label: String(value) }`, so an object
value produced a field reading `[object Object]`. Worse than clearing in one respect: cleared is
visibly empty, while that looks like a value and gives nothing to act on.

**The survivor had no part.** `MdySelectState.options` documents that a renderer paints *that* rather
than the list it was handed, and both views built their option parts from the declared list. The one
entry a user needs in order to replace their value rendered with no id, no `role="option"` and no
`aria-selected` — an element inside a listbox that is not an option.

And the rule reached two controls out of three: a radio group painted nothing for a value its list
did not offer.

## Decision

**An option is keyed by what it holds.** The default `keyFor` keys a primitive exactly as before —
keys are consumer-visible, they become part ids and land in `aria-activedescendant`, so a value that
already keys distinctly is untouched — and an array too, since `String(["b"])` is `"b"` and distinct
per array. A plain object is keyed structurally, the same rule `oneOf` uses to recognise an option
([ADR 0051](0051-an-option-is-recognised-by-what-it-holds.md)), so a list rebuilt from fresh objects
by a refetch keys the same where identity would not. `defaultOptionKey` is exported.

**A survivor is named by the option it came from.** The controller remembers the label each key was
last painted with, so a refetch that drops Ada leaves *Ada* on screen. A value that was never in any
list — from a draft, a patch — falls back to a readable form, never `[object Object]`.
`optionsWithUnrecognizedValue(s)` takes an optional `labelFor` for callers that know better.

**A view's parts come from the painted list**, in both controllers, which is what their own state
contract already said.

**A radio group follows the same rule.** It has no trigger to show a held value in, so hiding it left
an unanswered question that has an answer, submitted unseen. The phantom entry is the price and it is
the smaller one: a group with an extra radio is legible and correctable.

## Consequences

A radio group holding a value outside its list now renders an extra option, and
`state().selectedKey` resolves instead of reading `null`. That reverses a pinned behaviour of that
one controller — the test asserting it is replaced rather than deleted, and this record is why.

Two structurally identical objects in one option list share a key, as they share a `oneOf` verdict.
Distinguishing them is what an id is for.

Keying an object walks it rather than stringifying it, once per option per rebuild, capped at eight
levels deep — below which two options that differ only there share a key, which fails to distinguish
rather than pointing at the wrong row.

## Alternatives rejected

**Identity keys (a `WeakMap`) for non-primitives.** Stable within one list and unstable across a
`setOptions` that rebuilds it from fresh objects — which is what an API refetch produces — so a
selection that survives a refetch today would stop surviving it.

**Leave the label to the caller.** There is no `labelFor` on the field controllers' options and the
value can arrive from a draft that no list ever held; a default that produces `[object Object]` is
not a default.

**Let the radio group opt out, and pin the difference.** Defensible — a group with a phantom option
is arguably worse than an empty one — and it loses the argument on its own evidence: the select has
a trigger that shows the value and the radio group has nothing, so the control with the weaker case
for hiding it was the one hiding it.

## Verification

- `packages/widgets/test/option-field-controller.spec.mjs` — a dropped value keeps its key and gains
  a part; a value the list offers is not painted twice.
- `battle-tests/adversarial/collections/select-option-identity.battle.test.mjs`,
  `unrecognized-option-label.battle.test.mjs`, `option-controllers-blast.battle.test.mjs` — the
  attacks that found all three, across the three controllers.

## Security and privacy

None directly. The submitted value is unchanged in every case: what changes is whether the user can
see and correct what they are about to submit — and a form that submits a choice its user cannot see
is the shape a consent or a permission field must never have.
