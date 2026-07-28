---
"@modyra/widgets": minor
"@modyra/lit": patch
"@modyra/plain": patch
"@modyra/styles": patch
---

Fix the Lit select overlay and the controls around it, and put what was missing under contract:

- The open panel is positioned by the overlay contract, not by the anchored `top` the theme
  declares for a docked panel — in a later layer that override left the panel with both a `top` and
  a `bottom`, collapsing it to zero height.
- ARIA states are strings now, so `attributes["aria-expanded"] ? …` was always true; the Lit select
  read them as booleans and rendered an expanded, disabled trigger.
- The segmented control's segment count is part of the contract (`MdyPartContract.style`), so every
  adapter emits `--mdy-segments-count` and the theme's tick gutter is right everywhere; the modern
  theme no longer applies the radio group's `align-items: start` to the segmented bar, which had
  left every segment 18px tall inside a 44px control.
- The multiselect names its `placeholder` part, like the select, and always renders a trigger — an
  empty, unselectable box was the previous state with nothing chosen.
- Prefix and suffix are rendered only when something is projected into them.
- Listbox navigation is named in the contract (`listboxNavigationIndex`, which clamps) beside
  `optionNavigationIndex` (which wraps), so an adapter takes the right one rather than importing a
  lookalike.
