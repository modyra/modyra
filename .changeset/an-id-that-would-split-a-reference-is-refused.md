---
"@modyra/widgets": minor
---

A widget id may not contain whitespace

`isValidWidgetId` refused an empty id and one containing the delimiter, and accepted `"my form"`.
`aria-labelledby` and `aria-describedby` are space-separated **lists**, so a widget id with a space
in it makes one reference into several:

```html
<input aria-labelledby="my form__label">   <!-- read as `my` and `form__label` -->
```

Each resolves to nothing anyone rendered, so the control has **no accessible name**.

`for` is not affected: it compares a single id as one string, so the label still finds its control —
measured, not assumed. That makes the failure harder to find rather than easier: the association
survives, the label sits visibly beside the field, and the control announces nothing. It is the
failure the delimiter rule already prevents, arriving through a character nobody thought of as
structural.

The guard now refuses any ASCII whitespace, which is the HTML rule written from the other side — and
the **part-id builders refuse it too**, throwing where the ids are built. A predicate only protects
the renderers that remember to call it, and this package is the surface third-party renderers are
built on. `assertUsableWidgetId` is exported so a renderer can make the same refusal at its own
boundary.

`defaultWidgetIdFactory` is deliberately unchanged and still joins what it is given: it is a
replaceable primitive documented as deterministic and reversible, and something constructing ids
speculatively is entitled to use it.

Nothing is repaired silently. An id is consumer-visible, so rewriting `"my form"` into `"my-form"`
would change what a host's own tests, stylesheets and selectors look for. `@modyra/plain` already
refused an invalid `idPrefix` at mount and now refuses this one too.

Recorded as [ADR 0053](https://github.com/modyra/modyra/blob/main/docs/architecture/0053-a-widget-id-is-refused-where-it-is-used.md).

Found by `battle-tests/adversarial/accessibility/whitespace-in-ids.battle.test.mjs`.
