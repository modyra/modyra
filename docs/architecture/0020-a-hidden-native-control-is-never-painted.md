# ADR 0020: A hidden native control is never painted

Status: Accepted — amended, see [Amendment](#amendment-the-cause-is-narrower-here-than-the-evidence-supports)

## Context

Several widgets — checkbox, radio, toggle, segmented, file — keep a real native `<input>` and let a
sibling element draw the appearance. The input is moved off the screen and clipped to a single pixel
rather than removed, because `display: none` would take the accessibility tree, the tab order, the
form post and the native keyboard model with it.

The stylesheet also has field rules that match **any** input inside a renderer, including the focus
rule that gives a field its hover background and focus shadow. Nothing stopped those rules reaching a
control that has no visible surface, and the result was invisible in the ordinary sense: a background
painted on a clipped pixel produces the same screenshot whether it is right or wrong. Review could
not see it, and 216 screenshot baselines at zero tolerance could not see it.

What made it visible was that it stopped being invisible. In one engine, focusing a checkbox or a
radio in one theme **terminated the page** — reproducibly, in under a second, from the driver and
from inside the page alike. A keyboard user reaching any radio lost the document. Three test rows
were quarantined against it.

The cause took a long bisect and is worth stating precisely, because none of it is guessable from
reading the stylesheet:

| restored on the focused hidden control | result |
| --- | --- |
| the focus `box-shadow` alone | survives |
| **the focus `background-color` alone** | **page ends** |
| a flat colour as that background | survives |
| a single-level `color-mix()` as that background | survives |
| the same value on a normally sized input | survives |

The fatal combination is a **nested `color-mix()` painted as the background of a focused native
control clipped to one pixel**.

**And the nesting is emergent, not written.** No stylesheet here contains a nested `color-mix()`. The
token mixes two custom properties that are themselves mixes, so what is finally painted has a shape
no declaration states — which is why one theme was fatal and the others were not, and why grep found
nothing. A rule about what may be painted cannot be checked by reading the thing that paints it.

## Amendment: the cause is narrower here than the evidence supports

Added after this record was accepted, when a second crash — finding O in `docs/contract-gaps.md` —
was reduced by the same method and did not fit the story above.

O reduces to a single sufficient rule that paints a background on a **visible, normally sized** field
wrapper. There, **every value crashes**: a flat colour, a single-level mix, the nested mix written out
literally. The table above measured the opposite on the clipped control — a flat colour survived and
only the nested mix was fatal.

Both results are directly measured and neither is explained by the other. The reading that
accommodates both is that this is **not a value defect at all** but a threshold in the engine's paint
path, in which case a "necessary and sufficient" rule describes a tipping point in one page rather
than a cause. That is **Possible**, not demonstrated.

**What this changes here: the context, not the decision.** Do not read the table above as saying that
a nested `color-mix()` is what is dangerous, or that clipping is what makes it so. What is established
is that removing paint from elements that cannot show it removed the crash on the path it covers, and
that the keyboard row skipped for that cause now passes on every engine.

**The rule stands without any of it.** Painting a colour on a clipped pixel is invisible by
construction, so the decision would be the same on an engine that merely wasted a composite — which
is the ground it was argued on, and why this is an amendment rather than a supersession.

## Decision

**A visually hidden native control carries state and focus. It never carries paint.**

The hiding pattern is declared once, for every widget that uses it, and clears the paint properties
along with the geometry:

```css
background-color: transparent;
box-shadow: none;
```

Clearing is deliberate rather than merely not setting: the rules that reach these elements are
general ones matching every input in a renderer, so the question is not whether paint is declared
here but whether it can arrive from elsewhere.

**The pattern is one rule, not six.** It was duplicated per widget, which is how five of six copies
could have been fixed and the sixth left behind — and the two that were fatal were not the two anyone
would have guessed.

## Consequences

- **A renderer cannot style a hidden control's own surface.** It has none. Any focus or state
  appearance belongs to the indicator that is actually drawn, which is where every renderer already
  put it.
- **A widget that adopts the hiding pattern must join the shared rule** rather than copy it. A copy
  is a control outside the guarantee, and the selector list is where that is visible.
- **The specificity is now load-bearing.** Two selectors are written with an attribute qualifier they
  do not need for matching, so that they are not outranked by the field rules they exist to override.
  That is fragile in the ordinary way of CSS, and the browser test is what holds it.
- **The engine defect is not fixed, only unreached.** A future rule painting an emergent nested
  `color-mix()` on some other clipped element would terminate the page again, and nothing here
  prevents that. What this decision removes is the whole class of *painting the unpainted*, which is
  the part that was ours to get wrong.
- **The rule stands without the crash.** Painting a colour nobody can see was pointless before it was
  dangerous; the decision would be the same on an engine where it merely wasted a composite.

## Alternatives rejected

**Fix the token so it does not nest.** Treats the symptom at its most specific point. The nesting is
produced by variable substitution across three layers of theming, so "do not nest" is a rule no
author can check while writing a theme, and it leaves every other rule free to paint hidden controls.

**Exclude hidden controls from the field rules with `:not(…)`.** Same effect, stated as a growing
list of exceptions in the rule that must not match rather than as a property of the elements it must
not match. Every new hidden control would have to be added to a selector far away from itself, and
forgetting is silent.

**Scope the field rules to the visible field box.** Narrower and initially attractive, but measurement
killed it: a timepicker's number input, a multiselect's search and a slider's range are all visible,
all painted, and all outside that box. It would have removed focus styling from three real controls
to protect five invisible ones.

**Quarantine the affected rows and record the engine defect.** What was in place. Rejected because
the defect is reachable by any keyboard user on that engine, and because the rule that produced it
was wrong on its own terms.

## Verification

`e2e/shared/hidden-controls.spec.ts`, on all nine renderer/engine projects. For each hidden control
it asserts the control is genuinely clipped, focuses it, and asserts that nothing is painted and that
the page still answers.

**It is a rule test, not a crash test**, and the mutation shows why that matters: with the fix
reverted, the affected engine fails at the focus call while the others fail on the painted value. An
engine that merely tolerates the paint still reports the violation, so the guard does not depend on
any engine continuing to be strict about it.

The test also counts what it asserted and fails when nothing matched, because a stale selector list
would otherwise pass by checking nothing — the failure mode the widget contract has now hit several
times.

The 216 zero-tolerance screenshot baselines pass unchanged, which is the evidence that removing the
paint changed nothing visible. That is a weak check here by construction, and it is reported as such:
it could not have detected the defect either.

## Security and privacy

No trust boundary, no data at rest or in transit, and nothing an attacker gains.

The impact is availability and accessibility, and it is the substance rather than a footnote. The
behaviour this removes ended the document for anyone who reached a checkbox or a radio **with the
keyboard** — pointer users clicked the visible indicator and never focused the hidden input. A defect
that terminates the page only for users who do not point at what they want is one that routine use
will not find.
