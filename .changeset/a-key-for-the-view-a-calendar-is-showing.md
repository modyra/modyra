---
"@modyra/widgets": major
---

Declare a key for changing which view a calendar is showing

The months and years views are opened by two buttons in the calendar's header, and no key declared a
change of view at all: every intent the kind declares while open — the four arrows, `PageUp` and
`PageDown`, `Home`, `End` — moves *within* the view being shown. The act behind those buttons was
operable with a pointer and with nothing else, which is the species ADR 0198 names rather than the
affordance its month arrows are. ADR 0199.

The gesture is the platform's accelerator with the vertical arrows: out to the wider view, back in to
the narrower one. `primary` rather than a named `Ctrl`, so the calendar this follows is matched on
every platform — on a Mac the gesture is `Cmd`, and `matchesKeyGesture` resolves that once instead of
in each renderer. Declared where the two views are declared, so a kind that walks a grid without
having anywhere else to go does not get the key.

**Why this is major, and what to change.** `MdyKeyBinding.intent` has gained `"view"`. Writing a
binding is unaffected, but code that *reads* bindings and switches over the intent exhaustively will
stop compiling until it handles the new one — which is the intended warning and not a side effect:
this package's own reader failed exactly that way and had to be given the case. `MdyWidgetKeyIntent`
gains a matching `{ type: "view"; by: -1 | 1 }`. A `view` is not a `move`: nothing about the value
changes, only which of the kind's views is the one being walked.

`widgetKeyIntent` now takes the same `MdyKeyOrPress` its neighbour `keyBindingFor` already took,
where it took a bare key name. Existing calls passing a string are unchanged and still mean the bare
gesture — but a binding that declares a held modifier can only be reached by a caller that passes
what was held, so a caller wanting the view change must pass the press rather than the key name.

This release declares the binding; the renderers honour it in the next one. Until then the two view
buttons are still pointer-only — stated here so the declaration is not mistaken for the repair.
