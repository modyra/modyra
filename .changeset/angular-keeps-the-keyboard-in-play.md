---
"@modyra/angular": patch
---

A field taken out of play under the cursor no longer costs the person their place.

Disabling a focused element blurs it, which is the platform; what followed was the adapter's. Someone
typing into a field a rule disabled — a value arriving from a fetch, a condition turning false — was
left on `<body>`, so their next Tab started at the top of the document and nothing said where they
had gone. Read-only was already the proof it need not: a read-only field keeps the keyboard.

Every renderer now calls `keepKeyboardInPlay` from `@modyra/widgets`, the same helper `@modyra/plain`
and `@modyra/lit` call, which places focus on the next thing that can take it, the previous one
otherwise, and the widget's own root as a last resort.
