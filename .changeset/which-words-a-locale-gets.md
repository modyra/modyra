---
"@modyra/widgets": minor
---

`messagesForLocale` — which words a locale gets, decided once

The message tables were keyed by primary subtag and nothing turned a locale tag
into one. Every renderer that wanted to translate had to parse `it-IT` itself,
which is three answers to "what does `pt-BR` get" waiting to happen.

`messagesForLocale(tag)` takes a tag in any case, matches on the primary subtag
because a region does not change what a confirm button says, and falls back to
English rather than to blanks.

It does not yet have a consumer: the framework-free and Lit renderers still
hardcode English, and this is the piece they were missing.
