# ADR 0198: An action in a panel is one a key can reach

Status: Accepted — amended 2026-09-03, see Consequences

## Context

The contract already decided what `Tab` does inside an open panel, and said why: a panel with actions
of its own keeps the key and walks its own ring, because a `Tab` that dismissed would leave those
actions unreachable from a keyboard — WCAG 2.1.1, not a preference. A panel you only choose from lets
the key keep its native meaning, closes, and lets the browser carry the person onward.

The rule was right. **The predicate was narrower than the sentence written beside it**:

```ts
const keepsFocus = "actions" in MDY_WIDGET_CONTRACTS[kind].parts;
```

That is the timepicker's own anatomy standing in for the rule. It asks whether a kind has an actions
*bar*, while the sentence beside it asks whether the popup holds controls of its own. One kind
satisfies the second and not the first: the colours panel holds a button for entering a custom tint,
declares no `actions` part, and was therefore classed with the panels you only choose from.

Measured, before anything was changed:

```
plain    Tab from the open panel → closes        arrows: 12 presses, never leave the swatch grid
lit      Tab intercepted, closes anyway          (the half-done work of someone who sensed the rule)
angular  Tab from the open panel → closes        arrows: 9 presses, never leave the grid
```

So the custom entry was operable with a pointer and with nothing else, in every renderer, for as long
as the field has existed.

## Decision

**The predicate says what it means, derived from what the catalogue already declares.** A kind keeps
`Tab` when its popup holds a part that is drawn as a button, is not one of the choices, and is **not
repeated**.

The last clause is the anatomy doing the deciding, and it is what separates the two shapes:

- **one action per panel → a tab stop.** `Tab` knows where it arrives, so the ring can name it.
- **one action per row → a declared key on the active row.** A stop that named the row would be one
  stop per row, and `Tab` would become a scroll. Those are reached by a key instead.

Colours joins the timepicker's family **by derivation**, not by exception. Its ring is: the swatch
grid as a single stop — the arrows are what move within it — then the custom entry, wrapping. `Escape`
is still the way out.

## Consequences

- Enumerated over all seventeen kinds, the widened predicate moves **exactly one**: colours. The rule
  is unchanged for everything else, and a kind that grows a control in its panel inherits the ring
  without anyone remembering to grant it.
- The multiselect's `optionStep` is the second shape: one action per row, so it does not change
  family — it gains a key declared `when: "open"` instead, and `Tab` goes on closing that panel.
- **Amendment, 2026-09-03: that key is `ArrowRight` and `ArrowLeft`, and the choice was measured.**
  What this kind already declares while its panel is open: `Escape`, `Tab`, `Enter`, `Space` on an
  option, `ArrowUp`/`ArrowDown`/`Home`/`End` for moving, and any printable character for type-ahead.
  The vertical axis walks the list, so the horizontal one is free for the control on the row the walk
  is standing on. `+` and `−` were the alternative and are not available: they are printable, and the
  type-ahead binding would take them before this one was asked. The declaration lands first and the
  renderers follow it — until they do, the stepper is still pointer-only, which is recorded here
  rather than left to be rediscovered.
- A spec that asserted "Tab closes what it tabs out of" for every kind failed three renderers for a
  correct change. It was deriving already — from anatomy (`parts.actions`) rather than from the
  declaration — and agreed with the contract for one kind by coincidence. It now reads the binding it
  is about, so a kind that changes family moves between its two claims by itself.

## Alternatives rejected

- **Declare an `actions` part for colours.** Anatomy that lies: every check reading `parts` would
  expect a bar that is not drawn.
- **A new field on the part, or a per-kind list of action parts.** Both add surface to say something
  three declarations already say between them — and a parallel list is the shape this whole cycle has
  been removing.
- **Put the custom entry in the swatch grid's roving index.** It would make a cell that acts rather
  than chooses: a screen reader announces it as an option and `Enter` does something its siblings do
  not. The anatomy should not bend to make the rule look simple.
- **A `panelTabOrder` function beside the existing rule.** Written, then deleted before it was wired:
  it would have been a third answer to a question the contract already answers twice.

## Verification

`packages/plain/test/an-action-a-key-can-reach.test.mjs` presses the key and asserts where focus is —
not whether the element could take focus. That distinction is the whole defect: a `<button>` is
focusable in sequence on every day of its life, and the panel was gone before `Tab` arrived, so a
check reading the element would have passed throughout.

Restoring the narrow predicate turns all three of its checks red, with the message naming what is
lost. The precondition runs first: the panel opened, and something in it holds focus.

The same ring is asserted in Lit and Angular, and a browser-tier confirmation is owed before this is
called closed — the local measurements are in a DOM without native `Tab`, which sees interception but
not the document's own sequence.

## Security and privacy

None. Where a key can travel inside a panel the person opened changes no value, no stored data and no
trust boundary. It changes who can operate a control that was already on the page: everyone, rather
than only those using a pointer.
