---
"@modyra/core": patch
---

`@modyra/core` no longer names an adapter in its dev warnings.

Three warnings — `enableHistory()`, `enableDraft()` and async validators — told the reader to
"construct it with an Injector" "with the Angular adapter". A package naming its own dependent
inverts the dependency direction in prose while the import graph stays clean, and the advice was
wrong for every other adapter.

They now point at whichever reactivity adapter the caller is using. Dev-only (`MDY_DEV`), so nothing
ships differently in production.
