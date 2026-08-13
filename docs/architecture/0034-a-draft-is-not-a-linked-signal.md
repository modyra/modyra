# ADR 0034: A draft is not a linked signal

Status: Accepted

## Context

Four controllers seeded a signal from their field handle and maintained it by hand: the option
field's selected key, the colours field's text, and the drafts of the timepicker and the range
picker. The question raised was whether the reactive contract should grow a *linked signal* — a
writable signal that resets when a source it derives from changes — since that is the shape all four
appeared to want.

Measured, they were not one shape but three.

**Two were caches, and stale.** `selectedKey` was written beside every commit, and selecting always
writes both it and the value, so it carried nothing the value did not — except the chance of
disagreeing with it. A value arriving from anywhere else (a draft restored, a server response,
`patch()`) left the state reporting the live value beside a stale key, and the option renderer
decides which radio is checked from the key. The colours field had the same defect in its text.

**Two are drafts, and correct.** The timepicker's and the range picker's drafts do not follow the
value while the popup is open, and that is the point: a draft is what protects a choice in progress
from what arrives elsewhere. They are re-seeded from the value on *open*, which is the moment the
user starts choosing.

The contract also carried `capabilities.writableComputed`, declared on `MdyReactivityCapabilities`,
answered `false` by every one of the eight adapters, and read by nothing.

## Decision

**A value derived from a handle is a computed. A value that must survive what arrives elsewhere is a
draft, reset by the event that starts it — never by its source.**

`linked` does not enter `MdyReactivity`. Applied to the two caches it would be a heavier answer than
`computed`, which removes the staleness outright; applied to the two drafts it would be *wrong*,
because resetting on a source change is exactly the yank a draft exists to prevent — a calendar
jumping to a range that arrived from the server while the user is choosing one.

`capabilities.writableComputed` leaves the contract. A capability every implementation denies and no
consumer asks about is a question nobody closed, not an ability anyone has.

## Consequences

`MdyReactivityCapabilities` loses a required member, so every adapter that spelled `writableComputed:
false` deletes the line — a breaking change to a published type with no behavioural half, since
nothing read it.

The two drafts keep an explicit reset in their `open` intent. That is more code than a declarative
link and it is the code that says *when* a draft restarts, which is the part a reader needs.

A future primitive of this kind is not foreclosed, but it arrives with a consumer: eight adapters
implement this interface, and the lesson recorded here is that a member added without one is answered
`false` eight times and read nowhere.

## Alternatives rejected

**Add `linked` and use it for all four.** It makes the two caches heavier than a computed and the two
drafts wrong. A primitive that suits neither group is a primitive chosen for its name.

**Add `linked` for the drafts alone.** The drafts do not want their source's changes; they want a
reset at a moment — opening — which is an event, not a dependency. `linked` would express the
opposite of the rule.

**Keep `writableComputed` and implement it.** Nothing asks for it. Implementing a capability to
justify its declaration is the tail wagging the dog, and eight implementations is the price.

## Verification

- `packages/widgets/test/state-follows-its-handle.spec.mjs` — writes a handle from outside a live
  controller and asserts every state field derived from the value follows. It is what found the two
  caches, and it runs over every controller, so a cache reintroduced anywhere fails by the name of
  the field it broke.
- The drafts' own controller specs assert that opening re-seeds from the value; nothing asserts that
  an external write during an open popup leaves the draft alone, which is stated here as the rule and
  left unguarded by a test. That is the gap this record knowingly carries.
- `npm run test:type-surface` classifies the removal of `writableComputed`.

## Security and privacy

None. The change concerns which reactive primitive expresses a derivation and removes an unread
capability flag; no value crosses a trust boundary differently, and nothing is stored or transmitted
that was not before.
