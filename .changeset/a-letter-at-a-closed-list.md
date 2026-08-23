---
"@modyra/plain": patch
---

A letter typed at a closed select chooses, instead of reaching nothing.

Type-ahead was wired to the open list only, where a letter moves the reading position and leaves the
value alone. Closed there is no reading position to move, and every platform takes the letter as the
choice — it is the fastest way to pick from a list somebody already knows, costing no popup, no arrow
keys and no reading. Closed, a letter now selects the option it matches.

Unchanged for a searchable select, which answers a letter by filtering.
