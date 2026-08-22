# ADR 0134: The projection decides an id, and every renderer applies it

Status: Accepted

## Context

The three renderers disagree about which parts carry an id. Measured across four kinds with a popup:

```
select        mdy-label                       plain none   lit id     angular none
multiselect   mdy-label                       plain id     lit id     angular none
              mdy-multiselect__options        plain id     lit none   angular none
datepicker    mdy-label                       plain id     lit none   angular none
              mdy-datepicker__cell            plain id     lit none   angular none
timepicker    mdy-label                       plain id     lit id     angular none
              mdy-timepicker-segment-input    plain id     lit none   angular none
```

An id is what an `aria-controls` points at, what an `aria-labelledby` names, what an
`aria-activedescendant` resolves to, and what a consumer's stylesheet selects. **The projection already
computes these ids** — `idFactory.part(widgetId, name)` — and already emits attributes that name them.
What each renderer decides, separately, is whether to put the id on the element.

So an `aria-labelledby="<widget>__label"` emitted by a projection resolves in one renderer and points at
nothing in another, and neither the projection nor the consumer can tell which. That exact defect was
repaired in lit's calendar earlier: the label carried no id, so every reference the calendar-view
projection emitted pointed at nothing. The same hole is open in Angular for every kind.

## Decision

**Where the projection emits an id, the renderer applies it. Where it does not, no renderer invents
one.**

The projection is the single authority on a part's id, as it already is on the attribute that names
it. A renderer's job is to put the two on the same element.

This is deliberately **not** *every part gets an id*. Ids on parts nothing references are DOM weight
and contract surface for no reader. The rule adds no id that the projection was not already computing;
it removes the freedom each renderer had to drop one.

## Consequences

The class closes rather than the instance. Making three renderers agree about the label — the one
provably broken today — leaves them free to diverge on the next part a projection names, and this
register would meet the same finding again under a different number. Binding the renderer to the
projection removes the disagreement wherever it can occur.

It also puts this defect in the family it belongs to. **The recurring root cause across this whole
migration is a renderer keeping a parallel copy of something the contract owns** — a hand-written
`aria-haspopup` at ten openers, a local `_open` the controller never saw, an index Angular moved before
asking what to take, `dialHandLength` measured from an element whose size depends on the answer. An id
each renderer decides for itself is the same shape, and the same repair: ask the thing that already
knows.

A renderer that forgets becomes visible rather than silently different, because
`an-id-one-renderer-publishes-alone.spec.ts` compares the three against each other.

What it costs: a renderer can no longer omit an id it considers unnecessary. If a projection emits one
that nothing uses, that is a defect in the projection and is where it should be fixed.

## Alternatives rejected

**The narrow reading — only parts something references need an id**, and repair the label alone. It
fixes what is provably broken and it is the cheaper change. Rejected because it leaves the mechanism
that produced the defect intact: three renderers each deciding, so the next part a projection names
will diverge the same way and nobody will notice until an attribute resolves to nothing again. The
label is not the finding; the disagreement is.

**Every part carries an id.** Symmetrical and wasteful — ids nothing reads, on every kind, for a
consumer to trip over. It also does not follow from anything: the projection is what knows which ids
matter, and this alternative ignores it.

**Leave it and document that ids are renderer-specific.** Would make the contract's own attributes
untrustworthy: a consumer reading `aria-labelledby` off the projection cannot know whether it resolves
in their adapter.

## Verification

`an-id-one-renderer-publishes-alone.spec.ts` — four kinds, three renderers, red in all four today. It
asserts the three **agree**, not which parts should have ids, so it goes green whichever way the
agreement is reached and stays honest if the projection's set changes.

`an-id-a-selector-cannot-reach.spec.ts` carries the companion premise: an id that resolves by
`getElementById` and not by a selector is a different defect, and its premise assertion separates *no
ids at all* from *ids a selector cannot reach*.

The check that fails if this is violated quietly: a renderer applying the projection's ids everywhere
except one part. The comparison is per part, so one omission shows.

## Security and privacy

No impact. An element id carries no data and grants no capability.
