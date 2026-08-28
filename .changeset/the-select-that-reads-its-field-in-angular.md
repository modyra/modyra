---
"@modyra/angular": major
---

The Angular select reads its field, and a gate that had been measuring a three-week-old build says so

**Breaking: `MdyAngularSelectAdapterOptions` now requires a `handle` and no longer takes `onChange`,
`value`, `disabled` or `invalid`; `MdyAngularSelectAdapter` loses `setValue`, `setDisabled` and
`setInvalid`, and gains `setDescribedBy` and `setPopupRendered`.**

The select was the last kind here still driven by imperative setters where its eight siblings take a
field handle and read it. It now builds `createSelectFieldController` like the others, and is built
on the first read rather than in the constructor — a `name`-bound field has no handle until the
registry resolves it, and a renderer that latched before it arrived cached nothing for the life of
the component.

Two things this surfaced, both worth more than the change itself:

**`selectionChange` had stopped firing for the panel.** Choosing from the list the renderer draws
went silent while the native control kept announcing, so a host binding the output heard half the
choices. Nothing asserted it — the whole suite was green with the output dead on one of its two
paths. It now emits after the write, comparing before and after, so both paths mean the same thing.

**`test:type-surface` was comparing this package against a build from three weeks earlier.** It reads
declarations, and for a package that emits them through a build it reads the build; nothing in the
suite rebuilds one. It answered "unchanged" with a gate's authority for every change it could not
see — including members removed in earlier work, which this release finally classifies. The audit now
refuses a `dist/` older than its `src/` and names the command that repairs it, rather than measuring
the past and reporting it as the present.
