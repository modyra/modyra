---
"@modyra/widgets": minor
"@modyra/plain": major
"@modyra/lit": patch
"@modyra/angular": minor
---

One select, one interaction model per renderer.

[ADR 0018](https://github.com/modyra/modyra/blob/main/docs/architecture/0018-a-select-declares-whether-it-filters.md)
names two models and `searchable` selects between them. This is the half the renderers owe.

**`@modyra/plain` — breaking.** It appended a filter box to every select, so a three-option list got a
search nobody asked for and focus landed in it rather than on the list. Now only a `searchable`
select has one. A non-searchable select keeps focus on its trigger and jumps as you type.

**`@modyra/lit`.** Typing on a searchable select's trigger dispatched one character at a time into a
controller that *replaces* the query, so `mar` searched `m`, then `a`, then `r` and a typeahead could
never match a word. It now accumulates. Its non-searchable select is a native `<select>` and always
had the platform's typeahead — which is why the defect hid in the model most selects do not use.

**`@modyra/angular`.** Its non-searchable select had no typeahead at all: a printable key reached a
keyboard policy with no rule for one and did nothing. It now jumps.

**`@modyra/widgets` gains an `activate` intent** — make one option the active one without choosing
it. `move` could not express it, taking a direction where a typeahead knows the destination.

**A WebKit defect fixed on the way.** Not every engine focuses a `<button>` when it is clicked, so a
list opened by pointer left focus on the document and every keystroke after went nowhere. The
listbox model says focus *stays* on the trigger; the renderer now makes that true rather than
assuming it.

Asserted with real keystrokes per renderer and per engine, not only against the shared buffer — three
adapters implementing one behaviour is what produced three behaviours, and testing only the rule
would reproduce it exactly.
