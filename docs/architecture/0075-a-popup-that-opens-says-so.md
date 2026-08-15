# ADR 0075: A popup that opens says so

Status: Accepted

## Context

`overlayLifecycleTransition` is the policy every renderer opens and closes through, and its result
carries `announce: "opened" | "closed" | null`. The words exist: `overlayOpened` and `overlayClosed`,
in five published message tables. `@modyra/angular` reads the field. `@modyra/plain` and `@modyra/lit`
never did — measured in a page, a datepicker opened, `aria-expanded` became `"true"`, and no live
region received anything.

`aria-expanded` covers the state on request: someone whose focus is on the control can ask what it is
doing. What it does not cover is being told. A popup is drawn elsewhere in the page — for two of the
three renderers, in the top layer — so a person who was not asking has nothing to notice.

The obstacle was that the two renderers reflect open state on every render rather than on the
transition. `setOverlayOpen` was told what the state is, not that it had changed, so anything reading
it would have repeated the sentence on every keystroke while the popup stayed open.

## Decision

**The renderer that reflects the open state is the one that announces it**, in the element's own
language, once per opening and once per closing. Angular already did this in its overlay directive;
plain and lit now do it where they show and hide the popup.

**`setOverlayOpen` answers whether this call is the change.** It returns `true` only when it moved a
popup from shown to hidden or back. The first call for a popup is its initialisation and returns
`false`: an element that has just been built is neither hidden nor open, and a renderer reflecting its
resting state would otherwise be told the popup had just closed — which is what the first measurement
of this produced, a page announcing "Popup closed" before anything had happened.

**A teardown is not a closing.** Neither renderer announces when the popup or its host has left the
document. An element being disposed is not a popup a person closed, and saying so would also build the
live region that says it, after the thing that caused it is gone.

**The shared live region outlives every instance, and says so.** One region serves the whole renderer:
created and removed around a message, it is a region the screen reader was not watching when the text
arrived. It carries `data-mdy-shared-region` (`MDY_SHARED_REGION_ATTRIBUTE`) so a teardown check can
tell it apart from an element an instance left behind — without the marker, the first announcement in
a lit lifecycle test read as a leaked node.

## Consequences

**Two announcements where a renderer has two paths to the same edge.** Nothing observed today: the
plain fields reflect through one call, and lit's overlay controller has one `open` and one `close`.
A future renderer that both dispatches a command and reflects state would say it twice, and the edge
returned by `setOverlayOpen` is what keeps that honest.

**`setOverlayOpen` now returns a value.** A consumer implementing something to that signature returns
the flag; a caller ignoring the result is unaffected. The type-surface audit classifies it major,
which is stricter than my own reading of it — a return widened from `void` breaks only an
implementer, not a caller — and the stricter classification is the one that ships.

**`MdyFieldElement.messages` is public in `@modyra/lit`.** The overlay controller speaks for the
element, so it reads the element's table rather than resolving a second one — two parts of one
control resolving locale separately is how they come to speak different languages.

**A person using a screen reader now hears two sentences per interaction** where the widget both
announces and moves focus. That is the intended volume for a popup appearing in the top layer; a
widget whose popup is inline and adjacent gets the same sentence, which is more than it strictly
needs.

## Alternatives rejected

**Announce from the command runtime, on `open-overlay` and `close-overlay`.** It is the one place all
three renderers share, but Angular reaches the same edge through its overlay directive as well as
through commands, so it would have announced twice — and the words would have had to travel to a
module-level runtime that has no locale.

**Have the widget controllers emit an `announce` command.** They hold the policy, and the policy is
what decides `announce`. They do not hold a message table, and giving them one puts the locale
decision inside the shared layer rather than in the host that chose it.

**Keep a per-field "was open" flag in each renderer.** It is the same edge computed in two more
places, and a flag one renderer forgets to clear is a sentence that stops being said.

## Verification

- `battle-tests/browser/a-popup-that-opens-without-a-word.spec.ts` — both renderers: nothing is
  announced before anything happens, and opening a popup reaches a live region.
- `packages/lit/test/lifecycle.test.mjs` — an unmounted element gives the document back; the shared
  region is excluded by its marker rather than by the check being loosened.
- `node scripts/audit-type-surface.mjs` — pinned the returned edge and the new exported marker.

## Security and privacy

None. The announcement is a fixed sentence from the message table — no field value, no user input, no
document content reaches the live region. It is added to the page the user is already on.
