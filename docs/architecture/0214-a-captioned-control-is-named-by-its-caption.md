# ADR 0214: A captioned control is named by its caption

Status: Accepted

## Context

A field with a visible caption ("Email address") connects the caption to its control, so a screen
reader announces the caption as the control's name. On top of that connection, three renderers write
an `aria-label` on the control, copied from the caption, even when the document declared no
`ariaLabel`. The fourth writes `aria-label` only when the document declares one. A browser spec that
compares which `aria-*` attributes each renderer writes reports ten such rows. The contract has no
general rule to settle them.

The repository already leans one way in three places:

- the name-source comment in `packages/widgets/src/field/verdict.ts` says that, for a control a
  `<label for>` can name, a declared name is the extra thing to say and goes on as `aria-label`;
- `fieldNameAttributes` gives `aria-label: null` whenever a caption has words, although it is scoped
  to composites;
- [ADR 0177](0177-what-the-contract-declines-to-say.md) treats "the caption's reference or its words" as
  one answer, not two, but only for `file`.

The only stated argument for copying the caption is in the plain shell. The caption element also
holds the visible required marker, `*`, so a name computed from the caption's content carries an
asterisk the caption's words do not.

The outside view (accname 1.2 steps 2B to 2E; WCAG 2.2 SC 2.5.3 Label in Name and its Understanding
document) is unambiguous. `aria-label` does not add to a native label, it replaces it. When a visible
caption exists, the name must come from that caption. A second copy is harmless only while the two
are identical, and they drift the first time one is edited. Extra words for assistive technology
belong in the description, not the name.

## Decision

A control whose field has a caption with words is named by that caption, through the native label
connection or `aria-labelledby`. The renderer writes no `aria-label` derived from the caption.

`aria-label` is written only when the document declares `ariaLabel`. A declared name is the
document's explicit choice and is not rewritten. The renderer neither prefixes it with the caption
nor drops it. A field with no caption words keeps the existing fallback order in
`fieldAccessibleName`: declared `ariaLabel`, then the caption, then the field's name.

The required marker is not part of the accessible name. It is decoration on the caption, and
`aria-required` already says that the field is required. The marker is therefore hidden from
assistive technology, and the caption's words alone form the name.

## Consequences

- Plain, Lit and Angular must stop copying the caption into `aria-label`, and every renderer must hide
  the required marker from the name. Those changes cross three adapters and are a separate batch.
  Until they land, the spec stays on the known-red list. Ten of the fourteen rows it reports are
  `aria-label` rows and belong to this decision. The other four (`aria-live` on the select's error
  region twice, `aria-modal` on the timepicker popup, `aria-readonly` on the colors hex input) are
  outside it, and no record decides them yet.
- The asterisk argument is answered at its source, the marker, rather than by a second naming
  channel. A theme or renderer that puts other decoration inside the caption takes on the same
  obligation to hide it.
- A declared `ariaLabel` that does not contain the caption's words fails SC 2.5.3. The library allows
  this because the declaration is the document's own. A warning for it would be a separate, additive
  decision.
- An announced name can change for a captioned, required field that today reads "Email address *".
  That change is visible to screen reader users and to tests that match names exactly.

## Alternatives rejected

- **Keep copying the caption into `aria-label`.** Two sources of truth for one name. When they diverge,
  the hidden one wins under accname and the visible caption silently stops naming the control. This
  is the failure SC 2.5.3 exists to prevent.
- **Have every renderer copy it, so the four agree.** This buys agreement by adding the redundant
  channel everywhere, and makes it public surface 1.0 would have to keep.
- **Leave it to each renderer.** The spec exists because a person hears different things from the
  same document depending on the toolkit. ADR 0177's test for an optional choice ("two renderings
  would tell a person different things") rules this out.

## Verification

`battle-tests/browser/an-aria-promise-that-depends-on-the-adapter.spec.ts` fails while any renderer
writes `aria-label` on a captioned field that some other renderer leaves off. Today it reports fourteen
rows, ten of them `aria-label`, and `battle-tests/reports/known-red-browser.json` lists it once. The
adapter batch clears the ten. The spec leaves the list, and guards this rule, only once the other
four are decided as well. No check yet asserts that the required marker is
outside the name. That check belongs with the adapter batch.

## Security and privacy

None. The decision changes which attribute carries an accessible name. No data, storage or trust
boundary is involved.
