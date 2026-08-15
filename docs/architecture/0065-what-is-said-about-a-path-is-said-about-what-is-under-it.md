# ADR 0065: What is said about a path is said about what is under it

Status: Accepted

## Context

A schema can put a section out of play, and it works: `group(children, { when })` takes the section
out of the payload when the condition closes and puts it back when it opens.

The imperative door did not. `setDisabled`, `setReadonly` and `setInactive` sit on three consecutive
lines of one interface, all taking `(name, signal)`, and given anything but a leaf they reached
nothing — measured at every level, in both kinds of collection:

| path named | honoured | the cell inside | payload |
| --- | --- | --- | --- |
| `rows` (a collection) | silently, no | `disabled=false` | unchanged |
| `rows.r1` (a row) | silently, no | `disabled=false` | unchanged |
| `rows.r1.code` (a leaf) | yes | `disabled=true` | the cell leaves |
| `sect` (a group) | silently, no | `disabled=false` | unchanged |

Someone writing `setDisabled("billing", () => !wantsBilling())` has done what the documentation
shows, received silence, and ships a section that stays editable and stays in the payload. The first
evidence is on a server.

## Decision

**What a binder says about a path is answered by every field under it.** A group, a collection, a
row: naming one puts what it contains out of play, which is the rule
`group(children, { when })` already follows from a schema. The imperative door gets the answer the
declarative one has.

**Composed on read, not pushed down.** A field's interactivity reads the bindings on the paths above
it each time it is asked, so a row declared *after* the sentence was spoken is covered by it too. A
one-time walk over the fields that exist would have left the next row out — which is the same silence
one step later, and the harder one to find.

**`disabled` still wins over `readonly`, at any depth.** An outer `disabled` disables; an outer
`readonly` makes a field readonly unless something nearer says disabled. It is the rule the field
already followed between its own three inputs, applied to the fourth.

**`setInactive` binds to the path as well as to the record.** It used to write only to the record for
that name — which, for a path with no value of its own, is a record nothing reads.

## Consequences

`setDisabled` on a container is now a capability rather than a no-op, so code that called it
believing it worked starts working. That is the intent and it is a behaviour change: a consumer who
had *worked around* the no-op by disabling each leaf now has both, which is harmless, and one who was
calling it on a container by accident now sees a section leave the payload.

Every field's interactivity walks its ancestors on read — at most one lookup per path segment, on a
computed the reactivity already caches. Deep collections make the path longer; nothing else grows.

A path names an ancestor by string prefix, so a field is affected by a binding on any dotted prefix
of its own name. That is exactly the containment the schema declares, and it is why the check is
cheap; it also means a binding on a path that later stops being an ancestor stops applying, which is
the correct answer for a row that was removed.

The engine does this without a schema — it needs none, because containment is visible in the path.
That keeps the rule true for a declarative adapter, where the shape is whatever mounted.

## Alternatives rejected

**Refuse a non-leaf path.** Consistent with [ADR 0064](0064-a-typed-form-refuses-a-path-it-does-not-declare.md)
for names the schema does not declare — and wrong here, because a group *is* declared. Refusing it
would mean the framework has a sentence for "this section is out of play" in a schema and no sentence
for it in code.

**Walk the fields once and set each.** Simpler, and it leaves every row declared afterwards out of a
statement that was meant to cover the collection.

**Do it in the typed form, which knows the schema.** The typed form would have to re-apply on every
structural change, and a declarative adapter — which has no schema — would keep the old silence.

## Verification

- `battle-tests/adversarial/validation/a-section-nobody-took-out-of-play.battle.test.mjs` — the three
  setters against a section, with a schema condition and a leaf-level call as the two controls.
- `packages/core/test/` — the workspace suite, including the conditional sections and collection
  tests that exercise the interaction between an outer verdict and a row's own.

## Security and privacy

A section put out of play leaves the payload, so this closes a way for data a consumer believed
excluded to be submitted. Nothing new is retained: `getValue()` stays total, as
[VAL-002](../../battle-tests/charter/claims-under-test.md) states, and only what is *sent* changes.
