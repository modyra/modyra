# ADR 0051: An option is recognised by what it holds

Status: Accepted

## Context

Three parts of the contract, each correct on its own:

1. `value-contracts.ts` states that an option's value is **whatever the option list holds**, so any
   non-nullish value satisfies the shape, and whether it is one of the offered options is a
   validator's question that `oneOf`/`eachOneOf` answer.
2. `oneOf` answered it with `Object.is`, deliberately: it is the client-side anti-tampering guard, and
   a select offering `"one"`/`"two"` must not accept a scripted `set("three")`.
3. A draft is written as JSON and read back as JSON.

Together they produce a form that calls a user's own saved answer a forgery:

```js
const OPTIONS = [{ id: 1, label: "One" }, { id: 2, label: "Two" }];
field(null, [oneOf(OPTIONS)]);

// the user picks OPTIONS[0]        → valid
// the draft saves, the form reopens → { id: 1, label: "One" }, a different object
//                                   → "not an offered option", and the form is invalid
```

The only way out is to pick the same thing again, and nothing on screen explains why. Object-valued
options are not an exotic case — the value contract says in its own words that an option is whatever
the list holds, and every option list built from entities has them.

Found from outside by `battle-tests/adversarial/persistence/option-identity.battle.test.mjs`.

## Decision

**An option is compared by what it holds.** A primitive by value, and an object by its members,
recursively: two values are the same option when they carry the same data, whichever copy they are.

**Only what JSON round-trips is compared structurally** — plain objects, arrays, dates and
primitives. A class instance, a `Map`, an option carrying a function keeps identity comparison,
because a copy of one of those is not a value this can honestly claim to recognise, and the round
trip that motivates the change cannot produce one anyway.

**The guard keeps its reason for existing.** A value that was never offered is still refused, and the
cases that make that concrete are pinned: an option with a member missing, a member added, a member
of the wrong type, a member differing in case, an id that is not on the list, and a bare label.
"Looks like an option" is not "is one" — every member must match.

## Consequences

Two structurally identical options in one list become indistinguishable to the guard. A list holding
`{ id: 1 }` twice accepts a value matching either, which is the correct answer to the question
`oneOf` asks and would surprise anyone expecting the guard to track which copy was clicked. Tracking
that is what an id is for.

Comparison costs a walk of the option instead of a pointer check, per option until one matches. Option
lists are the size of a dropdown; a comparison stops at the first differing member, and depth is
capped at 8 levels, past which values are reported as different — a structure that deep is not an
option list, and refusing to recurse further is the safe direction.

The cost of that cap is worth stating in the direction it actually falls: an option nested deeper
than the cap is **never** recognised, so a form using one refuses the user's own choice — the defect
this record fixes, returning at a depth no option list reaches. It does not fail the other way: two
options that differ only below the cap are not called equal, because the cap answers "different"
rather than "same".

Dirty tracking is unchanged: `getChanges()` still compares leaves with `Object.is`, which the guides
document, and a field holding a re-picked equal object still reports itself changed. The two
questions are different — "is this the value it started with" and "is this one of the offered
options" — and only the second is about the option list.

## Alternatives rejected

**Key options by an id the consumer names.** Precise, and a new API: every option-based field, every
adapter and every document would have to say which member identifies an option, to fix a case where
the data already says it.

**Accept anything shaped like an option.** Passes the round-trip case and loses the reason `oneOf`
exists — a forged `{ id: 3, label: "Three" }` has the same shape as a real one.

**Document object options as unsupported with drafts.** Honest, and it contradicts the value
contract's own sentence, which is the stronger statement: the contract would have to say an option is
whatever the list holds *unless you also use drafts*.

**Compare structurally everywhere, class instances included.** It would make a copy of an entity
indistinguishable from the entity, which is a claim about a consumer's own types that this engine
should not make on their behalf.

## Verification

- `packages/core/test/core.test.mjs` — a round-tripped object option is accepted, key order does not
  decide it, and six forgeries are refused; a class instance keeps identity; arrays and dates inside
  an option are compared as data; `eachOneOf` behaves the same for a multiselect.
- `battle-tests/adversarial/persistence/option-identity.battle.test.mjs` — the attack that found it,
  with the refusal cases as its second half.

## Security and privacy

The guard is defence-in-depth and stays exactly as strong: what it refused before, it refuses now.
The change is what it *accepts* — a value carrying the same data as an offered option — and a client
holding the option list could always construct that value. The server must re-validate, as
[ADR 0009](0009-client-validation-is-defence-in-depth.md) states; nothing here moves that boundary.
