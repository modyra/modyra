# ADR 0194: A class that belongs to no kind

Status: Accepted

## Context

The class contract is answered by three doors, and until this record only two of them were written
down anywhere a reader would look. The per-kind catalogue answers a widget's own anatomy through
`partClasses(kind, part)`; the field-shell vocabulary answers the parts every field-like control
shares. A class belonging to *many* kinds and to no anatomy — an overlay panel, a button, the label
that rides above a filled control — has no home in either.

`MDY_SHARED_UI_CLASSES` is that third door, and it already existed. What it lacked was a record: the
reasoning lived in a comment above the array and in a conversation, so a survey of "what the contract
declares" that asked the first two doors and not the third reported thirty declarations as missing
that were already made.

That is not hypothetical. It is what this record is made of. A census of classes the renderers spell
by hand produced, in sequence, 37 → 38 → 8 → 2 candidates for the catalogue to adopt. Six
measurements of absence, and five were wrong in the same direction — understating what the contract
already had:

| what the measurement missed | what it cost |
| --- | --- |
| custom element tag names counted as classes | an undeclared floor in the ratchet |
| class names inside comments | a number that falls when prose is deleted |
| a class that is a prefix of another (`.mdy-control` inside `.mdy-control__errors`) | four classes reported as painted that no theme paints |
| `presentationClasses` | thirty already-declared classes proposed as new parts |
| `MDY_SHARED_UI_CLASSES` itself | eight already-declared classes proposed for a vocabulary that existed |

Every correction came from trying to write the thing rather than measuring its absence: the compiler
refused a duplicate declaration, a gate refused a stale exemption, a `RangeError` refused a part with
no semantic. **The compiler and the gates know what exists; a survey does not.**

## Decision

**The class contract has three doors, and which door a class uses is decided by what it belongs to.**

- **A part of one kind** goes in that kind's catalogue entry. It costs a **semantic**: `PART_SEMANTICS`
  must say which element it admits, and the contract throws without one — *a part the contract has no
  opinion about admits every element, which is not a contract.*
- **A presentation class** goes in that kind's `presentationClasses`. It names a box the widget draws
  and admits no element, so it costs no semantic. This is the cheap form and the right one whenever
  the contract has no opinion to state.
- **A class belonging to no kind** goes in `MDY_SHARED_UI_CLASSES`. It is not a part, declares no
  state and appears in no structure.

**The third door is published to themes and checkers, not to renderers, and that is deliberate.** It
lives behind `@modyra/widgets/vocabulary`, whose own contract says these tables *describe* the
contract rather than draw with it, and that a renderer needs none of them. Exporting it from the
package entry was tried and reverted: it made one name reachable from two subpaths, which the public
doors gate refuses, and it would have offered a renderer a table the design says it should not read.

## Consequences

A survey of what the contract declares must ask all three doors. One that asks two will report
already-declared names as missing, and the direction of that error is always the same — it invents
work. The census and any future skeleton generator must know every door, or a descent will look like
it never happened.

The cheap door is also the quiet one. A presentation class states nothing about the element it names,
so a class parked there rather than declared as a part buys silence about its semantics. That is the
correct trade for a box and the wrong one for anything a person operates, and nothing enforces the
difference — it is a judgement each entry makes.

## Alternatives rejected

**One door for every class.** A single flat vocabulary would answer every question and lose the one
that matters: whether a name is anatomy a renderer must draw, or a box a theme may paint. The
catalogue's value is that a part carries a semantic; folding shared classes into it would either
force semantics onto boxes that have none, or weaken the rule for parts that need them.

**Declare shared classes per kind.** Seventeen copies of `mdy-button` is seventeen places to
diverge, which is the defect this whole batch exists to remove — and the reason the third door was
created in the first place.

**Export the shared vocabulary from the package entry.** Tried, and the gates refused it twice: a
name reachable from two subpaths is ambiguous, and the granular door already names the domain. The
premise behind trying — that a renderer needs these classes — contradicts the vocabulary door's own
stated design.

## Verification

`test:public-doors` refuses a name reachable from two subpaths, which is what caught the attempt to
publish this vocabulary twice. `test:contract-coverage` refuses an exemption for a class the contract
now declares, which is what caught the two allowlist entries this batch made stale.
`test:themes` compares what the renderers emit against what the themes paint, and `contract:diff`
records the shared classes alongside the per-kind ones so a rename is reported rather than silent.

What stays unguarded: nothing checks that a class went through the *right* door. A part declared as a
presentation class passes every gate here, and the only signal is that it states no semantics.

## Security and privacy

No security impact. The decision concerns which table a class name is declared in; no data crosses a
boundary, nothing is persisted, and the names are already public in the stylesheets that select on
them.
