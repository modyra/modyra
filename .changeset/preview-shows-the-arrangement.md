---
"@modyra/studio-ui": patch
---

Preview shows the arrangement it is previewing

Preview is the third renderer of the same layout and it was the one left behind. `mountArrangement`
wrote the declared column count by hand and ignored the row's `at` and every slot's `at`, so the
per-breakpoint counts, per-size column placement and per-size visibility were authorable, compiled,
shipped — and invisible in the one panel that exists to show them. A row drew the same arrangement at
every width while the form it previews changed at three.

It now calls the same `layoutNodeAttributes` the two shipping renderers call, and applies
`layoutSlotStyle` to the **column**, which is the grid item that can act on it — the same reading as
`@modyra/plain` and `<mdy-dynamic-form>`, so the panel and the form cannot disagree about where a
field goes or whether it shows.

The preview container is also named `mdy-dynamic-form`, like the other two renderers' roots.

One consequence worth stating: a row now stacks in Preview at the narrowest size and takes its
declared tracks from `sm` up, because that is what the shipped form does. Preview used to show the
declared count flat at every width, which read as "two columns" no matter how narrow the panel was.
