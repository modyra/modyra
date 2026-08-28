# ADR 0169: Which presence conditions owe a resolver

Status: Accepted

## Context

`MDY_PART_PRESENCE` says, for each of 264 parts, the condition under which it is on the page. Fourteen
conditions carry 185 declarations. Three of them — `overlayIsOpen`, `errorsAreVisible`,
`fieldCanBeInvalid` — carry 85 between them, and are the three the package publishes a way to
*decide*. The other eleven carry 100 declarations and have nothing.

That is not a coincidence, and the direction of causation is the finding: a condition a renderer can
ask about is the one renderers and checks end up reading. The eleven without are declared, correct,
and connected to nothing — the shape `docs/contract-gaps.md` already names, and the shape that
produced today's other defects: a rule stated twice drifts, and a rule stated once with no way to
read it is stated twice the moment two renderers need it.

Counting checks that name a condition gives zero for all fourteen, which measures nothing:
`overlayIsOpen` is exercised thoroughly by specs that never write the string, because `overlayOnlyParts`
turns it into an answer. What can be counted is whether a consumer has a way to decide the condition
at all.

## Decision

**A condition owes a published resolver when two renderers could reasonably disagree about the answer
from the same state. Where the answer restates an input the renderer was already handed, a resolver
is ceremony and is not owed.**

By that test:

**Owed, and the answer is the contract's** — eleven conditions, of which three are already answered:

| condition | what decides it today |
|---|---|
| `overlayIsOpen` | `overlayOnlyParts`, `dynamicPartsOf` |
| `errorsAreVisible` | `errorsVisible`, `shownErrors`, `visibleErrorsOf` |
| `fieldCanBeInvalid` | `fieldCanBeInvalid`, `showsAsInvalid` |
| `valuesOverflow` | `hiddenChipCount` — decides it, and is not named as deciding it |
| `undoIsOnOffer` | `wayBackSentence` reads the state; nothing answers the condition |
| `valueIsPresent` / `valueIsAbsent` | nothing. Not "is the value falsy" — a chip strip taught us that |
| `fieldIsRequired` | nothing. Not `handle.required()` alone: a marker on an out-of-play field is noise |
| `viewIsActive` | nothing. Which calendar view is showing is controller state |
| `inputWasRefused` | nothing. The file field's refusals live in its state and nowhere else |
| `workIsInFlight` | nothing. Loading and pending are two facts and this is one question |

**Not owed** — three conditions, because disagreement is not available:

- `documentDeclaresIt` (40 declarations, the largest). The question is "did the page pass a label,
  a supporting text, a prefix, a suffix". The renderer holds that input; a resolver would return
  `input !== undefined` and put a function between a consumer and a fact it already has.
- `kindOffersIt` (8). The question is whether *this kind* has an arrow, a box, a stepper — and the
  catalogue the renderer already reads to know the part exists is the answer. A resolver would
  restate `MDY_WIDGET_CONTRACTS[kind].parts`.
- `pointerIsOnAValue` (1). Only the renderer knows where a pointer is. No controller can answer it,
  and the contract should say that rather than promise it.

## Consequences

Seven resolvers are owed and do not exist. Until they do, seven conditions are declarations a renderer
must interpret for itself, which is the state that produced `valueIsPresent` meaning two different
things in two renderers before it was measured.

`hiddenChipCount` decides `valuesOverflow` and is not named as doing so. That is worse than nothing
missing: a consumer looking for the resolver does not find one and writes their own, beside a
function that already answers.

The three not owed become a stated exemption rather than an absence. A condition that will never have
a resolver should say so where the condition is declared, or the next person counting resolvers
reports three gaps that are decisions.

**This decides what is owed; it does not build it.** A record that decides and ships nothing is half
of the shape it criticises, and the honest form of that is to say which half is left rather than to
imply the work is done.

## Alternatives rejected

**Every condition owes a resolver.** Symmetrical and wrong. `documentDeclaresIt` is 40 declarations of
"did you pass this", and a resolver over it is a function nobody can misuse and nobody needs.

**Count checks that name a condition.** The first instrument, and it reports zero for all fourteen
including the three that are thoroughly exercised. A count of mentions measures how a check is
spelled, not what it covers.

**Leave the eleven and let each renderer decide.** The state today. It is how `valueIsPresent` came to
mean one thing where chips are drawn and another where they are not.

## Verification

None yet, and that is the point of the record: the check that would make a declaration mean something
is a page that reaches each condition's state *and its negation*, asserting the parts appear and
disappear. It cannot be built against "every condition" without deciding which conditions are
answerable, which is what this record settles so that it can be.

The three exempt conditions are the check's own control: a suite that asserts a resolver for all
fourteen would be asserting ceremony for three of them, and would be satisfied by three functions
nobody calls.

## Security and privacy

None. A presence condition decides whether a part is drawn; none of the fourteen reads or carries
anything a viewer could not already see. Worth one line on the adjacent risk: `errorsAreVisible`
governs whether a refusal is shown, and a refusal can carry what a server said about a value — that
is ADR 0165's territory and unchanged here.
