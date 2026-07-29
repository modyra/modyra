---
"@modyra/studio-ui": minor
"@modyra/studio-contract": minor
---

Studio previews the real controls

The Preview panel hand-wrote its own `<input>`, `<select>` and `<textarea>` for every field it drew.
A datepicker previewed as a text box, a slider as a text box, a toggle as a checkbox, a multiselect
as a native multi-select — and a preview whose controls are not the controls is not a preview, it is
a mock-up that happens to be bound to real state. Everything it told you about validation was true;
everything it showed you about the form was Studio's own drawing.

Preview now mounts the same controls the canvas does — `renderField` from `@modyra/plain`, given the
descriptor `compileToContract` emits and the live handle of the form the panel already reports on.
The value, the errors and the pending state are the live ones; the appearance is the foundation's.

What made this possible is that the fields no longer live in a repainting region. The panel is three
siblings — a head Region, a persistent mount, a tail Region — because `Region.update` rewrites
`innerHTML`, and mounted controls inside it would be destroyed on every keystroke, taking the caret
and any open popup with them. The mount is rebuilt only when the structure it draws changed: the
schema, the arrangement, a repeater's row count, a mock mode, or the identity of the form itself.
Typing changes none of them.

`@modyra/studio-contract` gains `dynamicFieldForNode(node, name)`, the descriptor for one project
field at one live path. The whole-project compiler flattens repeaters from their *initial* rows, so
it cannot describe a row pushed in Preview; this answers for that path from the same mapping, so a
previewed control is the control the contract asks for rather than a second opinion about it.

Studio's own chrome stays Studio's: the repeater's Add row/Remove, the per-field server-mock
selector, the validity badges and Submit. `@modyra/plain` renders a repeater's rows as flat fields
and has no repeater control of its own, so those buttons remain Studio's to draw.

One visible consequence: the foundation keeps a field's error list in the DOM and empties it rather
than removing it, so `.mdy-control__errors` is now always present in the preview — Studio's markup
used to add and remove the element, which reflowed the form under the pointer on every keystroke.
