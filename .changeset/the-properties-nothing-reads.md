---
"@modyra/styles": major
---

Remove the custom properties nothing reads

42 custom properties declared by the theme sheets are removed — 52 declarations, since several were
declared in more than one theme. Each had no reader anywhere in this library and no read sibling in
its own family: not a scale whose other steps are used, but a name alone.

**Read this list if you write your own theme.** `@modyra/styles` is published, so a property no file
in the library reads may still be read by a stylesheet somebody else wrote — a measurement inside this
repository cannot see that. A `var()` of an undeclared property resolves to nothing and the
declaration it feeds is dropped: no error, no fallback, no console warning. The only way to discover
the loss is to find the name here.

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

**Seven properties that looked identical to these are kept**, and the reason is worth stating because
it nearly went the other way: the step names of `modyra-scale.css` are surface a theme author *sets*
rather than surface the library *reads*, so a reader-count reported them as unused. They are named in
ADR 0201 alongside the removals.

**Classified by hand where no tool covers it.** `contract:diff` sees the scale steps — it called
their removal `major` seven times when the first attempt took them — and reports this change as
leaving the contract untouched, which is the check that the scale survived. It has no path for the
other theme properties, so `major` here is a judgement: removing a published declaration with no
replacement breaks whoever set it.
