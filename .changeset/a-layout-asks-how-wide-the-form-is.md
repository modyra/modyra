---
"@modyra/styles": minor
"@modyra/angular": minor
"@modyra/studio-ui": patch
---

A layout asks how wide the form is, not how wide the window is

The foundation's breakpoints were `@media` queries, which made a row's arrangement a property of the
**window**. The same form in a sidebar and in a full-width page laid out identically; a preview panel
could not show what a narrow form does without lying about its width; and Studio's canvas had to
re-resolve the track count in JavaScript and override the foundation to show the size being authored.

`MDY_LAYOUT_BREAKPOINTS` has always described the *form* — "what a row looks like on a phone, a
tablet, a desktop". A container query is what actually asks that. `.mdy-dynamic-form` is now a named
container and the three blocks are `@container mdy-form (min-width: …)`. The widths, the
`--mdy-layout-column-count-*` cascade and the per-slot placement are all unchanged.

`<mdy-dynamic-form>` takes the `mdy-dynamic-form` class on its host, so all three renderers name the
form root the same way — `@modyra/plain` always has — plus `display: block`, because a custom element
is inline by default and an inline box cannot be a container.

**This changes behaviour for hosts, deliberately.** A dynamic form rendered in a narrow column now
stacks its rows even on a wide screen. That is the arrangement the form's own width earns, and it is
what the breakpoints meant all along.

Studio drops the workaround this replaces: the resolved-count loop and the rule that outranked the
foundation are gone, and the canvas gets its arrangement from the same queries the shipped form does.
The canvas frame is sized by its **content box** so that previewing `md` makes the *form* md wide —
measured border-box, the frame's own padding came off the form and `md` answered as `sm`. The canvas
scrolls when the panel is narrower than the size being previewed, which is the honest cost of
previewing a size the panel cannot fit.

Baseline is not a concern: the foundation already relies on `@starting-style` and
`transition-behavior: allow-discrete`, both newer than container queries.
