# ADR 0030: A declared fact survives composition

Status: Accepted

## Context

This library asks its users to compose: schemas out of fields and sections, validators out of
validators, forms out of both. Composition was not, however, something the code did — it was
something each caller did again.

Two shapes of the same fault:

**Facts did not survive combination.** `required()` hung a marker on its function so a field could
drive `aria-required`; `min()` later hung a bound on its own, so a control could offer a range.
`compose()` knew about neither. `compose(required(), maxLength(3))` therefore produced a field that
was **not marked required** — no `aria-required`, nothing for a screen reader — silently, and had
done since `compose` existed. The same silence swallowed every numeric bound behind a composed rule.

**Conditions were composed three times.** *Out of play if any of them says no* was written in the
schema registration and once in each collection manager. Three copies is how one came not to know
about the others: a `record()` inside a `group({ when })` stayed in play while the section was
closed, including rows already declared.

Underneath both: **a constraint declared once was reaching only half its destinations.** A data-only
document declared `maxLength` and turned it into a validator, and no renderer ever wrote
`maxlength=` on an input — so a fifty-character field let someone type five hundred and told them
afterwards. A typed schema could not even declare it.

## Decision

**A rule declares what it enforces, and a declaration survives every way of combining it.**

- `validator-facts.ts` owns what a rule can declare — required, min, max, step, lengths, pattern,
  and the input type a rule implies — and how two declarations add up: required if **any** is,
  tightest bound wins, non-finite ignored, and two different patterns cancel because an input
  carries one and their intersection is a rule nobody wrote.
- Every combinator carries the sum of its parts. A composed rule is not opaque.
- A field reports the total as `constraints`, and every renderer offers what its kind can carry —
  translated in `@modyra/widgets`, once, so three renderers cannot answer differently and a fourth
  cannot forget.
- `conditions.ts` owns *out of play if any says no*. Callers say **which** conditions apply; they do
  not say how they combine. A collection is handed the sections it sits under, because a manager
  knows its own path and nothing above it.

**The boundary is the model.** Native attributes constrain typing. A value arriving from a draft, a
server or `set()` is kept whole and judged by the rules — the same promise ADR 0029 makes for a
value a widget cannot display.

## Consequences

Two modules exist that did not, and one indirection: a caller wanting to know why a field is out of
play reads `conditions.ts` rather than the site that registers it.

`compose(required(), …)` now marks fields required that were not marked before. That is a
**behaviour change in the right direction** — those fields were required all along, and were failing
to say so — but a form that counted `aria-required` attributes will count more of them.

A fact describes the rule, not the outcome: a `compose` containing `required()` in a branch that
never runs still marks the field. Any other answer would mean evaluating rules to find out what they
declare.

Constraints reaching the input changes what a user can type where a `maxLength` exists. That is the
point, and it is why the model boundary is stated as loudly as the mechanism.

Adapters that build their own validators (`@modyra/zod`, `@modyra/standard-schema`) now emit facts
too, so an external schema reaches the keyboard without being rewritten — and they must keep to the
same rule: only what has a native counterpart, never an approximation of it. Zod's exclusive bound
is the worked example: `min="10"` would admit exactly the value `.gt(10)` refuses, so it is not
offered.

## Alternatives rejected

**Keep the traps and document them.** They were documented — that is where this started. A guide
that warns about `compose()` losing your bounds is a guide apologising for the code.

**Let each renderer map constraints to attributes.** That is what was already happening for
`min`/`max`, and it is why `maxlength` reached nothing: three implementations, three chances to
forget, and no way for a fourth renderer to discover the rule.

**Evaluate rules to discover their constraints.** A validator's errors say what a value did wrong,
never what the rule is; and a rule that passes for the current value would declare nothing at all.

## Verification

- `packages/core/test/field-constraints.test.mjs` — facts through `compose`, `composeFirst` and
  nesting; tightest-wins; conflicting patterns cancelling; a rule with no native counterpart
  declaring nothing and still running.
- `packages/core/test/conditional-fields.test.mjs` — a collection inside a closed section, **with
  rows already declared**, which is the case that says whether the composition is real or the defect
  merely moved.
- Native attributes asserted in all three renderers, each with the model boundary alongside:
  `packages/plain/test/native-constraints.test.mjs`,
  `packages/lit/test/native-constraints.test.mjs`,
  `packages/angular/src/lib/renderers/native-constraints.spec.ts`.
- `packages/zod/test/native-constraints.test.mjs` — an external schema crossing over, and the
  exclusive bound that deliberately does not.
- `packages/core/test/diagnostics.test.mjs` — every diagnostic asserted **in both directions**,
  because a warning that also fires in the ordinary case is noise, and noise gets switched off along
  with everything useful.

## Security and privacy

Native constraints are a convenience for the person typing, never a control. Every one of them is
also a rule that runs on the value whatever its origin, and the server remains the authority — see
`docs/guides/security.md`. Nothing here narrows what the model accepts, so nothing here can be
relied on to keep a value out.
