---
"@modyra/widgets": minor
---

A month you can walk sideways

The calendar keyboard declared `ArrowUp` and `ArrowDown` and not the horizontal pair, so a person
walking a month with the keyboard could move up and down a column and never along a row. All three
renderers answered `ArrowLeft` and `ArrowRight` anyway — a grid that cannot be walked sideways is not
a grid — which is three implementations agreeing against a declaration, and that is evidence about
the declaration.

`ArrowLeft` and `ArrowRight` move by a day where the vertical pair moves by a week, which is what the
two axes of a month are.
