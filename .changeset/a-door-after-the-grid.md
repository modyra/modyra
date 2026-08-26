---
"@modyra/widgets": major
"@modyra/plain": minor
"@modyra/styles": patch
---

A colour panel offers a way to every colour, not only to twelve

The field took any colour typed into its hex box and offered twelve to anyone pointing. Two routes
into one field that did not arrive at the same place, and neither could see the disagreement: a person
who points had no way to learn that typing goes further, and a person who types had no way to see
where their colour sat among the ones offered.

The panel now holds a **thirteenth swatch** carrying the colour picked by hand — of exactly the same
kind as the twelve, so it can be selected and re-selected — and, **after the grid and outside it**, a
`Custom…` button that is always and only a door to the platform's chooser.

Two elements rather than one: a square that were a door when empty and a colour when full would do
different things depending on how it was set. Pressed full, either the chooser opens and the tint
cannot be re-picked, or it selects and the door is gone. ADR 0158.

**Migration.** `MdyI18nMessages` gains `colorCustomEntry` and `colorCustomValue`; a consumer with its
own message table supplies them. `colors` gains an optional `customEntry` part.

This lands in `@modyra/plain` first. Lit and Angular follow.
