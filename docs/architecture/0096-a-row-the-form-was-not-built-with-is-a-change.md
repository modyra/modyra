# ADR 0096: A row the form was not built with is a change

Status: Accepted

## Context

`getChanges()` is documented as the fields whose value differs from the schema's initial values,
ready for an API `PATCH`. `reset()` is documented as returning the form to those same initial values.
They are two readings of one baseline, and they disagreed about a row.

A row's cells are declared by the collection when the row arrives, and the value the row arrives with
becomes each cell's initial value. So a row a user added held nothing that differed from its own
baseline: `getChanges()` reported nothing while `reset()` threw the row away. A form where the user
added three lines and typed in none of them produced an empty patch; one where they added three and
corrected a cell produced a patch holding that cell alone, with nothing saying the row was new. What
a consumer sends to a server never carried the rows a user made.

The two readings cannot both be right. `reset()` is the one that matches the documented sentence —
the schema's initial values are what the form starts from, and they contain no such row.

## Decision

A baseline is two statements, not one: what a field started as, and whether the field was there at
all. The engine records the paths the form holds when its baseline is taken — at construction, and
again whenever the current value becomes the baseline — and `getChanges()` reports a field the
baseline never had as a change whatever it holds.

A rename carries baseline membership with the rest of what a renamed row keeps: a key is not a value,
so a row the form was built with stays unchanged under its new key, and a row it was not built with
stays new under either.

`setInitialValue` on a path declares that path — and the subtree under it — as part of the baseline's
shape, which is how a consumer says a row a user made is now the form's own starting point.

An engine driven directly, with no baseline ever taken, keeps the old reading: reporting every field
as new to a caller who never said when the form stopped being built would be worse than reporting
none.

## Consequences

A patch built from a form where rows were added is bigger, and it now carries rows whose cells are
all still the template's initial values — which is the point: a row exists or it does not, and no
value in it can say so.

A form restored from a draft reports the draft's rows as changes. That is what it already did for
every plain field a draft restored, and `clearDraft()` still rebaselines, so a consumer who treats
the restored state as the starting point has the call that says so.

A consumer who wants a row they created to stop counting has `rebaselineToCurrentValue()`, and the
workspace's own test for renames needed it — evidence the behaviour is observable and that the escape
hatch is the one to reach for.

## Alternatives rejected

**Give a new row's cells the template's initial rather than the row's value.** The row would then
differ from its baseline cell by cell, and a patch would carry it. It also makes a row added with the
template's own values invisible again, and it moves what `reset()` on a single cell returns to.

**Compare the collection's current keys with the manager's initial keys in the typed form.** It
answers for a collection the schema declares and not for one inside a row, whose keys are data all
the way down. The engine holds every path, so the answer lives where the paths are.

**Leave it and document that a patch omits new rows.** It makes the published sentence about
`getChanges()` false for every form with a collection, which is most of them.

## Verification

`battle-tests/adversarial/submission/a-row-nobody-sends.battle.test.mjs` is the check: it declares a
row in a keyed and a positional collection, resets, and requires the two readings of the baseline to
agree. `packages/core/test/record-fields.test.mjs` holds the rename, and
`packages/core/test/core.test.mjs` holds the levels `setInitialValue` can name.

## Security and privacy

A patch now carries rows it did not carry before, so a consumer sending `getChanges()` to a server
sends more of what the user typed. It sends nothing the form would not send on submit, and the rule
that keeps a field out of a patch is unchanged: a field out of play is still left out, so a disabled
or hidden cell of a new row stays out of the body.
