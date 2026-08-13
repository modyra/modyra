---
"@modyra/widgets": minor
---

Every kind has a controller, and no module has two jobs

**The three kinds that had none.** `daterange` shipped last; `colors` and `file` land here. Each was
wired by hand in every renderer from loose transitions, and what the transitions never carried is the
state around them — which is where each renderer made its own decision:

- **colours** keep the text being typed apart from the value being held. `#0` is three keystrokes
  from a colour and must survive being typed; committing would store black and rejecting would take
  the half-written value away from the person writing it. A preset closes the overlay because
  choosing one is an answer; typing does not.
- **files** keep what a selection *refused*. A field that drops candidates silently leaves someone
  looking at a list missing the file they just chose, with nothing to explain it. `dragover` is a
  state the contract declares, so it belongs to the widget rather than to whichever renderer
  remembered to track it — and a field that cannot take a drop never lights up.

**`behavior.ts` and `catalog.ts` are no longer one file each.** 800 lines and ≥10 unrelated domains
became ten modules; 800 lines of vocabulary, builder, four side tables, semantic map and seventeen
definitions became four. Both barrels re-export, so the surface did not move — and the catalogue's
barrel is a named list rather than a wildcard, because splitting a file must not publish what it used
to keep to itself.

**The select is bound to a form like every other kind.** `createSelectFieldController` reads a field
handle; the standalone controller stays for a host with no form, which is the case it was written
for. The verdict rule arrives with the binding: `invalid` was a boolean a caller passed, so a select
was as right about a disabled field as whoever wired it happened to be.

Also: `projectSelectA11y` is exported — every other kind published the function that turns its state
into ARIA, and this one published only the shape, so a renderer wanting its own select had to rewrite
it. Its eight hand-spelled class modifiers now derive from the declared state vocabulary. The
reconciliation module moved to neutral ground, closing the two-way import between `field/` and
`select/`. The select's conformance fixtures left the runtime entry for `./testing`, where they stop
shipping in a consumer's bundle.
