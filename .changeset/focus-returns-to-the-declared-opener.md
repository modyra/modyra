---
"@modyra/angular": minor
---

Focus comes back to the part the contract says opens the popup.

Closing an overlay returned focus to the first interactive element in the wrapper — a description of
one arrangement rather than a rule. A multiselect draws its chosen values ahead of the trigger and
every chip is tabbable, so `Tab` closed the list, put focus on a chip, and let the browser carry on
from there onto the trigger: the control the person was leaving.

`MDY_POPUP_OPENERS` already declares the part a person opens each kind with — `trigger` for select and
multiselect, `control` for the pickers, `toggle` for a range and for colours. The overlay control reads
it and restores focus there, falling back to the old search only for a kind that declares no opener.

This replaces the `restoreFocusTo` hook and the multiselect's own `restoreOverlayTriggerFocus`
override, both added earlier in this same unreleased cycle: one kind naming its own element was the
workaround for a base that was not asking the contract.
