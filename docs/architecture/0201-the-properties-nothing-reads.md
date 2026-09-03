# ADR 0201: The custom properties nothing reads are removed, and seven that look alike are kept

Status: Accepted

## Context

The orphan dossier measured every `--mdy-*` custom property the theme sheets declare outside the
tiers, and split what nothing here reads into two halves: those that are a step of a scale whose
siblings are read, and 49 that no file reads and that have no read sibling either — alone in their
family. The owner decided to remove the 49 for 3.0.0.

**The premise did not hold for seven of them, and the evidence was already in the repository.**
`contract-diff` reads the step names of `modyra-scale.css` and says of them, in its own words:

> The scale's step names, **which are public surface**. A consumer builds a theme by setting these;
> renaming one breaks them exactly as renaming a part does.

Seven of the 49 are those steps. Both instruments are right, because they measure different acts: the
CSS audit counts who **reads** a property, and nothing in this library reads a scale step — the
consumer **writes** it. A `var()` is not the only way a property is surface, and until now neither
tool knew what the other could see.

## Decision

**The 42 are removed. The seven are kept.** The owner's intent — remove what nobody uses — applied to
the corrected premise keeps the steps, because by the definition of a scale somebody does use them.

Removed, 52 declarations across the theme sheets, since several were declared in more than one:

- `--mdy-base-bg`
- `--mdy-datepicker-cell-border-radius`
- `--mdy-datepicker-header-gap`
- `--mdy-datepicker-icon-size`
- `--mdy-datepicker-modal-bg`
- `--mdy-datepicker-modal-radius`
- `--mdy-datepicker-nav-btn-size`
- `--mdy-datepicker-outside-opacity`
- `--mdy-fl-label-active-top`
- `--mdy-fl-prefix-width`
- `--mdy-ios-elevated-bg`
- `--mdy-ios-grouped-bg`
- `--mdy-ios-opaque-separator`
- `--mdy-ios-quaternary-fill`
- `--mdy-ios-quaternary-label`
- `--mdy-ios-secondary-elevated-bg`
- `--mdy-ios-tertiary-elevated-bg`
- `--mdy-ios-tertiary-grouped-bg`
- `--mdy-ios-text-body`
- `--mdy-ios-text-callout`
- `--mdy-ios-text-callout-tracking`
- `--mdy-ios-text-caption1`
- `--mdy-ios-text-caption2`
- `--mdy-ios-text-caption2-tracking`
- `--mdy-ios-text-footnote`
- `--mdy-ios-text-headline`
- `--mdy-ios-text-large-title`
- `--mdy-ios-text-large-title-tracking`
- `--mdy-ios-text-subheadline`
- `--mdy-ios-text-title1`
- `--mdy-ios-text-title1-tracking`
- `--mdy-ios-text-title2`
- `--mdy-ios-text-title2-tracking`
- `--mdy-ios-text-title3`
- `--mdy-ios-text-title3-tracking`
- `--mdy-md-chroma-neutral-variant`
- `--mdy-on-error-container`
- `--mdy-spin-btn-size`
- `--mdy-state-disabled-container-opacity`
- `--mdy-state-disabled-content-opacity`
- `--mdy-state-focus-opacity`
- `--mdy-state-hover-opacity`

Kept, and named here because a record that lists only what was taken teaches nobody where the line
runs:

- `--mdy-duration-1`
- `--mdy-duration-2`
- `--mdy-focus-offset`
- `--mdy-focus-width`
- `--mdy-leading-1`
- `--mdy-leading-2`
- `--mdy-leading-3`

They are surface **that is set, not read**. Removing one would take away a name a theme author is
expected to write, and no reader-count inside this repository can see that.

## Consequences

- A consumer whose own stylesheet reads one of the 42 gets no error and no fallback: a `var()` of an
  undeclared property resolves to nothing and the declaration it feeds is dropped. The only way to
  discover the loss is to find the name on the list above, which is why it is a list.
- **The audit's categories are relative, so its numbers after this are derived rather than
  predicted.** Removing members changes which properties still have a read sibling: the audit now
  reports 43 in the scale-step half and 10 alone, against 41 and 49 before. Neither pair is wrong —
  the families shrank — and the numbers are recorded here as the outcome rather than as a target,
  because a target would have been missed by arithmetic that does not apply.
- `contract:diff` reports the contract unchanged, which is the check that the scale survived: the
  first attempt at this removal took the seven with it and the differ called it `major` seven times.

## Alternatives rejected

- **All 49.** It would remove names a theme author sets, on the strength of a measurement that cannot
  see them being set. Still open as a decision, but it would have to be taken knowing that — not
  under the sentence "nothing reads them".
- **Document them instead.** Documenting a property nothing reads teaches a consumer to depend on
  something no test exercises, which is how these came to exist.

## Verification

`npm run test:css-variables` and `npm run contract:diff` before and after. Declared falls from 713 to
671; the contract is unchanged, which is what says the scale is intact.

Each of the 49 was checked against an exact `var(--name)` boundary before any removal, and two
apparent readers were not: one a prefix match on a longer name, one a mention inside a CSS comment.
The dossier had recorded both traps already, and both were met again without being recognised from
the page — reading a rule is not the same as holding it.

## Security and privacy

None. A custom property nothing reads carries no data and grants no access. The adjacent risk is
compatibility, not security: a consumer's theme reading a removed name loses that declaration
silently, which is why the names are listed rather than counted.
