---
"@modyra/widgets": patch
"@modyra/vue": minor
---

A dismissal puts the keyboard back where the person opened it

A controller does not touch the page: it answers with what should happen — close the overlay, put
focus back on the opener — and the renderer performs it. Vue's six overlay kinds dispatched their
intents and dropped the answer, so half of every interaction was missing, and the missing half was
the one no screenshot shows: Escape closed the panel and left the keyboard on nothing, sending the
person to the top of the document on their next Tab.

They now run what the controller returns, through `useCommands`, whose element lookup is derived from
the projection rather than written per kind: a part is found by the id the contract publishes for it,
and by its declared classes where it has no id — which is most parts, because the contract publishes
an id only where something must point at one.

Two contract defects surfaced doing it, and both are the same shape — a part named by hand where the
catalogue already names it:

- the shared catalogue controller aimed `restore-focus` at `part: "trigger"` for every kind. A range
  opens from its toggle and a colour from its picker, so for those the command resolved to nothing;
- the colours controller aimed at `part: "toggle"`, which is a presentational span and cannot take
  focus at all. Both now ask `MDY_POPUP_OPENERS` for the part the kind declares.

Vue's select also keyed its options with `String(value)` — `"[object Object]"` for every object —
where the projection keys them structurally, the same divergence repaired in Lit.
