---
"@modyra/widgets": major
"@modyra/vue": minor
---

Repetition in the widget anatomy is inherited from the parent instead of listed by name.

Five parts were declared singular while sitting inside a parent that repeats, describing pages
nobody can build — one radio button shared by every choice, one remove button for every chip. Their
cardinality widens from `0..1` to `0..n`:

- `radio.optionControl`
- `segmented.optionControl`
- `segmented.optionText`
- `multiselect.chipMove`
- `multiselect.chipRemove`

Nothing narrows and no capability is removed: every rendering that conformed before conforms now,
and a renderer drawing one control per option was previously reported non-conforming for being
right. A consumer that read `repeated` to decide whether a single element lookup was enough for one
of the five was already wrong on any page with two items, and now reads a declaration that matches
what every renderer draws. ADR 0202.

The conformance kit gains the count rule this makes possible: a required part that repeats because
its parent does must appear once per parent. Previously "repeated" meant "any number", so a group
drawing two choices and one control conformed.

`@modyra/vue` draws the radio group and the segmented control, sharing one component because the two
kinds declare the same anatomy.
