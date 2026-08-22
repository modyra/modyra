# ADR 0137: A row that wraps where one line stops being a layout rule

Status: Accepted — supersedes [ADR 0127](0127-a-strip-that-scrolls-against-the-practice.md)

## Context

ADR 0127 chose a chip strip that scrolls in one line rather than wrapping to several. It knew that was
a departure from 1.4.10 Reflow at AA, said so, and made the departure **conditional**. Its first
condition, in its own words:

> the overflow must be **announced programmatically**, independent of any visual affordance —
> `aria-setsize` and `aria-posinset` on every chip

That condition was never met, and nothing was checking it.

```
plain  multiselect-field.ts:310   role = "spinbutton" when the chip carries a quantity, else "group"
plain  multiselect-field.ts:234   the strip itself is role="group"
plain  multiselect-field.ts:578   aria-posinset written onto that chip
lit    multiselect-field.ts:821   the same pair, the same roles
```

ARIA 1.2 permits `aria-posinset` and `aria-setsize` on `option`, `listitem`, `row`, `tab`, `treeitem`,
`radio`, the `menuitem` family, `article` and `comment`. **`group` is not among them. Neither is
`spinbutton`.** The attributes reach the DOM and the accessibility layer discards them. No browser
warns, no test failed, and no screen reader has ever said "3 of 12" on this control.

The reason it survived is worth more than the defect. The specs asserted that `aria-posinset` was
**present**, and it was present the whole time — written, visible in the inspector, wrong. An attribute
is not a property, and a check that reads the markup we authored can only ever confirm that we authored
it.

So 0127 is not a decision that aged. It is a decision whose stated price was never paid, held up for
weeks by a check measuring the receipt instead of the goods.

## Decision

**The row wraps below a breakpoint. One line at comfortable widths, several at 320 CSS px and at high
zoom.**

Decided by the user, on the ground that accessibility conformance wins where it conflicts with the
house rule.

The house rule — every control in a form occupies the same height — is not withdrawn, and this is the
substance of the decision rather than a softening of it. That rule is about **layout**: it exists so a
form reads as a row of peers at the widths a person designs and reviews it. At 320 px and at 400% zoom
the rule stops doing that work and starts costing content, because a single line that cannot grow can
only scroll, and horizontal scrolling inside a vertically scrolling page is the two-dimensional
scrolling 1.4.10 forbids. A rule applied where it no longer serves its reason is no longer that rule.

So the rule holds where it means something and yields where it does not. `a-control-taller-than-the-
row-it-sits-in.spec.ts` continues to enforce it, at the widths it was written for.

## Consequences

**The 1.4.10 debt is discharged, and it was owed to somebody else all along.** The clearest thing to
come out of this is that 0127 tried to pay a sighted person's debt in a screen reader's currency. The
set size and position are owed — they are restored below — but they were never capable of paying for
reflow, because a person at 400% zoom with no screen reader hears nothing at all. Two obligations to
two people were treated as one, and the accounting error outlived the defect.

**The chip and the strip need roles that carry the set.** Restoring the announcement means giving the
attributes somewhere they are legal:

- an ordinary chip becomes an `option` inside a `listbox` strip, with `aria-selected="true"`, since a
  set is only computed for an `option` within a `listbox`;
- a quantity chip cannot: `option` and `spinbutton` are not the same element. It takes `row`/`gridcell`
  within a `grid`, or it forgoes the position. The two configurations may end with two roles, and two
  correct roles are better than one role that is wrong for both.

**Wrapping changes what overflow means.** ADR 0127's second condition — a mechanism, not a cue, that
reaches chips no horizontal scroll axis can — was written for a row that hides things. A wrapped row at
320 px hides nothing, so below the breakpoint the mechanism has nothing to do; above it, where one line
still scrolls, it is owed exactly as before.

**The height becomes content-driven, which 1.4.4 and 1.4.12 wanted anyway.** A row fixed to one line's
height clips its chips when text is resized to 200% or when line height and word spacing are increased.
A row that may wrap has to grow, and growing is what those two criteria require.

## Alternatives rejected

**Keep one line and record the nonconformance.** The honest version of standing still: the ADR would
state that the control fails 1.4.10 at 320 px, as a known departure rather than a mitigated one. Ruled
out by direct instruction — accessibility conformance wins — and it is the option 0127 was already
living, minus the belief that it had paid.

**A summary instead of chips below the breakpoint.** "12 selected", expanding on demand: one line, no
scrolling, no reflow failure, and 0127 named it the likeliest successor. It remains the better answer
if wrapping turns out to break the equal-height rule at widths that matter — but it reopens what the
control *is*, and wrapping is the smaller change that conforms. Kept as **the condition on the parked
question**, below.

## The parked question, given the condition it lacked

*Is the chip strip the right shape at all?* — raised directly by the user, recorded by 0127 as the
likeliest successor, and parked with **no condition**, which makes it a ratchet rather than a decision.

Its condition: **reopen it if wrapping breaks the equal-height rule at widths that matter.** That is
the trade this record makes, so it is the trade whose failure reopens it. The condition lives here
rather than only in the coordination file, which is gitignored — a condition recorded where it is not
version-controlled is not recorded.

## Verification

The check that failed to exist is the point of this record.

**Assert the computed accessibility property, never the attribute.** A spec reading `aria-posinset`
off the DOM passes while nothing is announced — that is precisely how this survived. The battle for
this reads the accessibility tree, and it fails today on both renderers.

Then: the row wraps at 320 px and does not scroll horizontally; the row is one line at ordinary widths;
the control's height still matches its peers there; and the height grows rather than clipping at 200%
text size.

**What remains unchecked**: that a real screen reader speaks the position. The accessibility tree is a
much stronger proxy than the attribute and it is not the same thing. Named because the gap between
those two is the whole subject of this record.

## Security and privacy

None. Roles, layout and announcements; no data crosses a boundary, nothing new is trusted or stored.
