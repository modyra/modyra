---
"@modyra/widgets": minor
"@modyra/angular": minor
"@modyra/lit": patch
---

A part's ARIA role is contract data, and enforcing it found two shipped violations.

`element` said what a part may *be* — the semantic lists the roles it admits — and nothing said which
one it has to *have*, so the contract could permit a listbox and never require one. Roles now sit on
the part contract, declared per kind and derived for an overlay opener from the relation that already
names it, so the two cannot disagree. The check accepts an implicit role: `<input type="checkbox">`
is a checkbox, and asking a renderer to write `role="checkbox"` on it would be asking it to spell
what the host language already says.

Enforcing it surfaced a divergence between one renderer and the rest, and following that thread found
the reason: **`role="alert"` on the error list was wrong on every kind.** The list is a `<ul>`, and
the role replaces its list semantics — axe reports every `<li>` inside as an orphaned list item, and a
screen reader sees the same. The projections already set `aria-live`, so the role added nothing and
cost the structure; it is removed from the shared projection and from both renderers that spelled it.
One renderer had reached this conclusion on its own and recorded it in a comment; the other sixteen
kinds kept the defect because no test had ever rendered an error list.

The second violation: **`aria-invalid` and `aria-required` on a `role="group"`**, which supports
neither — they describe a value, and a group holds none. Removed from the multiselect's option group.

The accessibility suite now runs a pass with the error lists on screen, which is what makes both
findings visible. It had only ever audited fields that could not fail, so the element the whole
error-reporting path ends at was outside it by construction.

**Behavioural note for `@modyra/angular`**: the multiselect no longer exposes `aria-required`. Its
option group could not legally carry it and neither can its search button, and the widget uses a
chip-group pattern rather than a combobox, which is where that attribute would otherwise live.
Giving it a carrier means deciding the multiselect's ARIA pattern, which this change does not do.
