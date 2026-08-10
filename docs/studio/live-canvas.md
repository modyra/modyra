# The live canvas

The canvas is where a form takes shape: you add fields, nest them into groups, and build arrays of
repeating rows. Three things are true of every action on it.

- **It goes through the command history.** Nothing edits the project directly, so everything undoes.
- **It has a keyboard equivalent.** Every drag can be done without a pointer — see
  [drag-and-drop editing](drag-and-drop.md).
- **It never touches generated code.** The canvas edits one project model; targets compile from it
  on export.

## Arrays

An array card is a repeating row, and the inspector shows its item schema — the fields one row is
made of.

From the card you can:

- add and remove initial rows;
- remove one specific row;
- reorder rows within the array;
- reorder sibling arrays;
- move an array between a group and the form root.

**Initial rows are project data, not preview state.** They are what a form starts with when someone
opens it. The rows you create by typing in the Preview tab are a separate, running form, and nothing
you do on the canvas rewrites them.

Movement buttons disable at the ends of a list rather than disappearing, so the boundary is visible
rather than inferred, and focus follows the row or array you just moved.

## One shape an array cannot take

A row is a field or a group — an array cannot itself be the row of another array. The project model
says so in its own type (`ArrayNode.item` is `FieldNode | GroupNode`), so the case never reaches
export.

A group *inside* a row may hold its own array, which is how a genuinely nested repeater is
expressed.

## Next

- [Drag-and-drop editing](drag-and-drop.md) — pointer and keyboard, side by side
- [Validators](validators.md) — attaching rules to what you just built
- [Project format](project-format.md) — what the canvas is actually editing
