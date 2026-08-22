---
"@modyra/styles": patch
---

Four marks survive a forced palette.

When a person turns on a high-contrast palette, the system replaces backgrounds, borders and text
with colours it guarantees. Two techniques in this sheet conveyed meaning by colour alone and both
came out blank:

- **A mark made by masking a coloured box.** The mask survives — the shape machinery is untouched —
  but the box it clips is repainted the surface colour, so the mark is still being drawn, in the
  colour of what is behind it. The chip's remove and move marks are drawn that way. A comment beside
  them claimed a mask "takes the system's own colour"; measured, only the shape survives, and the
  comment has been corrected.
- **A box that is only a fill.** The toggle's thumb, and the slider — whose line is a gradient, and a
  forced palette drops background *images* outright. Its track and its handle both vanished, leaving
  a control that keeps its size, its name, its role and its keyboard with nothing on screen, for
  exactly the people who turned the palette on because they could not see well enough without it.

Repainted in the system's own text colour, which a forced palette keeps. The slider's line is drawn
as a border and its handle where the platform actually puts it, because neither survives as a
background.

Not `forced-color-adjust: none`: that opts the element out of the palette and keeps our colours for
the one person who has said they cannot use them.
