---
"@modyra/angular": minor
---

A closed picker is gone, a form that ended takes no writes, and a document can keep a draft.

- **The datepicker's popup is built when it opens and removed when it closes.** Drawn always, a
  closed field left forty-two gridcells on the page for a screen reader to walk, and a field taken
  out of play kept its calendar open — a control that looks live and answers nothing. Its opener also
  now owns the `open` state the widget controller holds, which is where the contract writes the rule
  that a field leaving play closes its popup, and emits `aria-controls` only while there is something
  to name.
- **A control whose form has ended no longer writes into it.** The engine reports a destroyed form's
  fields as out of play; nothing in this adapter consulted that on the write path, so a control left
  on the page kept editing a form that no longer existed.
- **`<mdy-dynamic-form>` takes `draftKey`.** A document rendered by this component could not be asked
  to keep a draft at all, while the other renderers take the option at their own door.
