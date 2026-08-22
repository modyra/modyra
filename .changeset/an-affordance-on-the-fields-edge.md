---
"@modyra/styles": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

The affordance column reaches the field's edge again.

`DESIGN.md` states the rule and names this exact failure in advance: *a control sized by its own text
leaves the field's fill as empty space beside it, and the affordance lands next to the value instead
of on the edge — the alignment reads as broken even though every affordance token is correct.* Every
token was correct. Three separate boxes were sized by their content:

- **The multiselect's own box** declared itself a row — "the trigger takes what is left and the
  clear-all sits at the trailing edge" — while being a flex item with no grow, so it took only the
  width its chips asked for. The clear-all then sat wherever the longest chosen word ended and moved
  whenever a value was added, removed or translated. Measured at **1073px** from a 1272px field's
  edge; now 4, the declared inset.
- **`@modyra/lit`'s multiselect** drew its prefix and suffix slots whether or not anything was given
  to them, and an empty slot is not an empty box — the suffix took 16px at the trailing edge, so
  every affordance inside that field stopped 16px short. Drawn only when something is assigned.
- **`@modyra/angular`'s number field** wraps its input in a span to position the steppers against it,
  and a span is inline: the box stopped after the number, putting the steppers beside the value.

Two of the most destructive controls in a multiselect — the clear-all and a chip's ✕ — were 22px
apart in the middle of the field as a consequence. At the trailing edge that adjacency does not exist.
