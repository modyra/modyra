# ADR 0052: A widget announces only the states it has

Status: Superseded by ADR 0078

## Context

`widget-states.ts` holds two tables and states the rule they exist for in its own words: *"an
undeclared state asserted is as much a defect as a declared state unchecked"*, and *"`readonly` is
declared only where the concept means something: a control whose value is typed can be
read-but-not-written. A checkbox, a slider or a file input has no read-only rendering — it is either
operable or disabled."*

Three projections disagreed with it:

| kind | contract | projected |
| --- | --- | --- |
| checkbox | no `readonly` state, no carrier | `aria-readonly="true"` **and** native `readonly` |
| radio | no `readonly` state, no carrier | `aria-readonly="true"` on the group |
| daterange | no `readonly` state, no carrier | native `readonly` on both controls |
| text | declares both | both — correct |

The checkbox is the one that costs something. HTML defines `readonly` for text-entry controls and
**ignores it on a checkbox**, so a renderer binding it bound nothing and the box still toggled, while
`aria-readonly="true"` told a screen-reader user it could not be changed. The two halves failed in
opposite directions, which is worse than either alone: an omission would have left the control honest.

What makes this a gap rather than a disagreement is that half of it was already fixed.
`aria-readonly="false"` had been removed from these same kinds, with a comment naming the mechanically
applied ARIA shell as the cause. The reasoning was accepted; `"true"` simply still went out.

A second defect in the same projection: `aria-checked` was built as `String(state.checked)`,
unguarded, so a state carrying `undefined`, `null` or a string produced `aria-checked="undefined"` —
a value that maps to nothing in any assistive technology, on the single attribute that says whether
the box is ticked.

Found from outside by `battle-tests/adversarial/accessibility/undeclared-states.battle.test.mjs`,
which asks `stateCarriers` what the contract declares and compares it against what the projections
emit.

## Decision

**A projection emits a state only where `MDY_WIDGET_STATE_SUPPORT` declares it.** `readonly` is gone
from the boolean, chooser and range projections, in both halves — the ARIA attribute and the native
one. The kinds whose contract has the state keep both, and that is pinned so a later fix cannot sweep
them in.

A form that means *this cannot be changed* on a checkbox says `disabled`, which both halves
implement and which the support table already gives that kind.

**`aria-checked` holds one of the three values the standard allows.** `true` or `false`, decided by
`state.checked === true`. `mixed` is not produced: `MdyBooleanFieldState.checked` is a boolean and no
field in the engine has an indeterminate value, so a third token would describe a state nothing can
be in. If a tri-state checkbox is ever added, this is where `mixed` lands and the type is what has to
change first.

The projections are published, so the *state* is the caller's to supply and its shape is not this
contract's to guarantee. The *attribute value* is.

## Consequences

A renderer that displayed a read-only checkbox by binding these attributes now shows an ordinary
one. Nothing it was doing worked — the native attribute was ignored and the ARIA one was a claim the
DOM contradicted — but a theme selecting on `[aria-readonly]` for those kinds will stop matching, and
that is a visible change with no deprecation window.

The engine can still put a checkbox in `readonly` interactivity; what changes is that the widget
contract no longer describes it. A consumer who needs that distinction has `disabled`, or their own
attribute outside this contract.

`aria-checked` is now `"false"` for any state that is not exactly `true`, so a caller passing
`undefined` gets an unticked box announced rather than a broken attribute — wrong in a way an
assistive technology can read, instead of wrong in a way it cannot.

## Alternatives rejected

**Add `readonly` carriers to the table for these three kinds.** It matches the projections instead of
the contract, and it would have to answer what a read-only checkbox *is* — the table already answers
that: a disabled one. Making the table follow the code would also discard the reasoning that removed
`aria-readonly="false"` in the first place.

**Drop the ARIA half and keep the native attribute.** Keeps a `readonly` on a checkbox that the
platform ignores: the appearance of a guarantee with nothing behind it.

**Accept `"mixed"` when the state carries it.** Widens the projection's shape space past its declared
type to serve a state the engine cannot produce, and the next renderer guesses differently about what
else is accepted.

## Verification

- `packages/widgets/test/state.spec.mjs` — a boolean and a chooser project neither half of
  `readonly`; a text field projects both; `aria-checked` is one of the allowed tokens for every
  malformed state, and exactly `"true"`/`"false"` for the two real ones.
- `battle-tests/adversarial/accessibility/undeclared-states.battle.test.mjs` — the attack that found
  it, asking the published table what each kind declares.
- `npm run test:widget-contract` and `npm run contract:diff` — the widget contract is unchanged at
  17 kinds, version 1: this is a projection defect, not a contract change.

## Security and privacy

None. The accessibility consequence is the substance: a control announced as unchangeable that
changes when a user presses space is a failure of the one channel a screen-reader user has to know
what the form is doing.
