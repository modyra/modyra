# ADR 0163: One live region for the page

Status: Accepted

## Context

Eight adapters each named a live region of their own — `mdy-plain-announcer`, `mdy-lit-announcer`,
`mdy-angular-announcer` and five more. Eight literals, no declaration, and a page carrying two
renderers carried two `aria-live="polite"` regions.

The contract already declared `data-mdy-shared-region`, "what marks a live region as shared by the
whole renderer rather than owned by one widget" — and did not export it, so nothing could read it.
The one part of this that was decided was unreachable.

Consulted outside the repository, in ordinary words, on whether several form renderers on one page
should share one region or keep one each. The answer, and the reasoning that decides it:

**Two regions speaking in the same instant are read in an order nothing specifies.** Every screen
reader has its own policy and no specification fixes one; with `polite` they queue in the order the
reader noticed them, which is not the order they were written. One announcement cuts the other off
partway.

One region loses a message the same way — two writes in one instant and the first is gone. The
difference is that **a queue can only be put in front of one region.** With two there is nowhere to
put it. That, not "one is tidier than two", is the argument.

**Identity belongs in the message, not in the region.** A reader speaks the text and never who wrote
it: two regions both saying "open" leave a person hearing "open" twice with nothing to attach it to.
"Città: elenco aperto" is the fix, and a second region is not. Once identity is in the message, one
region suffices — which also disposes of a region per widget.

Three properties of how readers work, none of which a plain write satisfies:

- a reader announces a **change** to a region it already knows, so a region created and filled in the
  same instant is often skipped — it is met already full, with nothing to read as a change;
- **the same text twice running is not a change** — writing "Errore corretto" over "Errore corretto"
  is silent;
- **two messages in one instant overwrite each other**, and one is lost.

## Decision

**One `aria-live="polite"` region per page**, at `MDY_SHARED_REGION_ID`, carrying
`MDY_SHARED_REGION_ATTRIBUTE`. Both are exported: a decision nothing can read is not one.

No adapter names a region. `createMdyAnnouncer()` and `MdyCommandRuntimeOptions.announcerId` default
to the contract's id.

**Announcing is queued, not written.** One message at a time; the region is cleared and written a
turn later so a repeat of the same words is a change; the next message follows after a gap.

**The region is created when the first announcer is built, not when the first message arrives** — a
region a reader has never seen is one it does not yet watch, and the first announcement of a page is
the one most likely to be lost.

The region is never removed. Ownership by a renderer that mounts and unmounts is what makes a second
renderer go mute, and re-creating it re-enters the never-watched case every time.

## Consequences

Announcements from two renderers on one page now serialise into a single stream, which is the point
and also the cost: a message now waits behind another instead of racing it. The gap is 150ms plus the
100ms before each write, so a burst is slower to finish than a burst that overwrote itself.

The queue is module-level. Two Modyra bundles on one page — different versions, no shared module
instance — have two queues writing to one region, which is worse than two regions: the writes
interleave. The region is found by document id, so the region is shared; the queue is not.

`announcerId` is kept and optional, so a renderer outside this repository keeps its own region and
keeps working. It is the setting that reintroduces exactly what this record removes.

**Not decided here: replaceable messages.** "2 results", "3 results", "4 results" while a person
types should replace rather than queue — the last one is the true one and the earlier two are a
countdown of stale facts. `announce(message)` carries no category to decide that on, so every message
queues. This is a real defect for anything that announces on each keystroke, and it needs an API that
says which messages supersede which.

**Not decided here: the assertive channel.** One `polite` and one `assertive` region per page is the
standard shape — two channels, not two copies. This library announces only politely today.

## Alternatives rejected

**One region per renderer, with each renderer's id declared in the contract.** The tidy version of
what was already there. It fixes the eight undeclared literals and none of the reason they were
wrong: two regions still have nowhere to put a queue.

**One region per widget.** A region carries no identity, so a dropdown saying "open" and a calendar
saying "open" are indistinguishable to a listener; and readers pay per region they watch, so ten
fields would mean ten. Rejected on both counts.

**Remove `announcerId`.** It is published, and an out-of-repository renderer may pass one. Removing an
option with nothing replacing it is a decision this change does not need.

**Reference-counted removal — the last renderer out deletes the region.** More correct in principle
and worse in practice: the region must exist before the first message, and a region that comes and
goes with mount cycles re-enters the never-watched case on every remount. A hidden 1px element that
outlives every renderer costs nothing.

## Verification

`packages/widgets/test/one-live-region.spec.mjs`, reading the DOM rather than the source: two
announcers built independently reach one region; the region exists and is empty before anything is
said; two messages in the same instant are both observed in the region, in order; two identical
messages are separated by a clear.

Falsified by planting four defects, each caught: writing straight into the region with no queue; not
clearing before writing; creating the region at the first message instead of at construction; giving
each announcer its own id again.

`npm run test:contract-coverage` no longer allowlists `mdy-plain-announcer`, `mdy-lit-announcer` or
`mdy-angular-announcer` — the three ids are gone from the DOM, and the gate reports a stale entry if
one returns.

The sampling in that spec can miss a value that lived between two samples, and it fails toward red:
a missed write makes the assertion fail, never pass. This host has no `MutationObserver`.

## Security and privacy

The live region is visually hidden but present in the accessibility tree and readable by any script
on the page, as it was before. Announcements are UI state — "list open", "3 results" — and a renderer
that announced a field's value would put that value in a shared, page-global element that other
renderers also write to. That was true of a per-renderer region too; consolidating does not change
what may be announced, and nothing in this library announces a value.
