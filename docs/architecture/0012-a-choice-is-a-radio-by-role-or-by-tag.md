# ADR 0012: A choice is a radio, by tag or by role

Status: Accepted

## Context

`segmented` declares `elements: { option: "presentation" }`. The contract has no opinion about what
an option *is*, so a renderer emitting a `<div>` with a click handler conforms — and a screen reader
user gets a page of unlabelled text where a choice should be.

The gap was recorded as finding **J1** in `docs/contract-gaps.md`, alongside a strategy document that
framed the decision as *radio/radiogroup* versus *toggle buttons with `aria-pressed`*, and warned it
would be a major change to whichever renderers lost.

Reading the renderers dissolves that framing. All three already chose the same model:

| Renderer | What it emits |
| --- | --- |
| `@modyra/angular` | `role="radiogroup"` wrapping `<button type="button" role="radio">` |
| `@modyra/lit` | `role="radiogroup"` wrapping `<button role="radio">` |
| `@modyra/plain` | native `<input type="radio">` with a label |

Nobody implements toggle buttons. The catalogue already declares `roles: { group: "radiogroup" }`, so
the container is settled too. What was actually undecided is narrower, and it is the only question a
conformance check needs answered:

> Does an option have to be a **native** `input[type="radio"]`, or does `role="radio"` on a focusable
> element satisfy the contract?

Requiring native would make Angular and Lit non-conformant. Accepting the role would make Plain's
native control one valid implementation among several.

## Decision

A `segmented` option is a **radio**, satisfied by either the native tag or an explicit
`role="radio"` on a focusable element. The group is a `radiogroup`.

```ts
elements: { option: "radio" }   // tag OR role satisfies, as elsewhere in the contract
```

This is not a new rule. `packages/widgets/src/testing/dom-tests.ts` already states that a part may
satisfy its element "by tag or by an explicit role — a `div role="textbox"` is a control, and
refusing it would forbid every composite widget". Refusing `role="radio"` for one kind would
contradict that for no reason the evidence supports.

A `<div>` with a click handler and no role satisfies neither and is rejected. That is the whole point
of the change.

The keyboard obligations are contract regardless of the element chosen: arrows move selection within
the group, a roving tabindex means the group is one tab stop, and Space or Enter selects.

## Consequences

- No renderer changes. The contract constrains toward what all three already do, so this classifies
  **minor** and ships without a migration note.
- The contract can now reject a semantically empty implementation of a choice — which is what J1 was.
- Native radio behaviour is **not** guaranteed. A renderer using `role="radio"` owns arrow-key
  navigation, the roving tabindex and form participation itself, and the contract's keyboard rules
  are what hold it to that. Those rules are now load-bearing in a way they were not before.
- Two spellings of a conformant option remain, so a cross-renderer equivalence check must compare
  computed role, name and state rather than markup. That is more work than comparing tags, and it is
  the work the strategy document's own principle asks for.

## Alternatives rejected

- **Require a native `input[type="radio"]`.** The strongest guarantee: grouping, keyboard and form
  participation come from the platform rather than from each renderer's JavaScript. Rejected because
  it makes two shipped renderers non-conformant and forces a major release, to buy a property the
  keyboard rules already require and the e2e suite already asserts. Recorded because a future reader
  weighing accessibility risk will reach for it, and should know it was considered and priced.
- **Toggle buttons with `aria-pressed`.** A defensible model for a segmented control representing
  independent states rather than one exclusive value. Rejected as moot: no renderer implements it,
  and `segmented` carries a single value. Recorded because the strategy document proposed it and a
  reader finding that document should not re-open a settled question.
- **Leave `option` unconstrained and document the expectation.** This is the status quo, and it is
  the finding.

## Verification

- `packages/widgets/test/j-gap-blindspots.spec.mjs` — the assertion that a `<div>` option is accepted
  today inverts to an assertion that it is rejected.
- `npm run test:conformance` — Plain and Lit, both conformant spellings.
- `npx jest -c packages/angular/jest.config.cjs -t segmented` — Angular's own DOM contract spec.
- `npx playwright test e2e/keyboard.spec.ts` — a role change satisfies a DOM assertion easily and
  breaks real navigation just as easily, so the keyboard obligations are checked in a browser.
- `npm run contract:diff` — classifies the change; the expectation is `minor` and the tool decides,
  not the author.

## Security and privacy

No trust boundary is touched and no data moves. The real exposure is accessibility rather than
security: a control that is not announced as a radio is a control some users cannot operate, and
before this decision the contract permitted exactly that. There is no attacker model here.
