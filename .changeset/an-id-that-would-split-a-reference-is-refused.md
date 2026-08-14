---
"@modyra/widgets": patch
---

A widget id may not contain whitespace

`isValidWidgetId` refused an empty id and one containing the delimiter, and accepted `"my form"`.
`aria-labelledby` and `aria-describedby` are space-separated **lists**, so a widget id with a space
in it makes one reference into several:

```html
<input aria-labelledby="my form__label">   <!-- read as `my` and `form__label` -->
```

Each resolves to nothing anyone rendered, so the control has no accessible name — and `for`, which is
a single id, matches nothing at all. The markup looks correct throughout, which is why nothing
downstream can tell it apart from a field whose label is simply missing. It is the failure the
delimiter rule already prevents, arriving through a character nobody thought of as structural.

The guard now refuses any ASCII whitespace, which is the HTML rule written from the other side. The
id factory is unchanged and still joins what it is given: an id is consumer-visible, so a factory
that repaired one silently would change what a host's own tests and stylesheets look for. `@modyra/plain`
already refuses an invalid `idPrefix` at mount, and now refuses this one too.

Found by `battle-tests/adversarial/accessibility/whitespace-in-ids.battle.test.mjs`.
