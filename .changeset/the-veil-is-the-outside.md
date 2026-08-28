---
"@modyra/widgets": minor
---

A press on a panel's dimming veil dismisses it

The veil is drawn as the panel's **sibling inside the same portal**, and the rule that decides
whether a press happened inside the overlay counts everything in that portal as inside. So a press on
the darkened area — the one gesture a person reaches for to close a modal — was read as a press
inside the panel, and the panel stayed open. With no pointer way out, only `Escape` remained, which
not everybody knows.

`MDY_BACKDROP_ATTRIBUTE` is exported, and `overlayBranchContains` answers *outside* for the veil and
for anything drawn on it. It is the canonical outside; treating it as inside is the one answer it
can never have.

Found by a browser sweep that reported it against `daterange` on Angular, and confirmed as belonging
to none of them: the veil is drawn by the shared overlay layer, so every renderer that dims the page
had it. It only showed on one kind because that was the kind whose panel happened to be open when a
press landed on a veil another kind had drawn.

The check that came with it was green for the wrong reason first. Rooted at the panel, the veil is a
plain sibling and reads as outside with no rule at all — the fixture has to be rooted at the *field*,
with a trigger naming a panel that lives in a portal, because that is the shape the rule is written
about. Removing the guard did not fail the first version.
