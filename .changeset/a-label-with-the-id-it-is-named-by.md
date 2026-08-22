---
"@modyra/lit": patch
---

A label with the id it is named by, and an opener that names the view on screen

Two references in lit pointed at nothing the moment a person opened a calendar's month or year view.

- **The label had no id.** A popup's inner view is labelled by the field's own label —
  `aria-labelledby="<widget>__label"`, which the projection emits for every calendar view — and lit's
  label only carried an id when a caller passed one. Every one of those references dangled. The label
  now always carries the id it is named by, and keeps its `for` as well.
- **`aria-controls` was fixed on the day grid.** The grid is one of three views: choosing a month or a
  year replaces it, and the opener went on naming an element that had been taken away. It names
  whichever view is on screen.

A reference that goes stale on a view change is the same defect as one that was never right — an
assistive technology follows it and arrives nowhere.
