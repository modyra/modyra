---
"@modyra/widgets": patch
---

Two option values never make one id, and an opener promises what opens

**Every whitespace character was written as `%20`.** `idSafeKey` percent-encodes an item key because
an option valued `New York` would otherwise split every ARIA reference built from it — but one
sequence served all five characters, so three distinct values collapsed onto one id:

```
"a b"   ->  w__option__a%20b
"a\tb"  ->  w__option__a%20b
"a\nb"  ->  w__option__a%20b
```

The browser accepts duplicate ids without complaint, so `getElementById`, `label[for]` and every ARIA
IDREF resolve to whichever element the document reaches first, and `aria-activedescendant` points a
keyboard user at the wrong option. A tab or a newline inside an option's value is what a paste from a
spreadsheet produces — the ordinary case, not a hostile one. The function's own comment claimed the
encoding "stays reversible", and `%20` does not come back as a tab.

Each character now carries its own code — `%09`, `%0A`, `%0C`, `%0D`, `%20`. Measured over twenty-two
keys chosen where the encoding works hardest: twenty distinct ids before, **twenty-two** after, all
reversible, and every id still splits into exactly its three segments. Ids for keys containing a tab,
newline, carriage return or form feed change; a key containing only spaces is unaffected.

**`aria-haspopup` is declared once, in the catalogue.** It was a literal at each opener — five in this
package, nine more across the renderers — with no common source, and the copies had drifted. A battle
that opens each popup and looks for the promised role found `multiselect` promising `listbox` over a
`group`, and `colors` promising `dialog` over a `listbox` — in both renderers, which is what says the
contract was silent rather than a renderer careless.

`MdyPopupOpener` gains `promises`, and `projectOverlayOpenerA11y` emits the attribute from it. Values
are read off the anatomy the same catalogue declares: `select` and `colors` promise `listbox`,
`datepicker` and `daterange` promise `grid`, `timepicker` and `multiselect` promise `dialog`.

**A consumer asserting `aria-haspopup="listbox"` on a multiselect will see `dialog`.** Its popup is a
search field beside a grid of chips the contract declares a `group`, so `listbox` promised options with
a selected state and a listbox's keyboard over a composite that has neither. The old value was measured
false; nothing correct changes, but it is a rendered attribute a host's tests may name.

See ADR 0110.
