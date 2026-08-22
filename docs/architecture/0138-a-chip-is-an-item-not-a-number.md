# ADR 0138: A chip is an item in a list, not a number in a range

Status: Accepted

## Context

[ADR 0137](0137-a-row-that-wraps-where-it-must.md) established that a chip needs a role ARIA permits
`aria-posinset`/`aria-setsize` on, inside a container that owns a set. That leaves the question it did
not answer: **the chip that carries a quantity.**

One configuration of this control lets a value be chosen more than once, and the chip then shows a
number with a decrement and an increment. Until now that chip was `role="spinbutton"`, which is what
the ARIA authoring practices prescribe for a value in a range, and which an outside accessibility
review — consulted with no knowledge of this repository, answering from published practice — endorsed
without qualification:

> The chip being a `spinbutton` with `ArrowUp`/`ArrowDown` is right. It matches APG's spinbutton
> pattern, where the value is the only focusable component and the increase/decrease buttons are
> deliberately not separate stops. It also avoids a live region, because a spinbutton's value change
> is announced natively.

`spinbutton` is not among the roles that carry a position in a set. So the two cannot both be true of
one element: a chip is either the item at position 3 of 12, or the number 3 of a range.

## Decision

**Every chip is a `listitem` inside a `list`, whatever it holds.** The quantity is stated in the
chip's accessible name and in the announcement its change produces, rather than in `aria-valuenow`.

The deciding argument is that **the alternative makes the strip change role according to its
contents.** A `spinbutton` chip cannot sit in a `list`, so the quantity configuration would need
`grid`/`row`/`gridcell` — and then a row that is a list while nobody has taken two of anything, and a
grid the moment somebody does, is a control that cannot be learned. Its keyboard model would change
underneath a person as a consequence of what they chose.

`listitem` also holds what the quantity chip actually is: a thing with buttons in it. A `listitem` may
legitimately contain buttons; that is ordinary.

**The `listbox`/`option` pairing was rejected separately and for its own reason**: the listbox of this
widget is the popup, the place a person chooses from. A strip of what has *already* been chosen is not
a second selection widget, and declaring it one puts two selection widgets in a control that has one.

## Consequences

**This departs from published practice, and the outside view endorsed the thing being departed from.**
That is the cost and it is not small. What is given up:

- the native announcement of a value change, which a `spinbutton` gets for free. The quantity must now
  be announced deliberately, and an announcement that is not written is silence — where the spinbutton
  failed loudly, this fails quietly;
- `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and `aria-valuetext`, and with them the ability to
  tell a person the range before they hit its end;
- the pattern-matching a screen reader user brings to a control that announces itself as a spinbutton.

**What is gained** is that every chip announces its position and set size — which is the condition ADR
0137 pays the 1.4.10 departure with, and which was worth nothing while the roles could not carry it —
and that the strip has one keyboard model regardless of its contents.

**A collision disappears with it.** The grab-to-reorder gesture uses `Enter`, and a `gridcell` enters
its interaction mode with `Enter` or `F2`; without a grid there is no interaction mode, so `Enter`
stays free and `F2` is not needed. `Home`/`End` likewise stop having two meanings — the row's ends
versus the spinbutton's minimum and maximum — so no `Ctrl` modifier is required to separate them.
Those resolutions were being designed when this decision removed the need for them.

## Alternatives rejected

**`spinbutton`, as published practice prescribes.** Native value announcement, a pattern users know,
and the outside view's unqualified endorsement. Rejected because it cannot carry a position, and the
position is what an entire other decision was already paying for. Where the two conflict, the one that
serves every chip beats the one that serves the subset holding a number.

**`grid`/`row`/`gridcell` for the quantity configuration only.** Both properties, at the price of a
control whose role and keyboard model depend on its contents. Rejected on learnability.

**Two roles for two configurations.** Considered and it is what this record was expected to say. It
loses to the same argument as grid: the difference is invisible to the person until it changes under
them.

## Verification

`a-position-the-attribute-claims.spec.ts` asserts the computed role of the chip and of the strip, via
the accessibility tree rather than the markup, and that the container is one the role computes a set
inside. It is green on `list`/`listitem` and goes red when either is forced back to `group`.

`a-quantity-only-a-mouse-can-change.spec.ts` covers the cost this record incurs. It had argued for the
spinbutton and won that argument; it now asserts the **property** under either mechanism — a person
can obtain the quantity, whether from `aria-valuenow` or from the name the chip announces itself with,
and `ArrowUp`/`ArrowDown` change it without a pointer. Green in all three renderers, and it goes red
when the count is stripped from the name, which is what a renderer that quietly stops saying it looks
like.

A chip that draws **no** number is out of its scope: one of something is the default, the renderers
draw nothing for it, and reading that as silence made the check red against three renderers that were
behaving correctly.

**What remains unchecked** is the thing the trade actually rests on: that a real screen reader speaks
the quantity when it changes. The accessibility tree and the accessible name are proxies. A native
spinbutton announcement needed no such assumption, and that is the difference this record is paying.

**Reopen this** if the announcement proves unreliable in a real screen reader — the trade assumes a
deliberate announcement can do what a native one did, and that assumption has not been tested against
assistive technology, only against the accessibility tree.

## Security and privacy

None. Roles and announcements; no data crosses a boundary, nothing new is trusted or stored.
