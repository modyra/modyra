---
"@modyra/widgets": major
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

A key declared bare stops answering a press with the accelerator held — and Escape starts answering whatever is held

**Breaking: `MdyKeyBinding.modifier` is now `"primary" | "any"`, and four signatures accept a press
where they took a key name.**

Measured across all three renderers, on every kind that opens something: `Cmd`+Space, `Cmd`+ArrowDown
and `Cmd`+Enter each opened a panel. Those are the input-source switcher, the end of a document and
submit — a person holding the modifier is reaching for one of them, and the panel arrived under the
gesture meant to do something else.

`matchesKeyGesture` had always said otherwise, and had no road. Every question a renderer actually
asks took a **key name**, so what was held with the press never reached the one function that reads
it: a defect planted in that function moved no check in either tier, because nothing on the deciding
path called it. It was published as the answer to a question nobody asked it.

**The rule, once the closing case was asked about outside.** A gesture that *adds* is refused under a
held accelerator; a gesture that *removes* is honoured whatever is held. Answering a dismissal
wrongly costs a reopen; refusing one leaves somebody inside a panel with the way out not working,
under a modifier nobody thinks to test. `Escape` in particular is the key a control does not get to
reinterpret.

Declared, not coded: the dismissal bindings carry `modifier: "any"` and every deciding path reads the
binding. A condition naming `Escape` would be a second copy of the rule, and the copy is what keeps
answering after the declaration changes — proved by mutation, which found exactly that in the first
version of this fix.

`keyBindingFor`, `keyMeans` and the two overlay policies accept `MdyKeyOrPress`: a string keeps
meaning what it meant, so a caller asking what the catalogue declares about `Tab` is unaffected, and
a caller deciding a press now says so. The calendar's `keydown` intent carries the accelerator, which
it needed to answer at all.

**Two things this leaves.** `colors` behaves correctly and reaches that behaviour by comparing the key
by hand in one renderer, so it does not read the declaration. And the contract snapshot does not cover
the keyboard catalogue at all — this changed a published binding and `contract:diff` reported `patch`.

See ADR 0168, which also records where the type-surface classification and my own reading disagree.
