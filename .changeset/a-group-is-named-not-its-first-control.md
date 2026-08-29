---
"@modyra/widgets": patch
"@modyra/plain": patch
---

A group is named, not the first control inside it

Plain's field shell put the field's caption on the first control it found inside whatever a kind
handed it. For a radio group that is an arbitrary option: the caption was announced as the name of
"Small" and every other option had none. The shell's own comment records the same trap for a
multiselect's chip strip — a container of several controls is the thing being named, and the group's
role says so.

With that fixed, a date range's first box lost the name it had been getting by accident, which is the
half ADR 0175 had left: `MDY_PART_NAMES` now binds `daterange.startControl` beside `endControl`, so
each end says its own role and the group says the caption. The caption still points at the first box —
that pointer moves focus when the words are clicked, which is a different job from naming.
