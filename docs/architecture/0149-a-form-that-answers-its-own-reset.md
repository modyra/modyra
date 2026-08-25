# ADR 0149: A form answers its own reset by returning to the initial values

Status: Accepted

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

- **The listener is on the form.** `reset` does not bubble past it, so nothing higher up can hear it.
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

## Verification

- `packages/widgets/test/form-reset.spec.mjs` — five cases against the rule directly: the deferral
  (asserting the model is *not* written during the event), unbinding, an element outside any form,
  the form element itself, and a reset dispatched on a different form. Mutating the deferral away
  turns exactly one of the five red.
- Measured in a browser in all three renderers, box and model together: `Grace` → Cancel → box `Ada`,
  model `{"nome":"Ada"}`.
- `npm run test:type-surface` classifies the two new exports as minor and holds them.

## Security and privacy

A reset now clears a value the person asked to discard rather than leaving it in the model to be
submitted, which narrowly improves matters: a password or a personal detail typed into the wrong form
and cancelled is no longer carried into the next submit. No data crosses a trust boundary, nothing is
persisted, and the deferred write runs in the same task queue as the rest of the renderer.
