# ADR 0089: A field that says it is a secret is treated as one

Status: Accepted

## Context

`sensitive` is a boolean on a dynamic field. The Dynamic Form Contract declares it, the parser
type-checks it and drops the whole field when it is not a boolean, and the project editor offers it
as something an author toggles. Everything about it says it is read.

Nothing that protects the value read it. A draft keeps out what `exclude` names, and `exclude` is a
list the application passes when it creates the form — it never consulted the document. The devtools
panel masked what a path *looked* like plus what a caller's predicate answered. So:

```
document   { name: "secret", kind: "text", sensitive: true }
draft      {"__mdyDraft":1,…,"value":{"secret":"sk-live-DEADBEEF", …}}   in clear
panel      secret: "correct horse battery staple"                        in full
said       nothing
```

The reading an author takes is the dangerous one: the flag is the only thing in the document that
names secrecy, so setting it looks like the protection. The value it covers is exactly the value
worth covering.

The panel's own heuristic shows why a declaration is needed rather than a better guess: it matches
`password|secret|token|card|…`, which is wrong in both directions — `notes` can hold a recovery
phrase and `cardStyle` is masked for containing "card".

## Decision

`sensitive` is a property of a field, declared once where the field is declared, and every place
that would otherwise copy the value out reads it.

- `field(initial, validators, { sensitive: true })` carries it on the descriptor, so a typed schema
  can say it too — the document is not the only author.
- `buildFlatFormSchema` and `buildDynamicFormSchema` carry the document's flag onto the descriptors
  they build.
- The form registers the paths and `enableDraft` adds them to `exclude`. The call's own list is kept:
  this widens what is withheld, never narrows it.
- `mdyFormSnapshot` masks them. Order: the caller's predicate first — it is the panel's override —
  then the declaration, then the name heuristic.
- `MdyTypedForm.sensitivePaths()` publishes the list, because a logger, a telemetry payload or a bug
  report has the same question and no other way to ask it.

The registry members are optional (`markSensitive?`, `sensitivePaths?`), so an adapter written
against the earlier contract still satisfies it and keeps the behaviour it had.

## Consequences

`MdyFieldDescriptor` and `MdyAnyFieldDescriptor` gain a **required** `sensitive` member. Code that
builds a descriptor as an object literal rather than through `field()` no longer compiles — the
audit classifies this as major, and this reading agrees with it.

A field marked sensitive is no longer autosaved. That is the point, and it is a behaviour change for
a document that already set the flag: work in that field is no longer restored after a reload. The
alternative is restoring it from clear-text storage, which is what this record refuses.

`sensitive` says nothing about what is *submitted*. A secret a form collects is a secret the server
asked for; withholding it from the payload would break the form rather than protect anyone.

## Alternatives rejected

**Warn that the flag was ignored.** The battle allowed it — *protects it, or says that it did not* —
and it is the weaker half: an author who sets a flag named `sensitive` is telling the form what to
do, not asking to be told it will not.

**Mask in the panel only.** The panel is a development surface. The draft is the one that writes the
value to a disk the user does not control.

**Make the renderer read it** (a `password`-style control for any sensitive field). That is a
separate decision about presentation, and `kind` already exists to say it. This record is about
copies of the value, not about what is on screen.

## Verification

`battle-tests/adversarial/security/a-flag-the-document-sets-and-nothing-reads.battle.test.mjs` — the
draft half, with `exclude` working as its control — and
`a-field-that-said-it-was-sensitive.battle.test.mjs` — the panel half, with the masking predicate
asserted on its own first, so a failure separates the rule from the wiring.

## Security and privacy

This is the record's whole subject. A value an author declared secret stopped reaching two places it
was reaching: `localStorage` (or whatever storage the consumer supplied), and the devtools panel's
DOM. Both are readable by anything else running on the page, and storage outlives the session.

What it does not do: the value is still in memory, still submitted, and still visible in the control
the user typed it into. A field marked sensitive whose adapter predates `markSensitive` keeps the
old behaviour — the member is optional by design, so the guarantee is only as strong as the adapter,
which is why `sensitivePaths()` is published for a consumer to check.
