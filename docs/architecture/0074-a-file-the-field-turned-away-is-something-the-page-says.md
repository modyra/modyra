# ADR 0074: A file the field turned away is something the page says

Status: Accepted

## Context

`fileSelectionTransition` answers three things about a pick: the value, the candidates it kept, and
the candidates it turned away. Two of the three reached a page. The third was an array every renderer
computed and none of them showed.

Measured with a field declaring `accept="image/*"` and a `.txt` chosen: `@modyra/plain` did not change
one character on the page — same text, no message, no live region, still "No file selected".
`@modyra/lit` changed, but only because it was not applying the policy at all: it wrote whatever it
was handed, so the refused file appeared in the list as though it had been taken.
`@modyra/angular` applied the policy and emitted `filesRejected`, which a host may listen for and a
person cannot see.

Underneath that sat a second gap. The five published message tables carry `entryUnreadable` for a date
a control could not read, and nothing at all for a file a field would not take. A renderer that wanted
to say it had no word to say it with, which is why "say something" had not been a small change anyone
could make locally.

## Decision

**A refused candidate is a state of the widget, and the contract names it.** `MDY_WIDGET_CONTRACTS.file`
gains an optional `rejected` part, `role="status"`, sitting under the dropzone beside the list rather
than inside it — the list is the value, and a refused file is precisely what did not become part of
the value. It is on screen only while the last pick turned something away.

**The words are the message table's.** `MdyI18nMessages` gains `fileRejected(names)`, taking the list
of names and returning the sentence. The join belongs to the locale, not to the renderer: a renderer
that joined with `", "` and handed over a string would have decided punctuation for every language.

**Every renderer applies the policy from the one place that holds it.** `@modyra/lit` now goes through
`fileSelectionTransition` for picks and drops instead of writing the raw `FileList`, so `accept`,
`maxFileSize` and `maxFiles` mean the same in all three. The value each renderer writes is
`transition.value` — a list, as `MDY_VALUE_CONTRACTS.file` declares — rather than a shape rebuilt from
`accepted` and `multiple` beside it.

**An adapter can receive an entry report.** `MdyFormAdapter` gains `reportEntry(name, problem)`.
[ADR 0073](0073-a-verdict-a-person-can-see-is-one-the-form-counts.md) put `reportEntry` on the field
handle; a handle is built over an adapter, and Angular's — which builds its handles from its own
signal state — could not implement the handle contract at all. The adapter is where the report has to
land for the form to count it.

## Consequences

**Two required members added to published interfaces.** Anyone implementing `MdyI18nMessages` from
scratch writes one more entry; anyone implementing `MdyFormAdapter` implements one more method. The
type-surface audit classifies both major and agrees with the reading. A consumer spreading over
`MDY_I18N_MESSAGES_DEFAULT` — the documented way — is unaffected.

**A locale table now holds a function whose parameter is a list.** The convention was scalars.
Anything that exercises the tables generically by calling each function with a sample string gets a
`TypeError` here; the sample has to come from the key.

**`@modyra/lit`'s file element changes behaviour, not only shape.** A file its `accept` excludes is no
longer written to the model. That is the intent — it is what the other two renderers already did — and
it is a behaviour change for a page that was relying on lit ignoring `accept`.

**A part that appears and disappears.** `file.rejected` is optional and transient, so a conformance
run of a resting widget never sees it. It is recorded in the optional-parts rationale beside `clear`
and `fileList` with the reason it differs from those two: it is a state, not a feature.

## Alternatives rejected

**Show it in the error list.** The field is not invalid — it holds what it accepted and every rule
passes. Painting a refusal as an error would make the label red, set `aria-invalid`, and block nothing,
which is a verdict about the value that the value does not deserve.

**Leave it to the host through `filesRejected`.** Angular already had that output and the page still
said nothing, which is the evidence: an event a host may subscribe to is not a default, and the
default is what most people ship.

**Have the renderer compose the sentence from a scalar message.** It puts the separator and the word
order in the renderer, in three places, for five languages.

**Reuse `supportingText`.** It is host-slotted content describing the control; overwriting it would
destroy what a host put there and would say the refusal in a region that carries no announcement.

## Verification

- `battle-tests/browser/a-file-picked-and-nothing-said.spec.ts` — four battles, both renderers: the
  model holds a list after an accepted pick, and the page changes or announces after a refused one.
  The control in that spec is what makes it real: an accepted file must change the page too, so
  "nothing changed" is the refusal rather than an inert page.
- `npm run test:conformance` — the DOM contract checks `rejected` against its declared semantic; a
  `<div>` without `role="status"` fails with `PART_ELEMENT`.
- `npm run test:widget-contract` — the completeness matrix pins the file kind's anatomy, so a part
  added to the catalog and forgotten in the evidence fails.
- `node scripts/audit-type-surface.mjs` — classified the two required members major.

## Security and privacy

A file name the field refused is now rendered into the page. It is the name the person just chose, it
goes into a text node rather than into markup, and the file itself is neither read nor uploaded — a
refused candidate never reaches the model, which is the point of refusing it. Nothing new crosses a
trust boundary; what changes is that a name the browser already had is now also on screen, where a
shoulder-surfer can read it. That is the same exposure the accepted-file list already has.
