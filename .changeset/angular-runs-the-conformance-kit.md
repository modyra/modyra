---
"@modyra/angular": patch
---

`@modyra/angular` ships a conformance config, so all three renderers answer to one driver.

The adapter was already checked against the widget contract by its own suites — same
`inspectWidgetDom`, same `MDY_WIDGET_CONTRACTS`. What it was not checked by is the kit, and the
difference is what each covers: the jest suite calls `inspectWidgetDom` with no variant, so
multiselect's counter mode was mounted nowhere in this package. The kit's anatomy pass mounts every
declared variant, which makes coverage a property of the contract rather than of whichever suite was
written.

Run it with `npm run test:conformance`, which now runs all three.

```
CONFORMANT WHERE CHECKED  ·  17 kind(s)  ·  6 of 8 section(s) run
```

Two things the config measures rather than assumes, because the first attempt got both wrong: this
renderer builds its overlays eagerly, so nothing is declared absent at rest; and the empty value of
each kind comes from `MDY_CANONICAL_EMPTY` rather than from a table here, which had invented `""`
where the contract says `null`.
