# ADR 0093: A field that leaves play takes its overlay with it

Status: Accepted

## Context

A field can leave play while its popup is open, and nobody has to click anything for it: a document's
rule takes a field out when *another* field changes, so a value arriving from a fetch can do it while
the user is looking at the calendar. Measured in both renderers, through the handle and through a
rule alike:

```
                       cells   opener says
calendar opened        42      aria-expanded="true"
field disabled         42      aria-expanded="true"     ← unchanged
a cell clicked         the model stays null             ← correct
```

The click doing nothing is right — the field is out of play, and a disabled field taking a value
would be a larger finding. What is wrong is that the calendar is still there offering it: an overlay
that looks live, reports itself expanded to a screen reader, and answers nothing.

The vocabulary already existed one layer up. `createCatalogWidgetController` closes on a `disable`
intent, with the reason written beside it. Nothing dispatched that intent when the *form* disabled
the field: the renderers derive `disabled` from the handle and never told the controller.

## Decision

A field controller watches its own handle's interactivity and closes its overlay when the field
leaves play.

The flag is **set** to `false` rather than derived from `open && inPlay`, so a field coming back into
play does not re-open a popup the user never asked for a second time.

Only `disabled` closes it — the line `blocksFocus` draws, the same one the native `disabled`
attribute is drawn on. A read-only field is still in the form and still being read: its overlay may
legitimately stay open to be looked at, and closing it would take away a value the user is allowed
to see.

A reactivity that runs no effects — a server pass — subscribes to nothing. There is no overlay open
on a server.

## Consequences

Every overlay-bearing controller (`colors`, `datepicker`, `daterange`, `multiselect`, `timepicker`)
holds one more effect for as long as it lives, and one more teardown. The cost is one subscription
per mounted widget of those kinds.

A host that disables a field *in order to* show something in its popup no longer can. That
combination has no meaning in the contract — a disabled field is one the form is not asking about —
and the previous behaviour was not that intention being served, it was nothing happening.

The keyboard is a separate question and is not answered here: closing the overlay does not decide
where focus goes when the element under it disappears. That is finding 175 and needs the renderers,
not the controllers.

## Alternatives rejected

**Derive `open` as `open() && inPlay`.** One line and no effect, and it re-opens the popup the moment
the field comes back into play — a control the user never touched appearing over the page because a
fetch landed twice.

**Have the renderers dispatch a `disable` intent.** Both renderers would carry the same watching
code, and a third renderer would have to know to write it. The handle is what the controller already
reads; watching it is where the knowledge belongs.

**Close on read-only too.** Read-only is a value you may read and not rewrite; taking away the popup
that shows it makes it unreadable.

## Verification

`battle-tests/browser/a-calendar-that-outlived-its-field.spec.ts` — both renderers, asserting the
overlay is gone and the opener reports `aria-expanded="false"`, with the click asserted to do nothing
so the finding stays about the overlay rather than about a disabled field taking a value.

## Security and privacy

An overlay left open over a field that is out of play can show option labels, a calendar's range or a
file list belonging to a state the form has left — visible to anyone looking at the screen and to
anything walking the DOM. Closing it narrows what is on the page to what the form is currently
asking. No data crosses a boundary either way.
