---
"@modyra/widgets": patch
---

A calendar's views say which one is showing, and no word in the vocabulary is idle

The day grid, the month picker and the year picker were all declared `overlayIsOpen` — true of all
six parts at once, and contradicted by the page: with the day view up, the month and year pickers are
hidden and their cells are never built. They are present under `viewIsActive`, which is the sharper
condition and implies the weaker one, since a view cannot be the one showing inside a panel that is
not there.

Found from the other end. `viewIsActive` was published and **no part used it**, which is a word
nobody had to get right. A check now says so: a condition the vocabulary offers and nothing is
present under is either a missing declaration or a word the contract does not need, and both are
worth failing over.
