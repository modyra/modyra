# ADR 0062: The form says what no field can

Status: Accepted

## Context

[ADR 0060](0060-a-refusal-reaches-somebody.md) made every shape of a server's refusal reach the
engine. It reached `state.lastSubmitErrors()` and stopped there, because no renderer had anywhere to
put a refusal that names no field. Measured across the three that render markup:

| | a form-level error region |
| --- | --- |
| `@modyra/widgets` | no part declared |
| `@modyra/plain` | never reads `lastSubmitErrors` |
| `@modyra/lit` | never reads `lastSubmitErrors` |
| `@modyra/angular` | reads it in the devtools panel, not in the form |

A refusal naming a field reaches the person through that field, and both browser renderers were
measured doing exactly that — which is what makes this a rendering gap rather than a claim that
refusals never arrive. A refusal naming no field is the ordinary shape of a failed network call, a
service that is down, or a cross-field rule only a server can check. The person pressed Send, the
answer was no, and they saw their fields exactly as they had left them.

Three renderers missing the same thing is not three oversights. It is a part the contract they share
never declared.

## Decision

**`@modyra/widgets` declares the form's own parts.** `MDY_FORM_SHELL_STRUCTURE` names two:
`formErrors`, the region, and `formErrorItem`, one sentence in it. `MDY_FORM_SHELL_CLASSES` gives
them the class vocabulary the themes target, and `MdyFormShellPart` is the closed set a renderer
writes against.

**The region is a `status`, not a field's error list.** It speaks for the form, it appears in answer
to something the person did, and it is announced when it arrives rather than when it is reached.

**It sits first, before the fields.** A summary a person has to scroll past their whole form to find
is a summary they do not read, and a refusal about the submission as a whole belongs where the
submission was answered.

**It is rendered empty rather than not at all.** A region a screen reader is already watching
announces what arrives in it; one that appears with its message already inside may not.

**What belongs in it is one rule in one place.** `formErrorsOf` keeps the errors whose path is
`null` — the ones no field will show — so no refusal is shown twice and none is shown nowhere.

**The three renderers that draw markup implement it.** `@modyra/plain` renders it from
`mountMdyForm`; `@modyra/angular` from `MdyFormComponent`'s template, both of which own the form's
own DOM. `@modyra/lit` has no form element — a Lit form is whatever its host writes — so it ships
`<mdy-form-errors .form=${form}>`, placed by the host, which is the same relationship its field
elements already have.

## Consequences

A form that never had a refusal now carries one empty, hidden element more. It is `hidden` until
there is something in it, so it occupies nothing and announces nothing.

`@modyra/plain` inserts the region as the container's first child, so anything counting a form
container's children sees one more. The layout tests that did were changed to filter it, and a host
doing the same arithmetic will have to.

The Lit half depends on a host placing the element. That is the cost of Lit having no form component,
and it means a Lit application gets no region until it asks for one — the opposite of Plain and
Angular, where the region comes with the form.

`@modyra/styles` paints the region bordered rather than bare, unlike a field's error list. A field's
error is read next to the field it is about; this one has to say what it is about by itself.

The audits had to learn about it: `audit-contract-style-coverage` built its contract vocabulary from
the widget kinds and the field shell alone, so the two new classes read as styled-but-unemitted.

## Alternatives rejected

**Let each renderer invent its own region.** It is what produced the four different answers above,
and the class names would diverge, which means the themes would reach one renderer's region and not
another's.

**Reuse the field shell's `errors` part.** It is anchored to a field, both in the structure — its
parent is a field root — and in the themes, which lay it out under an input.

**Give Lit a form component to own the region.** A larger decision than this one: Lit's package is a
control catalogue on purpose, and adding a form element would make it a framework. The host places
one element instead.

**Put the region last.** It matches the order a field's errors sit in, and it is the position a
person does not see on a form longer than a screen.

## Verification

- `packages/widgets/test/form-shell.spec.mjs` — the structure, the class vocabulary, and what
  `formErrorsOf` keeps and refuses.
- `battle-tests/browser/an-error-with-nowhere-to-go.spec.ts` and
  `battle-tests/browser/a-refusal-in-two-renderers.spec.ts` — the same refusal asked of a rendered
  page, with a field-level refusal beside it as the control.
- `examples/plain/panels/dynamic.js` — a service that is down, in the panel the browser suite drives.
- `scripts/audit-contract-style-coverage.mjs` — the classes are contract vocabulary, so a theme that
  stops painting them is reported.

## Security and privacy

The region shows what `lastSubmitErrors` holds, which [ADR 0060](0060-a-refusal-reaches-somebody.md)
already filtered: an unsafe path is dropped before it gets here, and a message that is not a string
is replaced rather than rendered. Both renderers set the text as text — no markup a server sent
becomes markup on the page.
