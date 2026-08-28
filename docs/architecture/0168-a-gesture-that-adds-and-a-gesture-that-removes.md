# ADR 0168: A gesture that adds, and a gesture that removes

Status: Accepted

## Context

A key declared without a modifier answered a press with one held. Measured across all three
renderers, on every kind that opens something: `Cmd`+Space, `Cmd`+ArrowDown, `Cmd`+Enter each opened
a panel. On the platforms those belong to they are the input-source switcher, the end of a document,
and submit — a person holding the modifier is reaching for one of those, and the panel arrived under
the gesture meant to do something else.

`matchesKeyGesture` had always said otherwise: a binding declaring `modifier: "primary"` requires the
modifier, and one declaring none requires its absence. What it did not have was a road. Every
question a renderer actually asks — `keyMeans`, `keyBindingFor`, the two hand-written policies, the
calendar's `keydown` intent — took a **key name**, so what was held with the press never reached the
one function that reads it. A defect planted in that function moved no check in either tier, because
nothing on the deciding path called it. It was published as the answer to a question nobody asked it.

Fixing the opening case made the closing case worse, and that is what forced the decision: the same
guard stopped `Escape` from closing a panel when a modifier happened to be held.

## Decision

**A gesture that adds is refused under a held accelerator. A gesture that removes is honoured
whatever is held.**

The question is not whether a press was aimed at this control — that cannot be known — but what the
wrong answer costs. Opening or committing wrongly puts something there nobody asked for, and may have
swallowed a system gesture on the way: two harms, one of them outside this library. Dismissing
wrongly costs a reopen. **Refusing to dismiss leaves somebody inside a panel with the way out not
working**, which is a keyboard trap, and the one class of defect with no exception worth arguing.

`Escape` is the key a control does not get to reinterpret. Its meaning is *stop*, no modifier changes
that on any platform, and where a system claims a modified `Escape` it takes it before the page sees
it — so honouring it costs nothing and refusing it costs everything.

Confirm belongs with open, not with close: it writes a value, and `Enter` is already overloaded
between "take the highlighted option" and "submit the form this panel sits in". A modifier does not
resolve that ambiguity, it adds a third reading.

```
open      bare only     adds state, and may shadow a gesture aimed at the platform
confirm   bare only     adds state, and Enter is already overloaded
close     any modifier  removes state; the way out is never conditional
```

**This is declared, not coded.** `MdyKeyBinding.modifier` gains `"any"`, the dismissal bindings carry
it, and every path that decides a press reads the binding. A renderer or a policy naming `Escape` in
a condition holds a second copy of this rule, and the copy is what stops moving when the declaration
does.

## Consequences

Four signatures widen to accept a press where they took a key name: `keyBindingFor`, `keyMeans`, and
the two overlay policies. The string form keeps meaning exactly what it meant — a caller asking what
the catalogue declares about `Tab` has no press in hand — so the call site now says which of the two
questions it is asking, which is the point rather than a side effect.

The calendar's `keydown` intent carries the accelerator. Without it the controller decided as though
every press were bare, and it is the contract's own controller: the rule could not reach the place
that needed it.

**The type surface classifies this major and I disagree with half of it.** `MdyKeyBinding.modifier`
widening from `"primary"` to `"primary" | "any"` is a real break for a consumer switching
exhaustively on it. The four parameter widenings are not: accepting more in a parameter position is
safe for every caller, and breaks only somebody who has typed their own function *to* the old
signature. Shipped as major because that is the conservative reading and cannot under-warn, with the
disagreement recorded here rather than resolved silently.

## Alternatives rejected

**Special-case `Escape` in the guard.** It was the first shape and it was wrong: the rule then exists
twice, in the catalogue and in a condition, and the condition is what keeps answering after the
catalogue changes. Proved by mutation — removing `modifier: "any"` from the declaration left every
check green while the guard still named the key.

**Refuse every modified press, dismissals included.** What the first fix did, before the question was
asked outside. It trades a small surprise for a keyboard trap.

**Leave the resolver as the documentation of a rule nobody applies.** The state it was in. A published
function that decides nothing is worse than no function: it reads as the answer, so nobody looks for
the answer elsewhere.

## Verification

- `packages/widgets/test/a-key-held-with-a-modifier.spec.mjs` asserts the road, not the rule: the
  resolver already refused a held modifier, and what is new is that the question every renderer asks
  now reaches it. It also asserts that a caller naming a literal still gets what the catalogue
  declares, because the two questions must stay distinguishable.
- The same gesture in each renderer: `packages/plain/test/`, `packages/lit/test/`,
  `packages/angular/src/lib/renderers/`. Each carries its own anti-tautology control — a bare press
  must really open something — so a renderer cannot satisfy them by answering no key at all.
- Mutation, and this is the one that matters: planting `return true` in `matchesKeyGesture` used to
  move nothing in either tier. It now turns checks red in all three renderers. Removing
  `modifier: "any"` from the dismissal bindings turns five kinds red.
- **`colors` is the sixth and its dismissal is still a hand comparison in one renderer.** It behaves
  correctly and does not read the declaration, so the mutation above leaves it green. Recorded rather
  than swept.
- The contract snapshot does **not** cover the keyboard catalogue. This change altered a published
  binding and `contract:diff` reported `patch` — the differ compares parts, classes, states, order
  and presence, and no keyboard declaration is among them.

## Security and privacy

None directly. Worth one line on the adjacent risk: a control that answers a system accelerator is
taking a gesture the platform reserved, and on a platform where that gesture reaches an assistive
technology or a security surface, doing something else with it as well is a way to make a person's
own machine behave unpredictably under them. The repair is the same either way.
