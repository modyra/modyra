---
"@modyra/studio-ui": minor
---

Studio lays out for a screen size, and shows you that size while you do

There was no way to say what a form does on a phone. The canvas was one width, a row's track count
was whatever the row's column count happened to be, and every arrangement applied everywhere.

The toolbar gains **base / sm / md / lg**, and it both authors and previews:

- **Previews** — the canvas narrows to that breakpoint's width, so the foundation's own media queries
  decide the arrangement rather than Studio predicting it. What you see is what the form does.
- **Authors** — `base` edits the arrangement itself; the other three write overrides for that size
  only. A form composed without ever touching the selector is unchanged, and produces the same
  contract it did before.

Three things are authorable per size, which is what a layout actually needs:

- **How many across** — a select on a row's field, bounded by the columns the row has.
- **Where a field sits** — `←` / `→` (and `Alt+←/→`) move a field between columns. At `base` that
  rearranges the row; at any other size it writes that field's column at that size and leaves every
  other size alone. Otherwise moving a field on a desktop would move it on a phone, and there would
  be nothing per-breakpoint about it.
- **Whether it shows** — an eye on the field's action bar. Turning it back on at a larger size writes
  an explicit "shown" rather than removing the entry, because a size that says nothing inherits the
  smaller one — "hidden on a phone, shown from tablet" needs the tablet to say so.

The selected size is view state, deliberately outside the command history: which width you are
looking at is not an edit, and undoing one must not also move you to another screen.

Studio's canvas widths are restated rather than imported — studio-ui depends on no renderer contract
package — and a test in `@modyra/widgets` fails if they drift from `MDY_LAYOUT_BREAKPOINTS`, since a
canvas previewing `md` at a width the foundation does not switch at would show an arrangement the
shipped form never produces.
