---
"@modyra/widgets": minor
---

Every presence condition says who decides it

`MDY_PART_PRESENCE` says, for each part, the condition under which it is on the page. Fourteen
conditions carry 185 declarations across the kinds, and three of them carry 85 — the three the package
publishes a way to *decide*. That is the direction of the causation rather than a coincidence: a
condition a consumer can ask about is the one consumers read, and the eleven with nothing are
declarations each renderer interprets for itself. It is how `valueIsPresent` came to mean one thing
where chips are drawn and another where they are not.

`MDY_PRESENCE_RESOLUTION` names, for each condition, what answers it or why nothing does. Two things
it makes visible that a blank could not:

`valuesOverflow` **was** answered — `hiddenChipCount` decides it and was not named as deciding it,
which is worse than a gap, because a consumer looking for the resolver finds none and writes a second
one beside the function that already answers.

And three conditions will never have one, so they say why. `documentDeclaresIt` asks whether the page
passed a label; the renderer holds that input and a resolver would put a call between a consumer and
a fact in their hand. `kindOffersIt` is answered by the catalogue a renderer already reads.
`pointerIsOnAValue` is knowable only by the renderer. Left blank they read as three gaps, and the next
person counting resolvers reports three decisions as findings.

Seven remain owed and are named as debts rather than absences. See ADR 0169, which states the rule
that decides which is which: a condition owes a resolver when two renderers could reasonably disagree
about the answer from the same state.

The check derives from the conditions, so a condition added to the contract has to be accounted for
before it can be declared on a part — and it holds one property as a property rather than a sentence:
if the declarations ever come to hang mostly off conditions nothing decides, the contract has grown in
the direction that made two renderers disagree, and somebody should know before it is measured by
accident again.
