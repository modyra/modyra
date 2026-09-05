# ADR 0208: A value of the wrong shape is a verdict, not a crash

Status: Accepted (amended: entries, and the adapters' own readers)

## Context

The engine takes what a document puts in the model, keeps it, and reports the field invalid: the
value is readable, the field is not valid, `canSubmit` is false. That layering is deliberate — a
document that writes the wrong thing gets told what is wrong with it instead of having the write
refused, and the control on the page is what tells it.

Every renderer draws from the same projections, and the projections read the value. Read as the
kind's declared shape, a value of any other shape throws while the widget is being drawn, and the
component that was going to show the verdict is the one thing that does not reach the page. A person
sees a form with a field missing; nothing anywhere says why.

Four published readers did exactly this — a file field's prompt reading the value as a list of files,
the 24-hour time parser trimming it, the timepicker's display handing it on unconverted, the colour
comparator lower-casing it — and each took its widget out in every renderer at once.

## Decision

**A projection answers a value of any shape.** A reader reached from a projection — a controller, a
published parser, a comparator on a projected value — treats a shape it did not expect as invalid
input and answers it: `null`, an empty list, the value rendered as text. It never throws.

The verdict belongs to the kind's rule and is shown by the control. The control therefore has to
exist, which makes staying on the page a property of the projection rather than of the document that
fed it.

This holds at the contract, not at each renderer. A guard added in an adapter repairs one of eight.

**Amendment — the entries, not only the list.** A list whose entries are not what the kind expects is
the same defect one level down, and it is the shape a document most easily produces: the file field's
state answers a list *of files*, and an entry that cannot give a name is not one. State that vouches
for its entries is what lets every renderer walk it and read a name off each.

**Amendment — an adapter that reads the value a second time.** A renderer that goes back to the model
instead of asking the controller has its own copy of the reading, and inherits nothing. Four such
readers existed in Angular alone. Where a renderer needs what the model holds, it reads the
controller's state; where no state answers it, the guard belongs in the renderer and the missing
answer is a finding against the contract.

## Consequences

A reader can no longer state its shape in the type and stop there; where the value comes from the
model, the type is a declaration of intent and the runtime check is the contract. That is a real cost
— it is defensive code in a package that is otherwise declaration — and it is bounded to the readers
the value actually reaches.

It also means a wrong shape is quiet: the widget draws, the field is invalid, and nothing in the
console names the shape. The verdict is the report, and a document debugging its own value reads it
from the field rather than from a stack trace.

Two published functions grew more tolerant: `parse24Time` answers a non-string with `null`, as
`parseTime` always has, and `colorValueEquals` compares two values that are not both strings as they
stand rather than as spellings. Neither narrows what it accepted before.

## Alternatives rejected

**Refuse the value at the engine.** The layering that holds it is what lets a form report a bad
value instead of silently dropping it; taking that away to make projections simpler inverts the cost
onto every document.

**Guard at each call site in each adapter.** Measured: the same defect existed in eight renderers
through one reader. Eight guards is eight chances to miss one, and the ninth adapter starts red.

**Coerce with `String(value)` everywhere.** It makes `7` and `"7"` the same colour and the same time,
which is a lie a comparator should not tell. Non-strings compare as they stand.

**Type it away.** The value crosses a boundary a document controls. A type does not survive that
crossing, and this repair began as a component that typechecked cleanly and threw.

## Verification

- `packages/widgets/test/a-projection-given-the-wrong-shape.spec.mjs` — every field controller the
  public door offers, against six shapes. The roster is derived from the barrel, so a kind added to
  the contract is measured without anyone remembering to add it.
- `packages/vue/test/a-control-given-a-value-of-the-wrong-shape.test.mjs` — the same question asked
  of the mounted components, which is where "the control left the page" is visible.
- `packages/plain/test/a-control-given-a-value-of-the-wrong-shape.test.mjs` and the same file under
  `packages/lit/test/` ask it of every declared kind, through each package's own kind-to-element door;
  `packages/react/test/` asks it of the components React has so far.
- `packages/angular/src/lib/renderers/a-control-given-a-value-of-the-wrong-shape.spec.ts` — every
  control component on one page, which is how a renderer that reads the model itself is caught.
- `battle-tests/browser/a-control-that-stops-at-a-value-it-was-given.spec.ts` asks it of every host.

Preact, Svelte and Solid ship no field components, so there is nothing there to ask.

Each repair was mutated back one at a time and the bench went red for it; the one guard no mutation
could redden was removed rather than kept as decoration. The Lit and React benches saw no red from
the contract's own defect — Lit does not draw the file prompt yet and React has no file component —
so each was proved separately by planting the species in its own text control, where both went red.

## Security and privacy

No trust boundary moves and no data is stored or transmitted differently. It slightly reduces what a
hostile document can do: a value chosen to hit an unguarded read used to remove a control from the
page — a denial of the form's own error reporting — and now produces a verdict instead.
