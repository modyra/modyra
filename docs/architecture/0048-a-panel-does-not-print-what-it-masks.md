# ADR 0048: A panel does not print what it masks

Status: Accepted

## Context

`@modyra/core/devtools` masks the value of a field whose path looks sensitive — `password`, `token`,
`cardSecret` — and its guide states the promise plainly: those values are replaced with `•••` in both
the table and the JSON view.

The value column obeyed it. The column beside it did not:

```js
password: field("hunter2", [(v) => [`"${v}" is not long enough`]]);
// value:  "•••"
// errors: ['[validation] "hunter2" is not long enough']
```

Quoting what was rejected is the most ordinary way there is to write a validation message, so the
leak needs no unusual code to reach. The server half cannot be fixed by the consumer at all: a
message that arrives over the wire is not theirs to rewrite, and a snapshot is documented as
something you export, attach to a bug report, or print in a log.

A second, smaller gap in the same function: `mdyFormSnapshot` handed back the live `File`, which
carries no `toJSON` and stringifies to `{}` — indistinguishable from a field nobody filled — while
the same guide promises `[File: name (size)]` in the JSON view.

Found from outside by `battle-tests/adversarial/security/devtools-masking.battle.test.mjs`, whose
assertion is *is the secret anywhere in this snapshot* rather than *is the value column bullets*.

## Decision

**A masked field's value does not appear anywhere in its snapshot.** The value is replaced, and every
error message on that field has the field's own value taken out of it, whichever way the message was
written and whoever wrote it.

The message is **kept and redacted, not dropped**: why a field is invalid is what a panel exists to
show, and a masked field with no reason is a panel that stops being useful exactly where a user is
stuck. A masked list redacts each of its values, and a number is redacted as the text it prints as.
Occurrences are replaced longest first, so a value containing another does not leave the shorter
one's text behind.

**A snapshot describes what it cannot carry.** Values go through `mdyFormSerialize`, the same
function the rest of the engine uses at a boundary, so a `File` reads as `[File: name (size bytes)]`
and a `Date` as its ISO string.

## Consequences

A redacted message can read oddly when the value is a common substring — a password of `"a"` masks
every `a` in the sentence. That is the safe direction, and the alternative is a promise that holds
only for values nobody quotes.

Redaction is per field and per message, on a function that already reads every field's signals; the
cost is a string scan per error on masked fields only.

`mdyFormSnapshot` now returns serialized values rather than live ones. A consumer reaching into a
snapshot for the actual `File` object gets a description instead — the guide already documented the
description as what a snapshot carries, and the live object is one `getField` away.

## Alternatives rejected

**Mask the errors wholesale on a masked field.** One line, and it takes away the reason a field is
invalid — the panel's whole purpose. It also hides server messages that carry no secret at all.

**Leave it to the consumer's validators.** Half the messages are not theirs. A server response is
written by another system, and the leak lands in a snapshot they exported.

**Redact at render time, in the panel only.** The panel is one reader of the snapshot; the exported
JSON is another, and it is the one that travels into a bug report.

## Verification

- `packages/core/test/devtools.test.mjs` — the secret is absent from the whole snapshot while the
  reason survives; a masked number and a masked list are redacted; an unmasked field keeps its
  message exactly as written.
- `battle-tests/adversarial/security/devtools-masking.battle.test.mjs` — the attack that found it,
  covering the validator and server-error paths and the file description.

## Security and privacy

Closes a disclosure of exactly the values the masking exists to protect — passwords, tokens, card
data — through a document a consumer is encouraged to export and share. No trust boundary moves: the
snapshot was always as sensitive as the form, and it now keeps the one promise that made it safe to
hand on. File *contents* were never read and still are not; the name and size are metadata the guide
already documented as shown.
