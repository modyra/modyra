---
"@modyra/widgets": major
"@modyra/plain": patch
---

A dialog overlay is not a combobox, and the pickers answer the keys they always declared.

**Contract change.** `MDY_WIDGET_KEYBOARD` gave every overlay kind the combobox opening keys:

```ts
{ key: "ArrowDown", when: "closed", intent: "open" }
{ key: "ArrowUp",   when: "closed", intent: "open" }
```

Four of those kinds hold no options. A calendar, a date range, a clock face and a colour palette are
dialogs a button opens; the rule's own justification is about arriving on the first or last *option*,
and there is none to arrive in. A kind now gets those two keys if the catalogue says it declares a
`listbox` part — `select` and `multiselect` do, the pickers do not.

Eight bindings are withdrawn, which `contract:diff` classifies as major. **No renderer implemented
them**, so nothing changes for a user and no adapter needs updating; a consumer building a picker
from the table stops being asked for two keys the three reference renderers had all declined to
write. [ADR 0021](https://github.com/modyra/modyra/blob/main/docs/architecture/0021-a-dialog-overlay-is-not-a-combobox.md)
records it.

**Fixes**, found by pressing the declared keys in a real browser for the first time:

- `multiselect` opened on `ArrowDown` but not `ArrowUp`, from a deliberate `null` in the shared
  keyboard policy while the table declared both. It opens on either now — in the policy, so for every
  renderer at once.
- `@modyra/plain`'s `datepicker` did not close on `Escape` while its two siblings did. Its calendar
  grid handled the key, but the overlay does not take focus when it opens, so a user who opened it
  from the toggle was holding a dialog that answered nothing.
- All four of `@modyra/plain`'s pickers now dismiss on `Tab`, which the contract has always declared
  and none of them did. A panel left floating over a field the user has tabbed away from is the same
  defect a moment later.
