---
"@modyra/studio-contract": patch
"@modyra/studio-ui": patch
---

A row count that is not a finite number does not reach the contract as `null`

The same gate as the code generator's bounds, in a different package reading the same field.
`compileToContract` spread a collection's row count when `typeof minItems === "number"`, and the
contract is written as JSON:

```
min: 3         →  "minItems": 3
min: "3"       →  absent            (the wrong type was already dropped)
min: NaN       →  "minItems": null  nothing reported
min: Infinity  →  "minItems": null  nothing reported
```

`parseDynamicForm` accepts the resulting contract with no diagnostic either, so the author's rule is
absent from the output and nothing between the project and the engine says so.

A project has two outputs and one validator feeds both, in two packages that each decided for
themselves what a number is. Both are `Number.isFinite` now.

`@modyra/studio-ui` had the third instance on authored data: a layout's track count for a breakpoint,
where `NaN` reached the grid as `repeat(NaN, …)` and painted a layout nobody wrote.

Found by `battle-tests/adversarial/studio/`, filed as one defect across two surfaces rather than two
coincidences.
