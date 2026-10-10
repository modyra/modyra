---
"@modyra/vue": patch
---

`MdyTimepickerField` shows the time it holds, judges a typed time, and commits on Enter

- The box shows the controller's `display`: the held time in the field's notation, or the text it
  could not read. It used to show only unreadable text, so it was blank whenever the field held a
  time.
- A typed entry goes through the controller's `type` intent with a `parseEntry`. A readable time
  is committed and an unreadable one is kept and explained. Before, it was a draft that never
  reached the field.
- Enter inside the dialog confirms, following the `commit` binding. Enter on a button keeps its
  own meaning.

No migration.
