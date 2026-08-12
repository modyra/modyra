---
"@modyra/core": minor
"@modyra/angular": minor
"@modyra/lit": minor
---

Every kind consumes the controller written for it — and the registry that made one of them silent

Adoption reaches 45/45 and projections 48/48. The last two were the clocks: both
kept the draft the timepicker's controller owns, which is the one kind whose value
contract says `confirm`, so the draft is real and belongs where the contract put
it.

**`registerHandleOwner` is public.** `observerFor` was already, and it reads a
registry nothing public could write to — so an adapter building a handle of its
own could not say which runtime owns it. Angular's declaratively named controls
build exactly such a handle, registered it in the neighbouring *form* registry by
mistake, and `observerFor` fell back to a vanilla runtime whose signals an Angular
computed cannot see. The controller's state changed and the template never
re-rendered: the clock's hand would not move, and nothing failed anywhere else,
which is the silence that registry exists to end.

`applyWidgetCommands` joins the Lit overlay runtime. Which command opens a popup,
closes it and gives focus back is the same three for every kind, and the three
renderers that adopted a controller had written the loop identically.
