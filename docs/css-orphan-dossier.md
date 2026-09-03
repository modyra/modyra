# CSS custom properties nothing here reads, measured

What a decision about removing or documenting them would need to know, gathered before the decision
is asked for. Nothing here is a recommendation beyond the two lines each half carries; every row is a
count and where it came from.

## What a zero means here, and what it does not

**`@modyra/styles` is published, and these sheets ship.** A property no file in this repository
reads may be read by a theme somebody else wrote, in CSS this measurement cannot see. So every row
below reads *no reader measurable here*, never *no reader*. A CSS custom property is a declaration
aimed at whoever loads the stylesheet: it has no call site to count, which is exactly why a grep
answers a narrower question than the one a removal asks.

**Perimeter.** Declarations: every `--mdy-*` custom property declared in `packages/styles/src/*.css`,
outside the three tiers `modyra-base.css` names in its header. Readers: every `var(--mdy-*)` in a
**written** file under `packages`, `examples`, `apps` and `site/src` — comments stripped, and
generated or vendored files excluded by asking version control rather than by path.

**Two corrections stand in this page rather than behind it**, because each changed the answer.

*A vendored copy read us back.* A gitignored copy of our own default stylesheet sits under the
Angular example's build directory. Counted as a reader it made 317 properties look like consumer surface where six
are: our CSS reading itself.

*A grep read a comment.* Checking a sample by hand, `grep` reported `--mdy-base-bg` as read in
`modyra-material.css`. The occurrence is inside a comment. The instrument, which strips them, was
right; the check being used to check it was not.

**A document that shows a use is not a reader.** Four properties appear in `var()` inside code fences
in `docs/`. Counting those took the total from 90 to 86 — documentation *of* a use, read as the use.

## The two halves

| | properties | what the shape says |
| --- | ---: | --- |
| a step of a scale whose siblings are read | 41 | the scale is published whole; the unused step is completeness |
| alone in its family | 49 | nothing near it is read either |

Every one of the 90 was last touched in July or August 2026. None is old cruft, which is
the evidence against reading them as dead and for reading them as surface nobody has exercised.

## 41 — a step of a scale whose siblings are read

**These document with their scale.** `--mdy-corner-none` sits in a family of five of which four are
read: publishing a scale and omitting the step nobody happened to need would be the defect, not the
fix. No removal question arises for these; they belong in the guide beside their siblings.

