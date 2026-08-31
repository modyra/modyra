---
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A range reads the way a date does

Both ends of a date range now show the month named, in the reader's language and order, the way a
single date already did. Plain, Lit and Angular were each showing the raw ISO value in the two
boxes, so a range read differently from the date field beside it.

Two defects the change surfaced, both fixed here:

**Plain re-parsed the text it had written itself.** Leaving a box dispatched its contents back
through the entry parser so a half-written range survives the way out of the field. While the box
held ISO that round-tripped silently; a named month is not a format the entry parser reads, so
leaving the field cleared the range. The field now remembers what it wrote, and unchanged text is
not an entry. The single-date sibling never had this — its blur sends an intent, not text — so the
two were answering the same question differently.

**Lit echoed the value rather than the reading.** A range endpoint that parsed successfully wrote
the ISO string back into the box. It now writes what was understood, which is the point of echoing
at all: somebody who typed `04/03` sees which number was taken as the month while they are still
looking at it.

The calendar's month heading is unchanged, and the value stays ISO everywhere.
