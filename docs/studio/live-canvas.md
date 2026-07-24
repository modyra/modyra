# Live Canvas authoring

The Live Canvas is a command-backed authoring surface for fields, groups, and arrays. Every structural action uses the Studio command history, remains undoable, and has a keyboard-accessible control in addition to drag and drop.

## Arrays

Array cards expose their item schema in the Inspector, add and remove initial rows, remove a specific row, reorder rows, reorder sibling arrays, and move arrays between groups and the form root. Initial rows are project data; Preview runtime rows remain separate and are never mutated by canvas authoring controls.

Unsupported recursive array items remain excluded by the existing model rules. Disabled movement buttons communicate list boundaries, and focus follows the affected row or array after every render.
