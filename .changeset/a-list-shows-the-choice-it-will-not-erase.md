---
"@modyra/widgets": minor
---

A list shows the choice it will not erase, and knows which choice it is

Three defects across `createSelectController`, `createMultiselectFieldController` and
`createOptionFieldController`, all landing on the same user: someone picks a customer, the list
refetches without them.

**The index collapsed for object values.** Both list controllers defaulted `keyFor` to
`String(option.value)`, and `String({id: 1})` is `"[object Object]"` — as is every other object:

```js
asked for { id: 1 }  →  held { id: 3 }
asked for { id: 2 }  →  held { id: 3 }
```

Not a failure to select — selecting the wrong thing, silently, while staying internally consistent.
The default now keys a plain object by **what it holds**, the same rule `oneOf` uses. Primitives and
arrays key exactly as before, because keys are consumer-visible: they become part ids and land in
`aria-activedescendant`. `defaultOptionKey` is exported from the package root, so a consumer writing their own `keyFor` has the default to fall back to.

**The survivor was unreadable.** A kept value was labelled `String(value)`, so an object read
`[object Object]` — worse than clearing, because it looks like a value and gives nothing to act on.
The controller now remembers the label each key was last painted with, so a refetch that drops Ada
leaves *Ada* on screen. `optionsWithUnrecognizedValue(s)` takes an optional `labelFor`.

**The survivor had no part.** Both views built option parts from the *declared* list while their own
state contract says a renderer paints the painted one — so the single entry a user needs in order to
replace their value rendered with no id, no `role="option"` and nothing `aria-activedescendant` could
point at. Parts now come from the painted list.

**A radio group follows the same rule now.** It painted nothing for a value its list did not offer,
which left an unanswered question that has an answer, submitted unseen — and unlike a select it has
no trigger to show the value in. A radio group holding an unrecognised value now renders an option
for it, and `selectedKey` resolves where it previously read `null`.

Recorded as [ADR 0054](https://github.com/modyra/modyra/blob/main/docs/architecture/0054-a-list-shows-the-choice-it-will-not-erase.md).
Found by `battle-tests/adversarial/collections/`.
