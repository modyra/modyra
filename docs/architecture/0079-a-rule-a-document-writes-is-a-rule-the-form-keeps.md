# ADR 0079: A rule a document writes is a rule the form keeps

Status: Accepted

## Context

The Dynamic Form Contract has a `rules` array, and its type says what one is: *a rule fires an effect
on the field it names*. Four effects — `visible`, `hidden`, `enabled`, `disabled` — over ten
operators. The parser reads them as behaviour rather than as opaque data: an effect nobody declared,
an operator nobody declared, a target that is not a field, a condition on a field that is not there —
each is refused with `MDY_DYNAMIC_INVALID_RULE`, and in strict mode, whose documented promise is that
a partly valid document is never accepted, the whole document goes with it.

Nothing then applied one. Every reference to a document's `rules` in `packages/*/src` was inside the
parser: the type and its validation. No renderer, no Studio package, no exported function turned a
rule into anything, and `MountMdyFormOptions` had no way to carry them — the guide's own snippet,
`mountMdyForm(container, result.fields, { layout: result.layout })`, drops `result.rules` at the line
it teaches.

The guide said so, in one sentence: *"No renderer applies `rules` yet … visibility and enabled-state
are still the host's to apply."* That sentence is what makes this a gap rather than a lie, and it is
also what makes it worse than an omission: a host reading it has to reimplement ten operators and four
effects against a private predicate, and a host not reading it gets a form that quietly does none of
what its document said.

The measurable end of it is the payload. The same field, the same value, the same page, and the only
difference is which path disabled it:

| how `taxId` was disabled | what the form sent |
| --- | --- |
| through the field handle | `{"customerType":"person"}` |
| by the document's rule | `{"customerType":"person","taxId":"SSN-123-45-6789"}` |

A document saying *disable the tax id for a private customer* produced a form that sent it.

## Decision

**A rule becomes a binding on the form.** `applyDynamicRules(form, rules)` in `@modyra/core` is the
sibling of `buildDynamicValidations`: the slot that was already read as behaviour now has a way to
become behaviour, through the bindings the engine has had all along.

**The four effects are two pairs over one difference.** `visible`/`hidden` reach `setInactive` — a
field out of play is not asked for, not validated and not submitted. `enabled`/`disabled` reach
`setDisabled` — the field is asked for and cannot be answered. Those are different promises and the
contract's four words are exactly that distinction, twice.

**Applied, not returned.** A validator can be handed back for a caller to install; a rule names a
field, so it is a binding on that field and there is nothing to hand back.

**One signal per field per effect.** The engine's binding replaces rather than accumulates, so two
rules naming one field would leave only the last. They compose: the field is out while *any* rule that
names it says so.

**`evaluateRuleCondition` is public and lives in `expression.ts`.** The rule predicate is flat — one
field, one operator, one value — and its vocabulary is wider than the expression tree's: `in`,
`notIn`, `greaterThanOrEqual` and `lessThanOrEqual` exist only here. Putting it beside
`evaluateExpression` is what stops the two forms drifting about what `isEmpty` means, and publishing
it is what lets a host that renders its own controls ask the same question the binding asks.

**An operator nobody declared answers `false`,** as an expression's does. A question with no answer is
not answered with the one that opens the field.

**Comparisons are between two numbers or two strings.** ISO dates sort as strings, which is what makes
a date rule work without a date type; anything else is not ordered, and a comparison against it is
`false` rather than a coercion nobody asked for.

## Consequences

**A form built from a document behaves differently.** That is the repair, and it is a behaviour change
for anyone who was passing rules and relying on them doing nothing. Nobody could have been relying on
them doing something.

**A host must pass them.** `mountMdyForm` applies `options.rules`; a host that does not pass them gets
what it got before. The guide and the usage-modes snippet now pass them, and the sentence saying no
renderer applies rules is gone.

**`@modyra/lit` and `@modyra/angular` do not have this door yet.** Neither has a document-mounting
entry point of its own; both reach the same core function on the form they build. Stated so it reads
as a gap with a name rather than as a silence.

**The condition is evaluated over the whole form value.** Every rule's signal recomputes when any
field changes. For a document-sized form that is what the engine's own conditions already cost; for a
very large one it is a known cost with an obvious refinement — read only the field the condition names
— left undone rather than guessed at.

## Alternatives rejected

**Declare `rules` unsupported and strip it from the contract.** It is published, documented, carried
in the guide's worked example, and guarded by the parser as behaviour. Removing it makes every
document that uses it invalid and leaves the generated-forms guide teaching a shape the library
refuses.

**Return the rules as data for the host to apply**, matching what the guide said. It leaves every host
reimplementing ten operators against a predicate they cannot see, and the first thing each of them
gets wrong is the one this record exists for: that `disabled` changes what is sent.

**Apply them in the renderers instead of in core.** Three renderers, three implementations, and the
one thing a rule decides — whether the field is in play — is the form's word, not the page's.

## Verification

- `packages/core/test/expression.test.mjs` — every declared operator answered, an undeclared one
  answering `false`, both effects reaching the payload, and two rules over one field composing rather
  than replacing. The control in that test is the same document built without rules, which sends
  everything.
- `battle-tests/adversarial/dynamic-contract/a-rule-that-fires-on-nothing.battle.test.mjs` and
  `battle-tests/browser/a-rule-that-fires-on-nothing.spec.ts` — the attack that found it, end to end
  on the documented mount path.
- `examples/plain/panels/dynamic.js` — the panel drives a `visible` rule and prints each rule's own
  answer beside the parse.

## Security and privacy

This closes a way for a value to be sent that a document said to withhold. A rule cannot name a field
the document did not declare — the parser refuses that — and cannot run anything: the predicate is a
fixed operator over a named field and a literal, with no expression, callback or pattern. The
comparison operators do not coerce, so a rule cannot be made to answer about a shape it was not given.
