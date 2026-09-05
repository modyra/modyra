---
"@modyra/angular": patch
---

A panel keeps the floor its kind declares

A kind may say its panel has a minimum width — a multiselect's declares 160px — and the placement
policy answers `max(anchor width, floor)`. This renderer positions through the CDK, so it reads the
numbers back out of what the policy returned, and for the width it read the **anchor's own rect**
instead: beside a 100px field the panel was 100px, and the floor did nothing.

The floor is only visible on a narrow field. On a wide one a renderer that honours it and one that
never read it are indistinguishable — which is why this went unnoticed until a floor was put under
the opener and the narrow arrangement started being measured.

`DESIGN.md` now carries the rule the repair follows: a floor is a promise against collapse, not
against the viewport — `min(floor, available)`, where a control laid out in a form is bounded by its
container and a floating panel by the viewport less its margins.