| property | declared in | family | siblings read | last touched |
| --- | --- | ---: | ---: | --- |
| `--mdy-checkbox-tick-left` | modyra.css | `--mdy-checkbox-tick-*` (3) | 2 | 2026-07-28 |
| `--mdy-checkbox-tick-offset` | modyra.css | `--mdy-checkbox-tick-*` (3) | 2 | 2026-07-28 |
| `--mdy-control-2` | modyra-scale.css | `--mdy-control-*` (3) | 3 | 2026-08-23 |
| `--mdy-corner-extra-large` | modyra.css | `--mdy-corner-extra-*` (1) | 1 | 2026-07-18 |
| `--mdy-corner-none` | modyra.css | `--mdy-corner-*` (4) | 4 | 2026-07-18 |
| `--mdy-datepicker-popup-border` | modyra-ios.css, modyra-material.css | `--mdy-datepicker-popup-*` (3) | 2 | 2026-07-18 |
| `--mdy-datepicker-popup-padding` | modyra-ios.css, modyra.css | `--mdy-datepicker-popup-*` (3) | 2 | 2026-07-18 |
| `--mdy-datepicker-today-ring` | modyra-ionic.css, modyra-ios.css | `--mdy-datepicker-today-*` (1) | 1 | 2026-07-18 |
| `--mdy-daterange-endpoint-color` | modyra-ios.css, modyra-material.css, modyra.css | `--mdy-daterange-endpoint-*` (1) | 1 | 2026-07-18 |
| `--mdy-error-container` | modyra-material.css, modyra.css | `--mdy-error-*` (1) | 1 | 2026-07-18 |
| `--mdy-floating-input-height` | modyra.css | `--mdy-floating-input-*` (1) | 1 | 2026-07-31 |
| `--mdy-input-border` | modyra-ionic.css, modyra-ios.css | `--mdy-input-*` (4) | 4 | 2026-08-05 |
| `--mdy-ios-brown` | modyra-ios.css | `--mdy-ios-*` (23) | 14 | 2026-08-05 |
| `--mdy-ios-cyan` | modyra-ios.css | `--mdy-ios-*` (23) | 14 | 2026-08-05 |
| `--mdy-ios-glass-tint-plus-dark` | modyra-ios.css | `--mdy-ios-glass-tint-plus-*` (1) | 1 | 2026-08-05 |
| `--mdy-ios-gray2` | modyra-ios.css | `--mdy-ios-*` (23) | 14 | 2026-07-18 |
| `--mdy-ios-indigo` | modyra-ios.css | `--mdy-ios-*` (23) | 14 | 2026-08-05 |
| `--mdy-ios-mint` | modyra-ios.css | `--mdy-ios-*` (23) | 14 | 2026-08-05 |
| `--mdy-ios-orange` | modyra-ios.css | `--mdy-ios-*` (23) | 14 | 2026-08-05 |
| `--mdy-ios-pink` | modyra-ios.css | `--mdy-ios-*` (23) | 14 | 2026-08-05 |
| `--mdy-ios-purple` | modyra-ios.css | `--mdy-ios-*` (23) | 14 | 2026-08-05 |
| `--mdy-ios-secondary-fill` | modyra-ios.css | `--mdy-ios-secondary-*` (2) | 2 | 2026-08-05 |
| `--mdy-ios-teal` | modyra-ios.css | `--mdy-ios-*` (23) | 14 | 2026-08-05 |
| `--mdy-ios-tracking-caption` | modyra-ios.css | `--mdy-ios-tracking-*` (3) | 2 | 2026-08-05 |
| `--mdy-ios-tracking-subheadline` | modyra-ios.css | `--mdy-ios-tracking-*` (3) | 2 | 2026-08-05 |
| `--mdy-ios-yellow` | modyra-ios.css | `--mdy-ios-*` (23) | 14 | 2026-08-05 |
| `--mdy-md-chroma-neutral` | modyra-material.css | `--mdy-md-chroma-*` (4) | 4 | 2026-08-05 |
| `--mdy-radius-0` | modyra-scale.css | `--mdy-radius-*` (4) | 2 | 2026-08-23 |
| `--mdy-radius-2` | modyra-scale.css | `--mdy-radius-*` (4) | 2 | 2026-08-23 |
| `--mdy-radius-3` | modyra-scale.css | `--mdy-radius-*` (4) | 2 | 2026-08-23 |
| `--mdy-secondary` | modyra-material.css | `--mdy-*` (5) | 4 | 2026-08-05 |
| `--mdy-shadow-depth-3` | modyra.css | `--mdy-shadow-depth-*` (2) | 2 | 2026-08-05 |
| `--mdy-size-6` | modyra-scale.css | `--mdy-size-*` (6) | 6 | 2026-08-23 |
| `--mdy-slider-fill-pct` | modyra.css | `--mdy-slider-fill-*` (1) | 1 | 2026-07-31 |
| `--mdy-space-6` | modyra-scale.css | `--mdy-space-*` (8) | 6 | 2026-08-23 |
| `--mdy-space-7` | modyra-scale.css | `--mdy-space-*` (8) | 6 | 2026-08-23 |
| `--mdy-space-8` | modyra-scale.css | `--mdy-space-*` (8) | 6 | 2026-08-23 |
| `--mdy-tertiary` | modyra-material.css | `--mdy-*` (5) | 4 | 2026-08-05 |
| `--mdy-z-modal` | modyra.css | `--mdy-z-*` (5) | 3 | 2026-07-30 |
| `--mdy-z-raised` | modyra.css | `--mdy-z-*` (5) | 3 | 2026-07-28 |
| `--mdy-z-sticky` | modyra.css | `--mdy-z-*` (5) | 3 | 2026-07-28 |

