---
"@modyra/plain": patch
---

Show the committed value in the control that opened the overlay. Committing restores focus to the
trigger, so the focus-guarded sync skipped exactly the update that mattered: a date picked from the
calendar never reached the input, and a selected option left the stale search text in the select
trigger. The sync is now guarded by whether the user is typing.
