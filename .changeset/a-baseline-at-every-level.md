---
"@modyra/core": patch
---

A baseline moves at every level a caller can name

`setInitialValue` took an ancestor path in the previous release and landed at some levels and not
others: a row worked, a leaf worked, the **collection itself** did nothing and said nothing, and a
**group** threw — with the wrong reason, `"which this form does not declare"`, sending a reader to look
for a typo in a name they had spelled correctly.

The collection is the level that matters: it is the one name a consumer can write without knowing what
the user created. A phantom field sits at a collection's own path to carry collection-level errors, so
the question "is there a field here" answered *leaf* for exactly that level. Descendants are now
looked for first, whether or not a field exists at the path itself.

A group is declared, and the form now says so: what a caller may *do* with one differs per method, but
whether it exists is not in question.
