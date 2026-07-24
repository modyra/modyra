# Accessibility

## Keyboard parity

Every pointer interaction in Studio has a full keyboard equivalent — this
is a hard requirement (R9), not an afterthought bolted on afterward. See
[Drag-and-drop editing](drag-and-drop.md#keyboard-only) for the exact
pick-up/move/drop sequence (<kbd>Space</kbd>, arrow keys,
<kbd>Enter</kbd>, <kbd>Escape</kbd>).

Focus is restored deliberately after every action, whether it succeeds or
is rejected: a command that fails validation never stands focus in an
unreachable spot, deleting the last node moves focus to the root instead
of off the page, and switching inspector tabs moves focus to the tab that
is now selected.

## Live region announcements

The footer status line (`role="status" aria-live="polite"`) announces
every action — a move, an undo, a validator added, an import completing
— so a screen-reader user gets the same feedback a sighted user gets from
watching the canvas change.

## Structure

- Tree nodes are real, focusable, keyboard-operable elements
  (`tabindex="0"`), not `div`s with only a click handler.
- The inspector's tabs use `role="tablist"`/`role="tab"` with
  `aria-selected` reflecting the actual open tab.
- Destructive actions (delete a node with descendants or incoming
  references) ask for confirmation rather than acting silently.
- Native `<details>`/`<summary>` is used for every collapsible section
  (Validation, Server validation, a generated file's Preview) — a
  zero-JavaScript, fully keyboard-and-screen-reader-native disclosure
  pattern, rather than a custom-built one.

## Verifying it

Accessibility behavior is covered by real end-to-end tests (Playwright)
driving actual keyboard events — `apps/studio/e2e/keyboard.spec.ts` — not
just a static audit. It checks focus lands somewhere real after every
action, that the live region announces what happened, and that labeled
controls are actually labeled.
