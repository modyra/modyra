---
"@modyra/widgets": patch
---

A listbox is named by the field's caption, not by the control that opens it

The option list pointed `aria-labelledby` at its own trigger, and the trigger is a `combobox`. When
the accessible-name computation crosses into an **embedded control** it takes that control's *value*,
not its text — so with nothing chosen the listbox inherited the empty string and a screen reader
announced "listbox" and nothing else. The placeholder visible inside the button is neither a label
nor a value, so it never travelled either.

Every attribute was correct, the referenced element was present, visible, not hidden and not inert.
The defect lived entirely inside the algorithm, which is why nothing that reads markup could see it —
it took a reader that computes the name the way a platform does.

It is the same rule as the trigger's own self-reference, read from the other side: there the value is
what is wanted, here it is what ruins the name.

The custodian asserts the **rule** — no part is named by pointing at a control that answers with its
value — deriving which parts those are from the projection's own roles rather than a list kept beside
it. It is deliberately the weaker half and says so: the platform's reading is the other half and lives
in the browser tier, which is where this was found and where the repair was confirmed.
