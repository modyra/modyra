# ADR 0080: A path is an instruction a row's shape can refuse

Status: Accepted

## Context

A draft is written flat — one entry per leaf path — and read back the same way. `lines.x.sku` is a
cell of row `x`, and a row named by a path the collection does not have yet is **created to receive
it**: that is how a saved order gets its lines back after a reload, and it is deliberate.

It also makes the path an instruction. The security guide states the threat model in its own words: a
draft lives where every script on the origin can write it. `draftShapeMatches` guards the stored
*value* against the field's initial, and a key is not a value — so one extra segment is the whole
attack:

```
lines.a.b.sku = "OWNED"
```

There is no row `a`, and no `b` inside a row. Both were made. The collection then held a row of a
shape its own template never described, and because there was no field at `lines.a.b.sku` to be
invalid, the form called itself **valid and submittable with no errors**. Neither way out worked:
`submitValue()` threw `Flat patch does not match schema shape`, which at least names something, and
`submit()` threw a raw `TypeError` from inside the engine, which names nothing. `onSubmit` was never
called.

The layering that should have held is the one `draft-shape-gate` records: the gate is permissive on
purpose, because a shape that does not match makes the field invalid and `canSubmit` false. That
works when a field exists to be invalid. Here the draft invented the field as well as the row.

## Decision

**A collection creates a row for a path only when its template declares the cell that path names.**
`rowDeclaresCell(item, rest)` walks the remainder of the path against the row descriptor: a group
answers for its named children, a field answers for nothing below it, and a nested collection answers
for its own subtree — its rows do not exist yet either, and its own manager applies the same rule when
they arrive.

**A path the template does not declare is ignored, and said so in development.** Not thrown: a draft
and a server answer are outside data, and the rule this repository already holds is that outside data
is refused rather than allowed to take the form down.

**Both kinds, one rule.** The keyed and positional managers each grow to receive an owner's own data,
so each asks the same question of the path before growing.

## Consequences

**A draft written against an older document loses entries whose paths no longer exist.** That is the
intent — the alternative is what this record exists to close — and it is a behaviour change for a
document whose row shape was edited between the save and the restore: those cells are dropped with a
named warning instead of arriving as a row shaped like the old document.

**The check runs per refused write during a restore**, which is a walk of a few segments against a
descriptor, once per path a draft carries for a row that does not exist yet.

**A nested collection is trusted at its boundary.** `rowDeclaresCell` returns true as soon as the walk
reaches one, because that manager owns the subtree below it. If a nested manager is not registered
yet, the paths under it are accepted here and refused there — one rule, applied at the level that
knows the shape.

## Alternatives rejected

**Validate the whole restored value against the schema and refuse the draft entirely.** One malformed
entry would throw away a person's work, which is the outcome the flat format exists to avoid: entries
are independent, and one that cannot be placed should not take the others with it.

**Let the row be created and rely on the shape gate.** That is what happened. There was no field at
the invented path, so nothing was invalid and the form reported itself ready.

**Throw on an undeclared path.** A draft is written by anything on the origin. A form that refuses to
open because storage holds a bad key is a denial of service with extra steps.

## Verification

- `battle-tests/adversarial/persistence/a-row-a-draft-invented.battle.test.mjs` — the attack that
  found it: the invented row is gone, the honest row and its value come back, and both ways out work.
- `battle-tests/adversarial/persistence/draft-shape-gate.battle.test.mjs` — the layering it must not
  break: a value of the wrong shape still reaches the field and still makes it invalid.
- Measured directly: a draft carrying `lines.x.sku` and `lines.a.b.sku` restores `{"lines":{"x":
  {"sku":"S1"}}}` and warns by name about the other.

## Security and privacy

This closes a write from storage into the form's shape. Anything on the origin can write a draft, and
before this a key with an extra segment created a field of the writer's choosing inside a collection —
present in `fieldNames()`, drawn by any document-driven renderer, and carried into the value a host
reads. It cannot now name anything the document did not declare. The value gate is unchanged and still
answers for what a declared field may hold.
