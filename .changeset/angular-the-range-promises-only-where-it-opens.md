---
"@modyra/angular": patch
---

A range's text inputs no longer promise a popup they cannot open.

Both carried `aria-haspopup`, which tells a person operating that control that a popup opens from it.
The catalogue names one opener per kind and for the daterange it is the toggle beside them: the
inputs answer neither of the two keys the contract declares for opening, nor a pointer. The promise
now sits only where the popup actually opens.
