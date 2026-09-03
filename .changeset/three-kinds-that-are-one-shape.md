---
"@modyra/vue": minor
---

Three more kinds, without a branch naming any of them

`email`, `password` and `textarea` join the kinds `@modyra/vue` draws. No component was added: the
catalogue declares them with the same parts in the same places as `text`, and what separates them is
a native type and, for one, a tag. Both are declared, so the component reads them.

`controlType` gives the type — `text`, `email`, `password`, and for the textarea nothing at all,
which is why it renders with no `type` attribute rather than with one somebody chose. The control
part's element gives the tag: the `input` semantic admits three tags and most kinds do not care
which, while the one that does says so by narrowing its own semantic. Reading that is what lets one
component draw a textarea without a branch naming the kind — and a fifth kind of this shape would be
accepted rather than requiring an edit.

Falsified by making the component ignore the declared element and always draw an `<input>`. Under a
clean build the kit answers with four findings in four sections: the element is wrong, the label now
points at the wrapper instead of the control, the control is missing from the renderer comparison,
and the element carrying the field's name is not the part the submission table declares. A skeleton
satisfying only its own test would have reported none of them.
