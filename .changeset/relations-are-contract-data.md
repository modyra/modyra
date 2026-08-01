---
"@modyra/widgets": minor
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": major
---

Milestone B, batch 2: the references between a widget's parts are contract data.

`MDY_WIDGET_RELATIONS` declares, per kind, which part names which other part and with what attribute —
the label's `for`, the control's `aria-describedby`, a group's `aria-labelledby`, an opener's
`aria-controls`. These existed in two places and neither was the contract: the projections emitted
them at runtime and the conformance inspector restated the rules in its own code. A rule that lives
only in the checker cannot be read by someone implementing the widget, which is what this contract
exists to make possible.

Declaring them changes what can be caught. The inspector could only ever find a reference pointing at
nothing — a *dangling* id. A part carrying no reference at all has nothing to dangle, so a field
whose errors reached no assistive technology looked exactly like one with no errors. Two shipped
defects of that shape turned up immediately:

- **A select described itself to nobody.** `projectSelectA11y` never emitted `aria-describedby`, so
  the two adapters that consume the projection linked no errors to the trigger at all. The projection
  now makes the relation, and the renderer says which of the description or the error list is on
  screen — `aria-describedby` must name an element that exists.
- **A Lit radio group did the same.** The projection offered the attribute and the renderer restated
  its neighbours by hand, dropping it.

`label[for]` is also checked against the HTML rule that it may only name a labelable element.

**Breaking for `@modyra/angular`**: `MdyFormComponent` takes a second type parameter, `TSubmit`,
defaulting to `Partial<T>`. It previously pinned that default, which made a typed form's own precise
submit type unassignable to it — `[form]="typedForm"` did not compile, and the demo build had been
failing. Callers naming the component's type explicitly gain a parameter with a default.
