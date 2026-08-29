# ADR 0170: A caption nobody wrote

Status: Accepted

## Context

A `label` is optional. A form may mount a field with a name and no caption, and that is a legal
document rather than a mistake — a table of rows, a filter bar, a field whose meaning the surrounding
page already carries.

Two things follow, and they pull in opposite directions.

**Something has to be announced.** A control with no accessible name is announced as its role: "edit
text", on a form of them, and voice control has nothing to say to reach it. That criterion has no
conditional clause. More than the control: everything inside a field is named by *pointing* at the
caption — a dialog, a listbox, a grid all carry `aria-labelledby` at it — and a reference that lands
on nothing is worse than no reference, because a reader is told a name exists and then hears the role.

**And the field's own key is not a caption.** Asked outside the repository, the answer was that
showing a raw key dressed as a label is worse than showing nothing: a leaked key and a real label are
indistinguishable in the position and styling of one, so `rows.0.code` is captioned as though somebody
meant it, and a person reading the form cannot tell it is incomplete. Nothing is legible as nothing.

Measured across the three renderers before this decision, on a caption-less document: one drew the key
as a visible caption, one drew no caption element at all — so two of its panels resolved
`aria-labelledby` to nothing and were announced as "dialog" — and one drew no element and named the
control directly, which leaves nothing for a panel to point at either.

## Decision

**The caption element always exists. It carries what `fieldAccessibleName` chooses. Where those words
are the field's own key rather than a person's, it is taken out of sight and not out of the tree.**

Out of sight, not removed: `display: none` would take it out of the accessibility tree along with
every reference that resolves to it, which is the defect this is preventing rather than a stricter
form of it. Visually hidden — positioned, clipped, one pixel — leaves the reference intact.

`mdy-label--unwritten` is the class that says which of the two a caption is. It is a state in the
contract's own vocabulary, so a renderer does not decide the styling and a theme can reach it.

**A name is owed to a screen reader; a heading is not.** That sentence is the whole decision. Somebody
who cannot see the form needs to know which field they are on, and `rows.0.code` is a poor name that
beats no name. Somebody who can see it needs the form not to lie about being complete, and a key in a
caption's clothes does exactly that.

## Consequences

Every field draws a caption element, including those a document gave none. That is one element per
field that was previously absent in two renderers, and it is what makes every `aria-labelledby` in the
contract resolvable by construction rather than by whether a caption happened to be written.

The announced fallback is a raw key. `rows.0.code` is spoken as "rows dot zero dot code", which is
poor. This record does not fix that, and the outside view's recommendation for whoever does is
recorded here rather than acted on: humanise the key so what is announced is speakable, say visibly
that it is standing in rather than dressing it as a caption, and warn the document's author in
development where the form is being built. All three are additive to what is decided above.

The required marker lives inside the caption, so a name read from the element's text would include an
asterisk. It carries `aria-hidden`, so the computed name does not — and a check reading `textContent`
reports the asterisk and is wrong about what is heard.

## Alternatives rejected

**Draw nothing and name the control directly.** Two renderers did this. It satisfies the floor — the
control is announced — and leaves every panel inside the field pointing at an element that is not
there. The failure is invisible until a panel opens, which is why it survived.

**Draw the key as a visible caption.** One renderer did this, by accident rather than by decision: the
class that hides it was being switched off by a later layer. It is the option the outside view calls
worse than showing nothing.

**Require a caption.** Would make a legal document illegal, and the fields that omit one are usually
the ones where a caption would be noise — a row in a table whose column headings already say it.

## Verification

- `packages/plain/test/a-caption-nobody-wrote.test.mjs`: the key stands in, and is marked as standing
  in. Its control is a caption a document *did* write, which must not be marked — so the class cannot
  be applied always and pass by hiding every label on every form.
- `packages/lit/test/a-panel-that-points-at-nothing.test.mjs`: every kind that opens a panel has that
  panel announced as something, on a caption-less mount. Restoring the element to caption-only makes
  three checks red, two of them panels that were announced as "dialog".
- `packages/lit/test/a-field-with-no-caption.test.mjs` and its Angular counterpart hold the floor for
  every kind.
- **Not covered:** whether the visually-hidden caption is *actually* invisible is a question about a
  stylesheet, and none of these load one. The rule is in `modyra.css`; that it applies is the browser
  tier's to say.

## Security and privacy

A field's key is an internal identifier and this decision puts it in the accessibility tree of any
form that omits a caption. Worth stating plainly: a key like `patient.ssn` or `internal.riskScore`
is announced to a screen reader and readable by any extension that walks the tree, on a page whose
author believed they had labelled nothing. That is an argument for the humanising step above rather
than against the fallback — the alternative is a nameless control, which is a worse outcome for the
person the key would have been announced to — but a document putting sensitive words in field keys
should know they can be spoken.
