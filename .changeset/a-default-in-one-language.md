---
"@modyra/widgets": major
"@modyra/plain": patch
"@modyra/lit": patch
---

What a chooser shows before anything is chosen comes from the message catalogue.

Two renderers wrote their own default in English — `"Select…"` in plain's select, `` `Select ${label}…` ``
in lit's multiselect — so a form whose every other word had been translated had an English word inside
it, and the two renderers disagreed about what the word was.

`MdyI18nMessages` gains `selectPlaceholder`, supplied for all five built-in locales. A caller that
wants silence passes an empty string.

**Migration.** The member is required, like every other in the catalogue: a consumer that builds a full
`MdyI18nMessages` literal must add `selectPlaceholder`. Making it optional would have put the fallback
back in the renderers, which is where the English defaults came from. `MDY_I18N_PRESETS` and the five
exported locales already carry it, so a consumer using those needs no change.
