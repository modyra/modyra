# Drag-and-drop editing

The canvas supports pointer drag-and-drop, and every drag has a full
keyboard-only equivalent — accessibility is not a smaller, separate mode.

## Pointer

- Drag an element from the **Elements** palette onto the canvas to insert
  it, or click it to insert at the root.
- Drag an existing node to reorder it, or into a group/array item to
  nest it. Drop zones ("Before" / "After" / "Drop inside") highlight as
  you drag near them.
- **⧉** duplicates a node (with a fresh ID); **×** deletes it. Deleting a
  node with descendants or incoming references asks for confirmation
  first.

## Keyboard only

1. Focus a node in the tree and press <kbd>Space</kbd> to **pick it up**.
   The status line announces what's picked up.
2. <kbd>↑</kbd> / <kbd>↓</kbd> reorder the picked-up node among its
   current siblings.
3. <kbd>→</kbd> moves it *inside* the previous sibling, if that sibling is
   a group.
4. <kbd>←</kbd> moves it back *out*, after its current parent.
5. <kbd>Enter</kbd> or <kbd>Space</kbd> drops it in place.
   <kbd>Escape</kbd> cancels the move and returns focus to where you
   picked it up.

Every move — pointer or keyboard — is a Command with a real inverse:
**Undo**/**Redo** (top-right, or the corresponding buttons) walk back and
forward through the exact same history regardless of how an edit was
made.

## Focus management

Every action restores focus deliberately, win or lose: a rejected command
(for example, an incompatible move) never strands keyboard focus, and
deleting the last node in the tree moves focus to the root rather than
off the page entirely. This is enforced structurally — `commit()` always
sets a focus target before re-rendering, not left to chance.

## At a glance

Tree rows carry small indicators without needing to open the inspector: a
red `*` for a required field, a count badge for other validators, a `⇄`
for server validation, and a coral `!` wherever a diagnostic points (see
[Validators](validators.md) and the Diagnostics tab).
