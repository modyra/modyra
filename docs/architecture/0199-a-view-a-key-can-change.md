# ADR 0199: The view a calendar is showing is one a key can change

Status: Accepted

## Context

ADR 0198 decided when a control drawn inside an open panel is a defect and when it is an affordance:
a pointer-only control that duplicates an act a declared key of the same kind already performs is not
a barrier, because WCAG 2.1.1 asks that the *function* be operable from a keyboard, not that every
control be.

Applied to the calendar's header, that rule produces one of each. The month arrows are an affordance —
`PageUp` and `PageDown` already move the month. The two buttons that open the months and years views
are the other answer, and 0198 recorded them as an open finding rather than excusing them:

```
datepicker/daterange, declared while open:
  Escape  Tab  Enter  commit@gridcell  PageUp  PageDown
  ArrowUp  ArrowDown  ArrowLeft  ArrowRight  Home  End
```

Every one of those moves *within* the view being shown. **No binding declares a change of view.** So
the act behind those two buttons had no keyboard path at all — the colours entry's species, not the
month arrows'.

The contract had already decided the shape of the repair without anyone noticing: `PART_SEMANTICS`
declares both alternate views as grids, so that a keyboard meets the same structure whichever view is
showing. The arrows already work *inside* each view. What was missing was the door between them.

## Decision

**The platform's accelerator with the vertical arrows changes the view: out to the months and then
the years, back in the other way.**

Declared as `intent: "view"` with the direction in `by` — `1` widens the scope, `-1` narrows it —
and `modifier: "primary"`, `when: "open"`.

`primary` rather than a named `Ctrl`, and that is not a detail. The precedent this follows is the
desktop calendar, and "the accelerator" is what that precedent means: `Ctrl` where the platform uses
it, `Cmd` on a Mac. The vocabulary already carries that distinction and `matchesKeyGesture` resolves
it once, so no renderer has to make the platform test for itself.

**The key was chosen by measuring, not by reading the code beside it.** Every bare arrow is spent
walking the grid, so the question was whether a bare declaration also answers a *held* press. Both
levels were exercised, and the renderer level was checked in all three:

```
matchesKeyGesture(bare ArrowUp, …)      contract      plain    lit    angular
  ArrowUp                                 true         MOVED   MOVED   MOVED
  Ctrl+ArrowUp                            false        —       —       —      (unmoved)
  Meta+ArrowUp                            false        —       —       —      (unmoved)
  Shift+ArrowUp                           TRUE         MOVED   MOVED   MOVED
  Alt+ArrowUp                             TRUE         MOVED   MOVED   MOVED
```

The `ArrowUp` row is the reason the rest can be believed: the probe moves a real day, from the 3rd to
the 27th, in each renderer. A run where nothing moved would have reported "free" for a bench that was
measuring nothing.

The mechanism, read only after measuring: a bare binding refuses a press when `ctrlKey || metaKey`,
and Shift and Alt never enter that test. So `primary` and bare are mutually exclusive **by
construction** rather than by declaration order — asserted in both directions, because a collision
here would silently eat a movement of the calendar.

The binding is declared where the two views are declared, not where a grid is. A month is something
to walk; a months view is somewhere to go, and only the second is what this key is for.

## Consequences

- `MdyKeyBinding.intent` gains `"view"` and `MdyWidgetKeyIntent` gains `{ type: "view"; by }`. A
  `view` is deliberately not a `move`: nothing about the value changes, only which view is being
  walked. This is a **major** change for anyone reading bindings with an exhaustive switch — this
  package's own reader failed to compile and had to be given the case, which is the warning working.
- `widgetKeyIntent` now takes the `MdyKeyOrPress` its neighbour already took. It could not otherwise
  reach this binding at all: asked with a bare key name, it answers for the bare declaration of the
  same key, so the new intent would have been declared and unreachable through that door — the shape
  the `on` field's own comment warns about.
- **`Shift` and `Alt` are not available on any key already declared bare**, for the same reason this
  pair is available. A binding declared with either on such a key would be shadowed and do nothing:
  not an error, a silent no-op. `Shift+PageUp` for the year was rejected on surface grounds before
  this was measured, and the measurement makes it the worst of the candidates rather than merely a
  surplus one.
- The declaration lands first and the renderers follow it. Until they do, the two view buttons are
  still pointer-only, recorded here rather than left to be rediscovered.

## Alternatives rejected

- **`Ctrl` named literally.** Correct on one platform, wrong on the one this is being written on. The
  vocabulary has a word for "the accelerator" and using the raw flag would put the platform test back
  into every renderer.
- **`Shift+PageUp` for the year.** Rejected first for surface — the years view already covers the
  long jump, so a second gesture buys a second thing to learn — and then by measurement, which showed
  it would have been inert.
- **A bare key.** There is no free one: the four arrows walk the grid, the page keys move the month,
  `Home`/`End` reach the ends, `Enter` commits and `Escape` leaves.
- **Treating a view change as a `move` with a `page` flag.** It reads as a bigger `PageUp`, and it is
  not one: after a page the calendar shows the same kind of thing, and after this it does not.

## Verification

`packages/widgets/test/a-view-a-key-can-change.spec.mjs` — ten checks. The binding appears on exactly
the kinds that declare both views and on no others, derived from the anatomy rather than compared
against a list; a kind with a grid and no alternate views is asserted *not* to have it; the
accelerator resolves under `Ctrl` and under `Meta`, so the platform resolution is exercised in both
directions rather than on the machine's own; the bare arrows are asserted to still walk the grid, and
the held ones to still change the view, because one of those alone would pass with the two bindings
swapped; a press carrying more than the accelerator is refused; and the key is offered only while the
calendar is showing.

What is not yet verified is the act: no renderer honours this binding, so nothing here presses a key
and watches a view change. That is the next batch, and it owes a bench that presses — including on a
Mac, where this is the first non-`undo` binding to exercise the platform resolution for real.

## Security and privacy

None. Which view of a calendar a person is looking at changes no value, no stored data and no trust
boundary. It changes who can reach the other views: everyone, rather than only those using a pointer.
