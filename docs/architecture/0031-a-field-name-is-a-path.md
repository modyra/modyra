# ADR 0031: A field name is a path, in a schema as everywhere else

Status: Accepted

## Context

Everywhere in the framework a field name is a path. `claimField("shipping.city")` registers a field
inside `shipping`; the engine stores every value flat, keyed by path, and unflattens it on read; a
draft, a server error and a history entry all address a field the same way.

One place disagreed. A schema is an object, and an object key is a string — so a schema built with
the key `"shipping.city"` described a form with one root field whose name happens to contain a dot,
while the value the engine produced for it was two levels deep. The two never met: `getValue()`
compared the unflattened value against the schema shape, failed, and threw
`Flat value does not match schema shape` — at the first read, with nothing naming the declaration
that caused it.

This was not a hypothetical spelling. The dynamic form contract carries a *nested* document as a
flat list of fields named by path: `parseDynamicForm` turns a group into `shipping.city` and a
keyed collection into `lines.12.name`, by design, and adapters mount that list. Every consumer that
built a schema from those names — `@modyra/plain`'s `buildFormSchema`, `@modyra/react`'s
`buildDynamicFormSchema` — produced a form that rendered its fields correctly, accepted typing, and
could never be read or submitted. `@modyra/angular` was unaffected because its dynamic component
registers declarative controls, where a name has always been a path.

## Decision

**A schema key that spells a path declares the structure that path describes.** The typed form
normalizes its schema before anything reads it: `{ "shipping.city": field("") }` is
`{ shipping: group({ city: field("") }) }`, and the handle tree, the registered paths and the value
all follow from the normalized schema.

The rule holds wherever a schema is written — a group's children and a collection's item are
schemas of their own — and it is symmetric: `shipping: group({ zip })` beside `"shipping.city"` is
one `shipping`, in either order.

A name that would be both a value and a parent is refused with an error naming it. Nothing may be a
field and a group at once, and choosing one for the caller would discard the other in silence.

Only groups are reconstructed. Whether a segment was an array row or a record key is not
recoverable from a path — `lines.0` reads as the key `"0"` — so a collection flattened into paths
returns as nested groups, and a form that must round-trip a list declares `array()` or `record()`
itself. A collection declared in the schema keeps its own semantics; normalization descends into
its item without changing what the collection is.

## Consequences

A flattened document now mounts into a readable form: the value a nested document declares is the
value the form returns.

The typed surface no longer matches the runtime shape for the dotted spelling. `S` is inferred from
the literal the caller wrote, so `form.f` types as if `"shipping.city"` were a root key while the
handle tree has `f.shipping.city`. The dotted spelling is for schemas built dynamically from a
document, where the type is erased to `MdyFormSchema` anyway; typed code should write the group.

A schema with no path in it is returned unchanged, by identity, so nothing pays for a normalization
that has nothing to do.

The error that used to surface at the first read is now impossible for this cause, and the two
genuine conflicts — a name declared as both field and group — surface at construction instead.

## Alternatives rejected

**Refuse a dotted key.** The first diagnosis, and wrong: it would refuse every flattened document,
which is the contract's own output. Two existing tests mount `shipping.city` and `lines.12.name`
and pass; they never read the value, which is why the defect was green.

**Fix the two adapters instead of the engine.** `@modyra/plain` and `@modyra/react` are the two
consumers that build a schema from paths *today*. Leaving the engine strict would keep a dotted key
a silent defect for every other consumer, and put the same reconstruction in two places — the
duplication that ADR 0030 was written about.

**Carry the collection structure through the flat list**, so an array returns as an array. It is
the complete answer and remains open: it adds public surface to the parse result and touches every
adapter that mounts a document. Recorded here as the known limit, not as a decision against it.

## Verification

`packages/core/test/core.test.mjs` covers the rule directly: a dotted key reads back nested and its
handle answers; normalization inside a group and inside a collection item; the merge in both
orders; and both conflict directions throwing. `packages/plain/test/identity.test.mjs` mounts a
field named by path, types into it and reads the nested value — the end-to-end failure this record
exists for. `packages/react/test/dynamic-form.test.mjs` asserts the same for the React schema
builder.

Remove the normalization and every one of those fails.

## Security and privacy

Normalization builds structure from a caller's schema, which makes prototype keys the risk it must
not introduce. It does not: `assertSafeDynamicFieldNames` refuses a name with an empty segment,
`__proto__`, `prototype` or `constructor` before a field list becomes a schema, and the engine's own
`isSafeFieldPath` refuses the same paths at field registration. A path is walked segment by segment
into plain objects created here, never assigned through a key the caller controls without that
check.

No data leaves the process, and nothing is stored differently: the engine already kept values flat
by path, which is what this record aligns the schema with.
