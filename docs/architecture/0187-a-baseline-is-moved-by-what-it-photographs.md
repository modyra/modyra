# ADR 0187: A baseline is moved by what it photographs

Status: Accepted

## Context

The plain renderer's front door became a page written to be read: six sections, a sticky nav,
headings and prose. The visual suite photographed that page, and fourteen images went red the day it
changed.

The images that moved were not of the page. They were per-widget frames, and their diagnosis is a
measurement rather than an impression: a widget's box is a whole number of pixels and its position is
not. One sat at `y = 2266.391` with a height of exactly 62, and a capture at a fractional offset
rounds one way or the other — same width, one pixel shorter. Seventy-two elements on that page carry
a fractional height, every heading and every line of prose among them, so any widget below them lands
on a half pixel.

The cheap repair was tried and is dead: scrolling the fraction away leaves it where it was
(`2266.391 → 0.391 → 0.391`), because the browser snaps scroll offsets and the fraction comes from
layout above rather than from the scroll. The bench carries fractional heights too, so no host
removes the sensitivity.

What remained was not a defect to fix but a question of what the images are hostage to. On the demo
page, a sentence rewritten anywhere above a widget re-rounds it. The cost is not the re-recording —
that is cheap and automated. The cost is that a prose edit arrives as fourteen widget regressions,
and the habit that teaches is re-recording without looking, which is the one habit that makes a
screenshot suite worthless.

## Decision

**A visual baseline lives on the page whose changes it should answer for.** The plain suite
photographs the bench, which holds every kind and nothing else, so an image moves when the widget
moves. The demo page keeps no baseline: it is prose, and prose is reviewed by reading it.

The entry is declared per fixture rather than in the shared helper, because only one renderer's front
door became a page to read and the other has no bench to move to.

**A kind that has been argued about earns its own frame.** The range had none in either renderer, so
when its inner inset moved by eight pixels the only image that could see it was the full-page shot —
where the change arrives as a couple of hundred pixels among a few hundred thousand,
indistinguishable from the page having been edited. That is how a correction to one widget presented
as seven unexplained failures.

## Consequences

240 images were re-recorded once — 120 on darwin here, 120 by the recorder workflow, which exists
because a linux baseline cannot be taken on macOS. That price is paid once; the alternative was
paying a smaller one on every edit to a page written to be edited.

Coverage was checked before the move rather than assumed: the bench draws all fifteen kinds and
carries the same theme link as the demo page, so nothing the suite watched stopped being watched.

The demo page is now unphotographed. A visual regression that only appears there — a section that
collapses, a nav that overlaps — will not be caught by this suite. That is accepted: the page exists
to be read and rewritten, and a baseline over it would be red more often from writing than from
breaking.

The sensitivity to fractional layout is not removed, only made rare. A widget on the bench can still
land on a half pixel if something above it gains a fractional height, and the same one-pixel report
will follow. What changed is that it will follow a change to the bench, which is a change to what the
suite is about.

### The same family, outside images: a tool reporting its own spelling as a change

This record is about a baseline moved by what it photographs. The type surface has the shape without
a camera, and naming it here keeps a reader from meeting it twice as two problems.

Its keys carry a member's type as text, so **renaming a type inside a signature moves the key while
the signature means exactly what it meant**. Removing three aliases produced nine `major` lines: three
were the removals, and six were signatures that now print `MdyDynamicBreakpoint` where they printed
`MdyLayoutBreakpoint` — the same type, since one was an alias of the other.

The verdict was right and six of its nine reasons were spelling. That is the dangerous arrangement:
a correct classification supported by lines a reader must check individually to discover that most
of them say nothing. It is not fixed here, and it is not the same as the `const->` key defect that
was fixed — that one invented removals, this one describes real entries in a form that cannot
distinguish a rename from a change.

The instrument's own reformatting is the other half. When the key format changed, every constant read
as removed-and-added until the baseline was rewritten; the rewrite was done by transforming the
recorded file rather than rebuilding it, so "reformatted, not changed" is a property of the
transformation instead of a claim about the result. That is the strongest form available for this
class of change, and worth copying the next time a baseline's spelling moves.

## Alternatives rejected

**Stay on the demo page and re-record the fourteen.** Fourteen images against 240 is a real
difference and it was put to the user with both numbers. It loses on what it trains: every prose edit
produces widget-shaped failures, and the reviewer learns to accept them.

**Split — per-widget frames on the bench, full-page frames on the demo page.** More precise on paper.
It keeps 48 baselines over a page built to evolve, which move on every sentence, so it retains the
habit it was meant to remove.

**Nudge the widget onto an integer offset before capture.** Would have cost zero re-recordings.
Measured and refuted: the scroll offset snaps, and the fraction is upstream of it.

## Verification

`npx playwright test e2e/lit/visual.spec.ts e2e/plain/visual.spec.ts`, and the full browser matrix in
CI, which is where a linux baseline is compared.

The move was checked in both directions rather than by a green run alone: after re-recording, no
plain image moved when the range's frame was added, which is the control on the whole account —
plain had already absorbed that correction, and an image moving there would have meant the
explanation was wrong.

One baseline resisted three times and the resolution is worth recording, because the reasoning that
failed is more instructive than the one that worked. The recorder produced 283935 bytes for a lit
page image where the repository held 283957, and it was twice dismissed as re-encoding noise on the
grounds that two runs agreeing meant a value that flaps. That is backwards: agreement across
independent runs is evidence the render is stable and the baseline is wrong. The third reading was
not another argument but the artefact CI uploads — the `-diff` image, which put every differing pixel
inside the range field, the one widget whose inset had changed two days after that baseline was
recorded.

## Security and privacy

None. Screenshots are of a local demo page carrying invented data, taken in CI and committed to the
repository; no fixture holds credentials or personal data, and the recorder workflow publishes an
artifact of the same images it recorded from the same public checkout.
