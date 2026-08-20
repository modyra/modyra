# ADR 0109: An element nobody bound says so

Status: Accepted

## Context

A Lit form is whatever a consumer writes. There is no component that mounts a document: elements are
registered once and each is bound by setting `.field`, which is what a template does. Forgetting one
is the ordinary mistake of that shape of API — a renamed handle, a branch that never assigns, a
template that binds four of five.

Measured on five elements, two frames after they were connected:

```
mdy-text-field  mdy-number-field  mdy-select-field  mdy-checkbox-field  mdy-datepicker-field
text ""         controls 0        and the console said nothing
```

Not even the `label` attribute the element was given is drawn. An empty custom element reads as a gap
in the layout rather than as a missing binding, and there is no word anywhere to search for.

This library is loud everywhere else. A bad widget id throws a sentence naming what is wrong with it;
a bad field name is refused by name; the engine has a development channel whose own evidence line is
*"the calls that could not do anything"*. The element surface was the one published door that failed
in silence.

## Decision

**An element that painted with no handle says so, once, on the console.**

It is a **warning and not a refusal.** Throwing would reject the order every host writes — create the
element, append it, then assign `.field` — and an element is legitimately unbound between those two
statements.

It is asked **three frames after connecting.** Binding on the frame after appending is a host doing
nothing wrong, and at two frames the check and that binding race: measured, it warned falsely about
an element that was bound and painting. Any deadline is a choice; this one leaves the whole
create-append-bind order silent, its boundary included.

**The element still paints nothing.** What was missing was the sentence, not the markup: rendering a
placeholder control for a field that does not exist would put a box on the page that writes nowhere.

The flag that strips it is `__MDY_DEV__`, read in `@modyra/lit` the way the engine reads its own.
It cannot be the form's `devWarnings` option, because an element with no field has no form behind it
to carry one.

## Consequences

Every element carries one more instance field and, while unbound, three animation frames of work that
end in nothing. An element that lives its whole life unbound warns once and never again.

A host that binds later than three frames after appending — behind a fetch, say — is told it is
unbound and then is not told when it stops being. The warning is about the moment it was asked, and a
reader who binds late sees a sentence that was true when it was written.

`@modyra/lit` now declares `__MDY_DEV__` for itself. That is a second reader of a build-time global
the engine documents; a bundler that defines it for one package defines it for both.

## Alternatives rejected

**Throw.** It is the loudest and it is wrong: it refuses the create-then-bind order, so the ordinary
host would have to bind before appending or catch its own construction.

**Warn on connection, with no delay.** Every host that binds after appending would be warned about
every element it mounts, which is a channel nobody would keep on.

**Render a placeholder control.** A visible box bound to nothing invites the person to type into a
field that will never hold what they wrote, and the emptiness is at least honest.

**Report through the form's `devWarnings`.** The case is precisely the one where there is no form.

## Verification

`battle-tests/browser/an-element-nobody-bound.spec.ts` — five elements of different shapes, appended
without a handle, asserting the console said something about them and that they still painted no
control. The false-warning direction is not covered by it: it was measured by hand — an element bound
one frame after appending, and one removed before the deadline, both silent.

## Security and privacy

None. The message names the element's tag and the label the page already displays, and it is written
to the console of the developer's own browser. No form, value or field name is read — at the moment
it is written there is no handle to read one from.
