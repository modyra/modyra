---
"@modyra/styles": minor
"@modyra/lit": patch
---

One overlay container for the whole catalog

A select's list, a calendar, a clock and a palette differ in what they hold, not in what holds
them. The container — surface, outline, radius, elevation, padding, scrolling and out-of-flow
placement — now belongs to `.mdy-popup`, which every `popup` part in the contract carries;
`.mdy-overlay` narrows to the portalled variant, adding only the viewport coordinates a popup
lifted out of its field needs.

Lit's date, range and time pickers drew their content straight into the overlay panel, so they were
the only popups in the catalog with a container of their own and no contract part to name it. They
now render the same `popup` part as everything else, and a Lit multiselect opens from anywhere on
its trigger rather than only from the search button — clicks that land on a chip or a step button
still belong to that control.

Verified in the browser: nine overlays across the Plain and Lit demos resolve to the same
background, outline, radius and padding.
