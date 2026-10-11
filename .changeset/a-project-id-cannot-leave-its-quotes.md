---
"@modyra/studio-model": patch
---

A project id cannot leave its quotes

Studio writes every identifier a project carries into quoted HTML attributes and CSS selectors. A
project file is untrusted input, and an id holding a quote and markup ran script when the project
was opened. `loadProject` now refuses a project whose ids, references or implementation keys fall
outside `[A-Za-z0-9_.:-]` (up to 128 characters), naming the first offending path. Ids Studio
generates are unaffected. ADR 0217.

**Migration.** A hand-written project using other characters in an id will not open until that id
is renamed, together with the references to it.
