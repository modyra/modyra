---
"@modyra/core": patch
---

A document declaring `version: 1` reports `MDY_DYNAMIC_DEPRECATED_VERSION`: no published schema
describes v1, no fixture measures it, and the Rust and Java readers of this contract do not have it.
It is a warning, so a v1 document still parses and still renders — a bare field array, which declares
no version at all, is unaffected. A v2 or v3 document carrying `requiresContext` is reported too: it
arrived with v4, and all three readers now say so.
