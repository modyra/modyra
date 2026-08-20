# ADR 0110: A promise is declared where the popup is

Status: Accepted

## Context

`aria-haspopup` is announced with the control — "combobox, has popup listbox" — so a person decides
whether to open a thing from what they were told it is. `listbox` means options with a selected state
and a listbox's keyboard. `grid` means a table walked with the arrow keys. `dialog` means somewhere to
go and come back from. They are not interchangeable, and a promise is only worth making if it is kept.

Nothing declared it. The value was a literal written at each opener: five in `@modyra/widgets`, nine
more across `@modyra/plain` and `@modyra/lit`. With no common source the copies drifted, and a browser
battle that opens each popup and looks for the promised role caught it in both renderers at once:

| kind | promised | on screen |
| --- | --- | --- |
| `multiselect` | `listbox` | `group` |
| `colors` | `dialog` | `listbox`, `option` |

`colors` was worse than a mismatch: `@modyra/plain` said `listbox`, `@modyra/lit` said `dialog` at one
opener and `listbox` at another. Three literals, two renderers, one widget, and no way to say which
was right — because nothing said what the widget promises.

The same reading found `@modyra/lit`'s datepicker promising `dialog` where the catalogue's anatomy and
`@modyra/plain` both say `grid`.

That both renderers were wrong about the same two kinds is the evidence this is not a rendering
defect. A defect made independently in two places by two authors is a contract that did not speak.

## Decision

**The promise is declared in `MDY_POPUP_OPENERS`, beside the part it names, and read from there.**

`MdyPopupOpener` gains `promises`, and `projectOverlayOpenerA11y` emits `aria-haspopup` from it. It is
the table that already answers "what does this opener control"; what that thing *is* is the same
question, asked once.

Each value is read off the anatomy the same catalogue declares, not chosen:

| kind | promises | because the popup frames |
| --- | --- | --- |
| `select` | `listbox` | a `listbox` part with `role=listbox` |
| `multiselect` | `dialog` | a search field beside a chip grid this catalogue declares a `group` |
| `datepicker` | `grid` | a `grid` part with `role=grid` |
| `daterange` | `grid` | the same grid, serving both ends |
| `timepicker` | `dialog` | a clock face and its actions |
| `colors` | `listbox` | `presets` with `role=listbox`, holding `swatch` with `role=option` |

**Amendment — the part carries the role the promise names.** Declaring the promise was half the
answer: `multiselect`'s `popup` part declared no role at all, so nothing on screen answered to
`dialog` and the battle failed identically in both renderers, which is what said the contract was
still silent. `roles: { popup: "dialog" }` is now on the kind, and its projection reads the role from
the catalogue rather than restating it. Not modal — the panel is anchored to its field and the page
behind it stays reachable, so `aria-modal` would contradict what dismissal does — and named by the
field's label, because a dialog without a name is a region an assistive technology cannot introduce.

**`multiselect` promises `dialog` rather than `listbox`**, which is the one value that changes rather
than being written down. Its popup is a search field beside a grid of chips, and the contract already
declares that grid as a `group` — deliberately, because what role a chip grid should carry is the mode
question [ADR 0016](0016-a-multiselect-is-one-kind-and-the-mode-is-not-the-contracts.md) owns. So
`listbox` promised options with a selected state and a listbox's keyboard, over a composite that has
neither. `dialog` is what a search field beside a chooser is.

## Consequences

**A consumer asserting `aria-haspopup="listbox"` on a multiselect sees `dialog`.** The old value was
measured false, so nothing correct breaks — but it is a rendered attribute and a host's tests may name
it.

**The renderers still carry their literals**, and this record does not remove them. `@modyra/plain` and
`@modyra/lit` write nine of them, of which one — `select-field.ts`, reading
`trigger.attributes["aria-haspopup"]` — already takes the contract's answer. Until the other eight do,
the table is the source only for the kinds whose openers project through `@modyra/widgets`, and the
battle stays red for `colors` in both renderers.

**A promise now costs a role.** Declaring what a popup is means the part has to carry it, and a role
brings its own obligations — a `dialog` must be named. That is the point rather than a side effect: a
promise nothing on screen answers to is the defect this record exists to remove.

**`promises` is optional on the interface.** A kind with an overlay and no declared promise emits no
attribute, which is the honest state for one whose popup has no ARIA word — better than a default that
would be wrong somewhere.

**The word is now a contract decision rather than a rendering one.** Changing what a kind promises
means changing this table and saying why, which is the cost of having one answer.

## Alternatives rejected

**Make the multiselect popup a real listbox and keep the promise.** Truthful the other way round, and
a much larger change: it moves the chip grid's role, which ADR 0016 places under the mode question, and
touches both renderers. Rejected as out of proportion to a promise that can simply be made true — and
it remains open if the mode question is ever settled toward a listbox.

**Leave the literals and fix the two wrong ones.** Restores agreement without saying where agreement
comes from, which is the state that produced three contradictory literals for `colors`. The defect is
the absence of a source, not the value of any one copy.

**Derive the promise from the parts' declared roles at runtime.** Attractive — the table above is
readable off the anatomy — but the reading is not mechanical: a popup framing both a `listbox` and a
search field is a dialog, and no rule over the parts says so without encoding the same judgement. A
derivation that needs a judgement is a table written indirectly.

## Verification

- `npx playwright test -c battle-tests/playwright.config.ts what-a-control-promises-will-open` — opens
  each declared popup and asserts the promised role is on screen, in both renderers. This is what
  fails if a promise and its popup part company. Falsified rather than assumed: removing
  `roles: { popup: "dialog" }` fails it on both hosts again.
- `battle-tests/adversarial/widgets/a-promise-nine-renderers-write-themselves.battle.test.mjs` — reads
  the three renderers' sources and fails a literal written where the projection has the answer. The
  rendered attribute says what a renderer emits; only the source says where it got it.
- `npm run test:widget-contract` — 544 contract tests over the projections that now read the table.
- **Not guarded:** nothing fails when a renderer writes its own `aria-haspopup` literal instead of
  taking the projection's. The eight remaining literals are exactly that case, and an audit that
  refuses the attribute outside `@modyra/widgets` is the way to close it.

## Security and privacy

None. `aria-haspopup` is an announcement about the page's own structure; it carries no data, crosses no
trust boundary, and an attacker gains nothing from it being wrong.

The impact is accessibility, and it is the reason for the record: a promise a screen reader announces
is acted on before anything opens, so a false one costs more than silence.
