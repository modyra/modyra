---
"@modyra/react": major
---

`@modyra/react` draws the two families of choice: the checkbox and the switch, and the radio group
and the segmented control.

**Two kinds, two marks, no table.** A checkbox declares a single `indicator` under its caption; a
switch declares a `track` holding a `thumb`. The mark is read off the anatomy — the caption's
non-textual children — rather than named in the component, so a switch drawn by a component that
knows only the checkbox's part no longer puts an empty span where two required parts belong. The
same derivation names the part carrying an option's words, which one kind calls `optionLabel` and
the other `optionText` and both declare as the `text` child of `option`.

**The arrows stay the platform's.** Native radios sharing a `name` are a radiogroup the browser
roves by itself, so there is no key handler here: one that answered those keys would have to cancel
them to avoid acting twice, and would then owe the whole behaviour back, focus included.

**An option's key comes from the contract, not from `String`.** Every plain object renders as
`[object Object]`, so a list of object-valued choices would collapse to one key and selecting either
would mark both. For a primitive the two answers agree exactly, which is why a fixture built on
strings cannot see the difference.

The submission name is decided once the group is in the document: whether the answer travels under
the field's path or under this widget's own id depends on there being a form around it, and that
question has no answer before mount.

**The nine hooks now publish `view`.** Only the text hook did, so a component built on any of the
others held the state and none of the anatomy. This is a required member added to nine returned
interfaces: code that *calls* the hooks is unaffected, code that *implements* one of those interfaces
— a hand-written stand-in in a test — has to supply `view`, which is `controller.view()`.

**The published declarations name their type peer.** `@modyra/react`'s `.d.ts` files import from
`react`, whose types live in a separate package, so a clean consumer type-checking what we ship got
`TS7016: Could not find a declaration file for module 'react'` on every component we publish.
`@types/react` is now an optional peer dependency, which is what puts it in front of the consumer
that installs us.
