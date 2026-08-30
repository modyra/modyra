# ADR 0182: Where the text a person types begins is declared once

Status: Accepted

## Context

A field's inner inset — the distance from the field's edge to the first character a person types — is
declared in two places that both apply.

`.mdy-input-wrapper__inliner` carries it as a logical, asymmetric pair: more room where the text
starts than where a trailing affordance sits, written with logical properties because a physical
spelling left the extra room on the left under `dir=rtl` and pushed everything at the inline end
inside where it belonged. The control inside it carries its own symmetric padding, which nothing
records and which predates the inliner.

Where a renderer draws the inliner, both apply and the text starts at the sum. Measured across the
three renderers on the same document:

```
                 text  select  datepicker  timepicker  colors  daterange
plain              28      28          28          28      16          28
lit                16      16          16          16       0           8
angular            16      16          16          16      16           8
```

Ten kinds disagree. Seven of them are the same 28-against-16; the other three are their own numbers,
which is what a second declaration looks like once it is drawn in more than one place.

The divergence is wide — every text-bearing kind — and it is the most visible property a field has,
because it is where the writing appears. Nothing on the board sees it: the sweeps compare heights,
classes and attributes, and the snapshots pin each renderer against its own past, so a horizontal
offset that has always been there is invisible to both.

**The rule is already written, and one renderer already follows it — once.** The colour field zeroes
its control's padding, `.mdy-colors__hex-input { padding: 0 }`, precisely because the inliner is
present there; that is why plain's colour field is 16 while its other nine are 28. Same renderer, two
treatments, one of them charged twice — the defect is legible inside one implementation without
comparing it to another.

`lit`'s colour field at 0 is a separate matter of the same family and not a matter of taste: the text
begins at the container's edge, touching the border.

## Decision

**A field's inner inset is declared in one place and applied once.** Where the inliner is drawn it is
the declaration, and the control inside it carries no inline padding of its own; where it is not, the
control's padding is the inset.

**The number is the same either way: `1rem`.** The inliner's leading inset moves from `0.75rem` to
`1rem` so that a renderer that draws it and a renderer that does not put the text in the same place —
the two spellings must agree, or the inliner becomes a way for one renderer to look different while
following the rules.

The asymmetry the inliner exists for is unchanged: the leading inset is the text's, the trailing one
stays `--mdy-affordance-inset`, and both stay logical so the pair survives `dir=rtl`.

## Amendment: a control the page hides is not where the writing begins

An earlier reading of this record named the colour field as unready for the decision, on a
measurement showing its writing at the container's edge. **That measurement was of the wrong
element, and the precondition it produced does not hold.**

A colour field carries two inputs. The platform's own picker — `type="color"`, opacity zero, taken
out of the flow — sits ahead of the hex box a person types into, so every selector that takes *the
first input that is not `type="hidden"`* measures a box no writing ever appears in. The type
exclusion does not reach it: it is hidden by style, not by type.

Measured on the box that is painted, the colour field's writing begins at the same place in all
three renderers. It is not an obstacle to this decision and never was.

What replaces the precondition is the general form, which is worth more: **a rule written about "the
control inside the wrapper" reaches whichever element the selector finds first, and a kind may put an
invisible one there.** A rule that zeroes padding on that element changes nothing a person sees while
appearing to have applied, and a probe that measures it reports a field with no inside.

Two further mechanisms make a correct cascade rule lose while looking applied, and both were met
applying this one:

- **Layer.** A zeroing rule written beside the inliner sits in the base layer; the control's padding
  is a component rule, and a later layer wins whatever the specificity says. The rule is correct,
  loses, and reads as applied.
- **Specificity inside the winning layer.** The control's padding is reached through a selector
  carrying two classes. A one-class selector loses to it — which is why a first attempt moved
  `textarea` and `select`, whose rules name them at one class or not at all, and left every text box
  where it was. Naming the wrapper twice ties it, and source order decides.

All three are why "the rule did not take" is a report about the cascade or about the selector rather
than about the rule, and why the check this record asks for prints its table on every run: **a number
that has not moved is the only way to tell a rule that lost from a rule that is wrong.**

A second divergence the same table shows is not addressed here: a date range begins its writing at 8
in two renderers against 16 in the third, which is its own question about a compound field's inner
box rather than about a declaration applied twice.

## Consequences

- Every renderer moves somewhere. Nine kinds in one of them come back 12px; a colour field that
  began at the container's edge gains an inset it never had; and a date range that two renderers draw
  at 8px joins the rest at 16. The claim worth making is narrower than "two renderers stay still":
  the number is the one already drawn by the largest number of kinds, so the change corrects outliers
  rather than relocating the design, and no kind moves that was not already disagreeing with itself
  across adapters.
- Committed screenshot baselines record the difference, so this arrives as a reviewable diff rather
  than as a claim. It is a visible change and it changes baselines in every theme.
- The asymmetric gap widens from 8px to 12px between the leading inset and the affordance inset. That
  is a consequence, not an intent: it follows from making the two declarations agree on the larger of
  the two numbers, chosen because it is the one two renderers already draw and the one no baseline has
  to move for.
- The control's own inline padding stops being load-bearing wherever the inliner exists, which means
  a future kind that draws the inliner and forgets to zero its control reproduces exactly this defect.
  That is what the check below is for.

## Alternatives rejected

**Zero the control and keep `0.75rem`**, making the inliner the single declaration at its current
number. Rejected: it moves all three renderers to 12px, changes every baseline in every theme for a
4px difference of principle, and buys nothing a person can see.

**Delete the inliner and let the control's padding be the inset everywhere.** It would work, and it
discards the RTL reasoning the inliner was written for — the asymmetric pair cannot be expressed on a
control whose padding is symmetric, and the record of why it is logical rather than physical would go
with it.

**Take the majority.** Two of three renderers draw 16, which is what a majority looks like, not what a
reason looks like. The reason here is that one renderer applies a declaration twice, and it is
demonstrable inside that renderer.

## Verification

`battle-tests/browser/` gains a check that measures the distance from a field's edge to the first
character, for every kind, in all three renderers, and fails when they disagree. It does not exist as
this record is written — the divergence was measured with a throwaway probe, which is evidence and
not a ratchet — and the record is worth less until it does.

What the check cannot decide is whether the shared number is right; it can only say the three agree.
A run in which every renderer moved to 4px would pass.

## Security and privacy

None. The horizontal position of text inside a field carries no data and crosses no boundary.
