---
"@modyra/widgets": major
"@modyra/lit": major
"@modyra/angular": major
"@modyra/plain": patch
"@modyra/styles": patch
---

A segmented choice is a radio, and the contract names it.

`segmented` declared `elements: { option: "presentation" }`, so nothing constrained what a choice
is: a `<div>` with a click handler conformed, and a screen reader user got a page of unlabelled text
where a chooser should be. That was finding **J1**.

The anatomy now names both halves, exactly as `radio` always has — `option` is the labelled
container, `optionControl` is the radio inside it, and both are required:

```ts
elements: { option: "label", optionControl: "radio" }
```

`radio` is a new semantic element, satisfied by `<input type="radio">` or by an explicit
`role="radio"`. An `<input>` of any other type does not satisfy it.

**`@modyra/lit` and `@modyra/angular` change markup.** A segmented option was a
`<button role="radio">`; it is now a `<label>` around its own `<input type="radio">`, the pattern
`@modyra/plain` already used. Arrow keys, the roving tab stop and form participation come from the
platform instead of being reimplemented, and a theme reaches the selected and disabled states from
the control rather than from a class the renderer has to remember to apply.

**Migration:** an adapter emitting a button-with-a-role now reports `PART_ELEMENT: option` and
`PART_MISSING: optionControl`. Styling that assumed a `<button>` needs the same follow-through the
shipped themes got — `:disabled` on the segment never matches, because the segment is a label and
the state belongs to the control inside it.

[ADR 0012](https://github.com/modyra/modyra/blob/main/docs/architecture/0012-a-choice-is-a-radio-by-role-or-by-tag.md)
decided the rule and predicted no renderer would change. It is amended in place: that prediction read
a summary of the code rather than the code, and Plain's `option` was never the radio.
