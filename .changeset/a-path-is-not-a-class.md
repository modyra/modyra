---
"@modyra/widgets": patch
---

The theme class-contract audit stops reading module paths as class names.

Its whole-file scan matched every `mdy-*` token in a source file, which includes the specifier in
`import { mdyPart } from "../mdy-part.js"`. Binding a part contract in a Lit component therefore
looked like emitting a `mdy-part` class — on thirteen kinds at once, as soon as enough components
consumed the directive. Module specifiers are now stripped before the scan, alongside comments.

The count of theme classes emitted by neither renderer is unchanged at 2477, so nothing was
suppressed along with it; an invented class in a real template is still reported.
