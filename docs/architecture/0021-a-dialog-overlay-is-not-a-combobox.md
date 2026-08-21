# ADR 0021: A dialog overlay is not a combobox

Status: Accepted

## Context

`MDY_WIDGET_KEYBOARD` derives its bindings from what a kind *is*. Every kind with an overlay was
given the combobox opening pattern:

```ts
bindings.push({ key: "ArrowDown", when: "closed", intent: "open" });
bindings.push({ key: "ArrowUp", when: "closed", intent: "open" });
```

The comment above it says "the combobox pattern", and the justification reasons about arriving on the
first or the last **option** — `listboxNavigationIndex` answering `ArrowUp` with the last and
`ArrowDown` with the first.

Four of the kinds that received it hold no options at all. A calendar, a date range, a clock face and
a colour palette are dialogs a button opens; there is no list to arrive in, and the reasoning that
produced the rule does not survive being read next to them.

**Nothing implemented it, and that is the evidence.** `@modyra/plain`, `@modyra/lit` and
`@modyra/angular` all omit it, independently, and none of the three consults `keyBindingFor` for a
picker at all. Read as a defect it is the same oversight made three times by three authors. Read as a
contract error it is one rule applied where it does not belong, which also explains why nobody
noticed: the declaration described a behaviour no one intended.

It surfaced only when the conformance kit gained a browser mode and pressed the declared keys for the
first time. Before that the rule had never been asked of anything.

## Decision

**A kind gets the combobox opening keys if the catalogue says it holds a list.**

```ts
if ("listbox" in MDY_WIDGET_CONTRACTS[kind].parts) {
  bindings.push({ key: "ArrowDown", when: "closed", intent: "open" });
  bindings.push({ key: "ArrowUp", when: "closed", intent: "open" });
}
```

`select` and `multiselect` declare a `listbox` part. The four pickers do not. The test is the
catalogue's own statement about anatomy rather than a second list to keep in step with it — the
failure this repository has recorded under several letters is exactly a second table drifting from
the first.

**`NAVIGATES_OPTIONS` is the wrong question here and reads like the right one.** It contains all four
pickers, correctly: a calendar *is* walked with the arrow keys, inside its grid. That is a different
statement from the arrows reaching a list that is not on screen yet, and conflating them is what put
the rule where it does not belong.

**Escape and Tab still dismiss every overlay.** *(Amended by [ADR 0122](0122-a-picker-a-keyboard-can-commit.md): a popup that declares an `actions` bar keeps Tab, because a confirm button Tab cannot reach leaves the widget with no keyboard commit path. Escape is unchanged.)* Both are declared for any kind with an overlay and
both are now implemented by every picker in `@modyra/plain`. A dialog that ignores Escape is the one
unambiguous keyboard defect, and a panel still floating over a field the user has tabbed away from is
the same defect a moment later.

## Consequences

- **Eight bindings are withdrawn from the public contract**, which `contract:diff` classifies as
  major. Nothing implemented them, so no renderer changes and no user loses a key that worked — but
  the declaration was public and its removal is a break, and calling it anything softer would be
  deciding by preference rather than by the tool.
- **A consumer reading `MDY_WIDGET_KEYBOARD` to build a picker no longer implements two keys.** That
  is the point: the table is what an implementer builds from, and it was asking for work that the
  three reference renderers had all declined to do.
- **The catalogue's part list is now load-bearing for keyboard derivation.** A kind that gains a
  `listbox` part gains two bindings with it. That is intended — the coupling is to the fact that
  decided the rule — and it does mean an anatomy change can move a keyboard contract, which the
  snapshot will report.
- **The pickers still have no way to be opened from the keyboard other than Enter or Space** on their
  toggle, which is what a button does. That is the standard behaviour for a button that opens a
  dialog, and it is now what the contract says.

## Alternatives rejected

**Implement the arrows in all three renderers.** The reading where the contract is right and three
authors were wrong. Rejected on the evidence: the rule's own justification is about reaching an
option, four kinds have none, and three independent implementations declining the same rule is better
evidence about the rule than about the implementations.

**Leave it declared and record the divergence.** What the previous state amounted to, without anyone
having measured it. Rejected because a contract nobody implements teaches implementers to skim it,
which costs more than the two keys are worth.

**A new list of "dialog-style" kinds.** The obvious shape, and a second table stating something the
catalogue already states. Rejected on the failure this repository keeps finding: two declarations of
one fact drift, and the one nothing checks is the one that goes stale.

**Keep `ArrowDown` and drop only `ArrowUp`.** Splits the difference and is worse than either half: it
would leave the same widget behaving two ways depending on which key the user reached for, which is
the defect found in the multiselect policy in the same pass and fixed there.

## Verification

- `npm run test:conformance-browser` — the keyboard section presses every declared `open` and
  `cancel` binding in a real browser and reports **CONFORMANT, 8 of 8 sections**. Before this
  decision the same run reported 8 findings, one per withdrawn binding.
- `npm run contract:diff` — classifies the withdrawal as major, per binding and per kind.
- `packages/widgets/test/behavior.spec.mjs` — the multiselect policy opens on either vertical arrow
  and on neither `Home` nor `End`.
- Falsified rather than assumed: the browser section was what found this, and it found it by pressing
  keys nothing had pressed. The rule had been declared, correct-looking and enforced against nothing
  for as long as it had existed — which is the shape `docs/contract-gaps.md` opens by naming.

## Security and privacy

None. A keyboard binding table describes which keys a widget answers; nothing is stored, transmitted
or parsed differently, and no trust boundary is touched.

The accessibility impact is the substance, and it runs both ways. Withdrawing two keys from four
kinds takes nothing from a keyboard user, because no renderer offered them. What the same pass fixed
does reach one: `@modyra/plain`'s datepicker did not close on Escape while its two siblings did, so a
user who opened a calendar from the toggle and pressed the one key every dialog must answer was left
holding it.
