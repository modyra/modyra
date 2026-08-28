---
"@modyra/widgets": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
"@modyra/react": minor
"@modyra/preact": minor
"@modyra/vue": minor
"@modyra/svelte": minor
"@modyra/solid": minor
---

One live region for the page, and announcing became a queue

Eight adapters each named a live region of their own — `mdy-plain-announcer`, `mdy-lit-announcer`,
six more. Eight literals, declared by nothing, so a page carrying two renderers carried two
`aria-live="polite"` regions.

**Two regions speaking in the same instant are read in an order nothing specifies.** Every screen
reader has its own policy and no specification fixes one, so one announcement cuts the other off
partway. One region loses a message the same way — but a queue can only stand in front of one region,
and with two there is nowhere to put it.

`MDY_SHARED_REGION_ID` and `MDY_SHARED_REGION_ATTRIBUTE` are now exported. The attribute was already
declared in the contract and was not published, so the one part of this that had been decided could
not be read.

Announcing is now queued rather than written, which fixes three things a plain write does not:

- **the region exists before the first message.** A reader announces a *change* to a region it
  already knows; one created and filled in the same instant is met already full, and the first
  announcement of a page is the one most likely to be lost;
- **the same words twice running are said twice.** The region is cleared and written a turn later, so
  a repeat is a change. Written over itself it is silent;
- **two messages in one instant are both heard** instead of one overwriting the other.

No adapter names a region any more. `createMdyAnnouncer()` and `MdyCommandRuntimeOptions.announcerId`
default to the contract's id; `announcerId` is still accepted, and passing one means keeping a second
region on the page with everything above.

The cost: announcements from two renderers now serialise, so a burst finishes slower than a burst
that overwrote itself. And messages that should *replace* rather than queue — "2 results", "3
results", "4 results" as someone types — still queue, because `announce` carries no category to
decide on. That is a real defect for anything announcing per keystroke.

See ADR 0163.
