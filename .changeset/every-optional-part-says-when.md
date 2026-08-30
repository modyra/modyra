---
"@modyra/widgets": minor
---

Every optional part says when it is on the page — all 195, with nothing exempted

**`MdyPartPresence` gains five members.** A consumer switching exhaustively over the vocabulary must
handle `valuesOverflow`, `undoIsOnOffer`, `inputWasRefused`, `pointerIsOnAValue` and `workIsInFlight`.

`optional` said a renderer *may* leave a part out and stopped there, so three renderers each decided
when to build it and conformance had nothing to ask. Every optional node in the contract now answers:
195 of 195, from each kind and from both shells.

The last eight were the ones with no word for their rule, which is why they were left. Each is
present under a fact of its own, and each of those facts is real enough to name:

- `overflowCount` under **`valuesOverflow`** — a count reading "and four more" says nothing while they
  all fit, and that is not about how many are chosen but about how many are on screen;
- `wayBackAction` under **`undoIsOnOffer`**;
- `rejected` under **`inputWasRefused`** — not an error about the value, because there is no value: a
  file of the wrong type never became one, and saying so is a different message in a different place
  from a rule the value broke;
- `chipTooltip` under **`pointerIsOnAValue`**;
- `loading` under **`workIsInFlight`**;
- `submitFalse` and `formErrors` under **`kindOffersIt`**, and `formErrorItem` under
  `errorsAreVisible`. A form can always be refused — a failed call, a service that is down — so its
  error container belongs to the shape, and only its contents follow the refusals.

Every one was read out of the renderer that draws it and then confirmed against a rendered page.
`loading` is the clearest: absent at rest, on screen once the field says it is loading. `submitFalse`
carries no class of its own, which is why a sweep by class had reported it absent while it was there
all along.

`MDY_FORM_SHELL_STRUCTURE` reads the same table as every other anatomy. It is small enough to have
been written out by hand twice over, which is exactly how two declarations of one rule begin.

**The check is a floor now, not a baseline that may only shrink.** A shrinking list is the right shape
for a gap being closed in batches and the wrong one for a closed gap: it leaves somewhere to put the
next exception. `packages/widgets/contract-baseline/parts-without-a-when.json` is gone.
