---
"@modyra/widgets": major
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A selection announces the change, not the whole list

The live region said `"2 selected: Roma, Milano"` — the entire selection, every time. That is wrong at
any size, not only at twelve: a polite region **queues rather than replaces**, so rapid clicking builds
a backlog of stale lists and the person hears a selection several actions out of date. The list is an
on-demand fact and belongs in the field's description, where a reader can ask for it; an event should
carry the event.

`multiselectAnnouncement` composes the delta and the new total — `"Roma removed, 1 selected"` — from
what changed rather than from what is. Three i18n strings carry the words.

**Silent while the popup is open.** The options there carry `aria-selected` and announce themselves,
so a region firing at the same moment makes every toggle speak twice. The chip row's own removals are
the case nothing else speaks for.

**And silent on arrival.** The baseline is seeded from what the field already holds: a value that came
with the form is not something the person just did, and announcing it on the first paint describes a
choice they never made.

**`Backspace` lands on the previous chip and `Delete` on the next.** Both used to land forward, which
is not what any text field on any platform does — and a strip of chips is close enough to a line of
text that people bring the expectation with them.

Fixes a defect in the same code: **plain gated every chip key on `reorderable`**, so moving between
chips and removing one did nothing in the default configuration — which is every field that never
asked to be rearranged. Only reordering is opt-in.
