---
"@modyra/core": minor
"@modyra/plain": minor
"@modyra/lit": minor
"@modyra/angular": minor
---

A control can be named without a visible label.

A cell in a table and a control in a toolbar get their meaning from a column header or an icon,
which a screen reader never reaches — and until now the only name a control could have was a visible
label. Building a table made the gap concrete: every cell announced itself as "edit" and nothing
about which line or column it belonged to.

`ariaLabel` supplies the name, and only while nothing visible carries one:

```html
<mdy-control-text [field]="rows.f.lines.row(key).item" [ariaLabel]="'Item, row ' + key" />
<mdy-text-field aria-label="Item, row 12" .field=${cell}></mdy-text-field>
```

```ts
renderField(container, { name: "item-12", kind: "text", ariaLabel: "Item, row 12" }, cell);
```

A visible label already names the control natively, so the two can never disagree — the failure
WCAG 2.5.3 is about. The Dynamic Form Contract carries the slot too, so a data-only document can
declare it, and both spec schemas describe it.

Found while doing this: the Angular renderers bound `aria-label` **twice** on the same control, the
second copying the visible label. One attribute now has one binding.