## 49 — alone in its family

**These are a decision for the user, and this page does not take it.** Nothing near them is read
either, so the scale argument does not apply — but neither does "dead": they are recent, they are
published, and a property is read by loading a stylesheet, not by calling it. Removing one is a
removal from a public surface, and `contract:diff` has no classification path for CSS, which is the
condition on which the standing authority stops.

| property | declared in | family | siblings read | last touched |
| --- | --- | ---: | ---: | --- |
| `--mdy-base-bg` | modyra-ios.css | `--mdy-base-*` (0) | 0 | 2026-07-18 |
| `--mdy-datepicker-cell-border-radius` | modyra-ionic.css | `--mdy-datepicker-cell-border-*` (0) | 0 | 2026-07-18 |
| `--mdy-datepicker-header-gap` | modyra-ios.css | `--mdy-datepicker-header-*` (0) | 0 | 2026-07-18 |
| `--mdy-datepicker-icon-size` | modyra-ios.css | `--mdy-datepicker-icon-*` (0) | 0 | 2026-07-18 |
| `--mdy-datepicker-modal-bg` | modyra.css | `--mdy-datepicker-modal-*` (1) | 0 | 2026-07-30 |
| `--mdy-datepicker-modal-radius` | modyra.css | `--mdy-datepicker-modal-*` (1) | 0 | 2026-07-30 |
| `--mdy-datepicker-nav-btn-size` | modyra-ios.css | `--mdy-datepicker-nav-btn-*` (0) | 0 | 2026-07-18 |
| `--mdy-datepicker-outside-opacity` | modyra-ios.css | `--mdy-datepicker-outside-*` (0) | 0 | 2026-07-18 |
| `--mdy-duration-1` | modyra-scale.css | `--mdy-duration-*` (1) | 0 | 2026-08-23 |
| `--mdy-duration-2` | modyra-scale.css | `--mdy-duration-*` (1) | 0 | 2026-08-23 |
| `--mdy-fl-label-active-top` | modyra.css | `--mdy-fl-label-active-*` (0) | 0 | 2026-07-31 |
| `--mdy-fl-prefix-width` | material-filled-field.css | `--mdy-fl-prefix-*` (0) | 0 | 2026-07-29 |
| `--mdy-focus-offset` | modyra-scale.css | `--mdy-focus-*` (1) | 0 | 2026-08-23 |
| `--mdy-focus-width` | modyra-scale.css | `--mdy-focus-*` (1) | 0 | 2026-08-23 |
| `--mdy-ios-elevated-bg` | modyra-ios.css | `--mdy-ios-elevated-*` (0) | 0 | 2026-08-05 |
| `--mdy-ios-grouped-bg` | modyra-ios.css | `--mdy-ios-grouped-*` (0) | 0 | 2026-08-05 |
| `--mdy-ios-opaque-separator` | modyra-ios.css | `--mdy-ios-opaque-*` (0) | 0 | 2026-08-05 |
| `--mdy-ios-quaternary-fill` | modyra-ios.css | `--mdy-ios-quaternary-*` (1) | 0 | 2026-08-05 |
| `--mdy-ios-quaternary-label` | modyra-ios.css | `--mdy-ios-quaternary-*` (1) | 0 | 2026-08-05 |
| `--mdy-ios-secondary-elevated-bg` | modyra-ios.css | `--mdy-ios-secondary-elevated-*` (0) | 0 | 2026-08-05 |
| `--mdy-ios-tertiary-elevated-bg` | modyra-ios.css | `--mdy-ios-tertiary-elevated-*` (0) | 0 | 2026-08-05 |
| `--mdy-ios-tertiary-grouped-bg` | modyra-ios.css | `--mdy-ios-tertiary-grouped-*` (0) | 0 | 2026-08-05 |
| `--mdy-ios-text-body` | modyra-ios.css | `--mdy-ios-text-*` (9) | 0 | 2026-08-05 |
| `--mdy-ios-text-callout` | modyra-ios.css | `--mdy-ios-text-*` (9) | 0 | 2026-08-05 |
| `--mdy-ios-text-callout-tracking` | modyra-ios.css | `--mdy-ios-text-callout-*` (0) | 0 | 2026-08-05 |
| `--mdy-ios-text-caption1` | modyra-ios.css | `--mdy-ios-text-*` (9) | 0 | 2026-08-05 |
| `--mdy-ios-text-caption2` | modyra-ios.css | `--mdy-ios-text-*` (9) | 0 | 2026-08-05 |
| `--mdy-ios-text-caption2-tracking` | modyra-ios.css | `--mdy-ios-text-caption2-*` (0) | 0 | 2026-08-05 |
| `--mdy-ios-text-footnote` | modyra-ios.css | `--mdy-ios-text-*` (9) | 0 | 2026-08-05 |
| `--mdy-ios-text-headline` | modyra-ios.css | `--mdy-ios-text-*` (9) | 0 | 2026-08-05 |
| `--mdy-ios-text-large-title` | modyra-ios.css | `--mdy-ios-text-large-*` (0) | 0 | 2026-08-05 |
| `--mdy-ios-text-large-title-tracking` | modyra-ios.css | `--mdy-ios-text-large-title-*` (0) | 0 | 2026-08-05 |
| `--mdy-ios-text-subheadline` | modyra-ios.css | `--mdy-ios-text-*` (9) | 0 | 2026-08-05 |
| `--mdy-ios-text-title1` | modyra-ios.css | `--mdy-ios-text-*` (9) | 0 | 2026-08-05 |
| `--mdy-ios-text-title1-tracking` | modyra-ios.css | `--mdy-ios-text-title1-*` (0) | 0 | 2026-08-05 |
| `--mdy-ios-text-title2` | modyra-ios.css | `--mdy-ios-text-*` (9) | 0 | 2026-08-05 |
| `--mdy-ios-text-title2-tracking` | modyra-ios.css | `--mdy-ios-text-title2-*` (0) | 0 | 2026-08-05 |
| `--mdy-ios-text-title3` | modyra-ios.css | `--mdy-ios-text-*` (9) | 0 | 2026-08-05 |
| `--mdy-ios-text-title3-tracking` | modyra-ios.css | `--mdy-ios-text-title3-*` (0) | 0 | 2026-08-05 |
| `--mdy-leading-1` | modyra-scale.css | `--mdy-leading-*` (2) | 0 | 2026-08-23 |
| `--mdy-leading-2` | modyra-scale.css | `--mdy-leading-*` (2) | 0 | 2026-08-23 |
| `--mdy-leading-3` | modyra-scale.css | `--mdy-leading-*` (2) | 0 | 2026-08-23 |
| `--mdy-md-chroma-neutral-variant` | modyra-material.css | `--mdy-md-chroma-neutral-*` (0) | 0 | 2026-08-05 |
| `--mdy-on-error-container` | modyra-material.css, modyra.css | `--mdy-on-error-*` (0) | 0 | 2026-07-18 |
| `--mdy-spin-btn-size` | modyra.css | `--mdy-spin-btn-*` (0) | 0 | 2026-08-03 |
| `--mdy-state-disabled-container-opacity` | modyra.css | `--mdy-state-disabled-container-*` (0) | 0 | 2026-07-18 |
| `--mdy-state-disabled-content-opacity` | modyra.css | `--mdy-state-disabled-content-*` (0) | 0 | 2026-07-18 |
| `--mdy-state-focus-opacity` | modyra.css | `--mdy-state-focus-*` (0) | 0 | 2026-07-18 |
| `--mdy-state-hover-opacity` | modyra.css | `--mdy-state-hover-*` (0) | 0 | 2026-07-18 |
