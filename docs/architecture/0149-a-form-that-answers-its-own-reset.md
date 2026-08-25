# ADR 0149: A form answers its own reset by returning to the initial values

Status: Accepted — amended 2026-08-25 (see **Amendment**)

## Context

A consumer puts these controls inside a `<form>` and gives the page a Cancel button. That button is
`type="reset"` — elementary HTML that every framework's users write without thinking about it, and
that no part of this library had ever been asked about.

Measured, one text field with an initial value of `Ada`, a person types `Grace`, and presses Cancel:

| renderer | the box showed | the model held | what the person got |
| --- | --- | --- | --- |
| plain | `""` | `Grace` | saw an empty field, submitted `Grace` |
| lit | `""` | `Grace` | the same |
| angular | `Grace` | `Grace` | Cancel did nothing at all |

None returned to `Ada`, and the three disagreed with each other.

The mechanism is the same in all three. The browser's reset returns a control to its `value`
*attribute*; these renderers keep the box in step with the model by writing the *property*, and never
write the attribute. So the browser empties the box, the model never hears about it, and the two
diverge. Angular's rendering restores the box on the next pass, which hides the divergence at the
cost of making the button inert.

The first two are the worse failure by a distance: **what a person sees stops being what the form
sends.** They press Cancel, watch the field clear, and submit the value they believed they had
discarded.

## Decision

**A `<form>` reset returns the model to its initial values, in every renderer.**

`bindFormReset` in `@modyra/widgets` is the single implementation: it listens for `reset` on the
nearest enclosing `<form>` — the element itself when a renderer owns the form — and defers the write.
Each renderer binds it where it knows its form: plain at mount, lit on connect, Angular's form
component to the `<form>` it renders.

Two properties are load-bearing and neither is incidental:

- **The form is resolved at each reset, not at bind time.** The listener sits on the document in the
  capture phase and asks whether the form being reset contains the element. Which form that is can
  change: an element mounted before its page is assembled, and placed into a form afterwards, is that
  form's control from then on.
- **The write is deferred by a task.** The browser resets its own controls *after* dispatching the
  event; a model written during the event is overwritten by the boxes a moment later. The `schedule`
  hook exists so a renderer that batches its writes can supply its own, and so a test can drive it.

"Initial values" means what the form was built with — which is what `form.reset()` already meant, and
what HTML promises: a reset restores what the document declared.

## Consequences

A Cancel button now works, and the three renderers answer alike.

What this costs:

- **A form-level listener per mounted form**, for a control that may never be inside one. Binding is
  a no-op outside a form, so the cost is one `closest` call at mount, but the listener is real.
- **A consumer who wanted the browser's semantics cannot have them.** Returning to the `value`
  attribute — which for these renderers means empty — is no longer reachable through Cancel. That
  behaviour was never useful here, but it was the platform's, and this overrides it.
- **`<mdy-form>` nested in a consumer's own `<form>` does not answer the outer form's reset.** Its
  controls belong to the inner form, so the browser does not reset them either; the behaviour is
  consistent, and it will still surprise someone.
- **One document-level listener per binding**, rather than one per form. For a renderer that binds
  per control this is a listener per control on the document, for an event that fires rarely.
- **A new public export to keep stable**: `bindFormReset` and `MdyFormResetBinding`.

## Alternatives rejected

**Write the `value` attribute as well as the property, and let the browser do it.** This is the
platform's own mechanism and needs no listener. Rejected because the attribute would then have to
track the *initial* value while the property tracks the current one, in every kind — and the kinds
whose value is not a string (multiselect, daterange, colours) have no attribute that could carry it.
It also makes the DOM carry a second copy of state the contract owns, which is the defect shape this
repository has found four times.

**Leave it to the consumer.** Rejected: the divergence is invisible from outside. A consumer cannot
discover that Cancel empties the box without changing the value unless they measure it, and nothing
in the library told them to.

**Angular's inertness as the model — swallow the reset and change nothing.** It is the least wrong of
the three measured behaviours, and it is still a button that lies. A control that does nothing is a
defect a person cannot work around.

**Bind per control rather than per form.** Rejected for Angular, where the form component renders the
`<form>` and one listener covers every control inside it; N listeners for one event is a cost with no
return. Plain and lit bind per mount because that is where they know their form.

**Attach the listener to the enclosing form, resolved once at bind time.** The obvious shape, and it
is what this decision was first built as. Rejected on measurement — see the amendment.

## Verification

- `packages/widgets/test/form-reset.spec.mjs` — seven cases against the rule directly: the deferral
  (asserting the model is *not* written during the event), unbinding, an element outside any form,
  the form element itself, a reset dispatched on a different form, and an element moved into and out
  of a form after binding. Mutating the deferral away turns exactly one of the seven red.
- Measured in a browser in all three renderers, box and model together: `Grace` → Cancel → box `Ada`,
  model `{"nome":"Ada"}`.
- `npm run test:type-surface` classifies the two new exports as minor and holds them.

## Amendment (2026-08-25)

The decision holds; two things it asserted were wrong, and the second was wrong in a way that left a
renderer silently inert.

**`reset` does bubble.** The original text said it does not, and that a listener therefore had to sit
on the form itself. Measured: it bubbles in Chromium, Firefox and WebKit alike — and does *not* bubble
in jsdom, which is where the claim came from. A rule taken from the test environment and stated as a
property of the platform. The listener now sits on the document in the **capture** phase, which is
independent of bubbling and holds in both.

**Resolving the form once, at bind time, is not enough.** A control mounted before any form exists and
moved into one afterwards was bound to nothing and stayed bound to nothing:

| | mounted inside a form | mounted loose, moved in after |
| --- | --- | --- |
| plain | Cancel worked | **Cancel did nothing, for good** |
| lit | Cancel worked | Cancel worked — by accident: reconnecting rebinds it |

Two renderers of one contract disagreeing, with lit correct only because a custom element's lifecycle
happens to fire again. Resolving the form at each reset removes the difference and the accident
together: all three now answer in both shapes.

## Security and privacy

A reset now clears a value the person asked to discard rather than leaving it in the model to be
submitted, which narrowly improves matters: a password or a personal detail typed into the wrong form
and cancelled is no longer carried into the next submit. No data crosses a trust boundary, nothing is
persisted, and the deferred write runs in the same task queue as the rest of the renderer.
