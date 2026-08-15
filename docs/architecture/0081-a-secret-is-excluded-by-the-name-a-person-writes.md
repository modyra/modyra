# ADR 0081: A secret is excluded by the name a person writes

Status: Accepted

## Context

The draft guide carries this in bold, as an instruction rather than a warning:

> The default storage is `localStorage`: plain text, readable by every script on the origin, and it
> survives logout. **Always `exclude` passwords, card numbers, tokens and any other sensitive field.**

`exclude` matched an exact leaf path and nothing else. For a field at the top of a form that is
enough. A card number is the guide's own example and card numbers live in a list, where the row key
is data — so of the four ways a consumer writes the same intent, only one worked, and it is the one
nobody can write in advance:

| written | what it means | card number in the draft |
| --- | --- | --- |
| `["password"]` | the flat field beside it | no — this is the case that worked |
| `["cards"]` | the whole collection | **yes** |
| `["cards.*.pan"]` | that cell in every row | **yes** |
| `["pan"]` | the cell, by name | **yes** |
| `["cards.a.pan"]` | one row, spelled out | no |

`a` is a key the user creates at runtime. A consumer following the instruction correctly still
persisted the secret, and nothing about the form afterwards looked wrong — which is what made it
silent.

## Decision

**An entry in `exclude` is matched four ways.**

- the exact path, as before;
- an **ancestor**: `cards` excludes everything under `cards.`;
- a **pattern**: `*` stands for exactly one segment, so `cards.*.pan` is that cell in every row, and
  `cards.*` is the subtree;
- a **bare name**: an entry with no dot excludes any cell with that name, wherever it sits.

**The matching is deliberately generous, and that is the decision rather than a side effect.** This is
a promise about a secret: an entry excluded by mistake costs a convenience, and an entry persisted by
mistake is a card number in plain text, readable by every script on the origin, surviving a logout.
Where the two errors are not symmetric, the rule leans toward the one that cannot leak. An author who
needs precision writes a full path, which still matches exactly.

**Both directions, unchanged.** `exclude` has always meant *neither persisted nor restored*; the same
matcher answers on the way out and on the way back, so a tampered draft carrying an excluded path
still restores nothing.

## Consequences

**A bare name can exclude more than its author meant.** `exclude: ["name"]` keeps `person.name` and
`company.name` out of the draft as well as a top-level `name`. That is the generous direction working
as decided, and it is documented in the guide's table, but it is a real surprise for a non-secret used
as a bare name.

**A draft written before this keeps entries the form now excludes.** They are dropped on restore
rather than applied — the same matcher answers both ways — so the stale secret in storage is not
brought back into the form. It is still *in storage*: this changes what the library writes, not what
is already written. A consumer who was relying on the broken behaviour to keep such a value should
clear the key.

**The check runs per entry on save and on restore.** It is a handful of string comparisons against a
set that is typically one or two entries.

## Alternatives rejected

**Prefix matching only.** It answers `["cards"]` and leaves the guide's own example — a named cell
inside rows — unanswerable without knowing the row keys in advance.

**Wildcards only.** `["cards.*.pan"]` is precise and is what a careful author writes, but `["cards"]`
and `["pan"]` are what people try first, and a security control that silently does nothing when
written the obvious way is the defect this record closes.

**A predicate — `exclude: (path) => boolean`.** More expressive and worse here: the common case
becomes code, and a mistake in that code is silent in exactly the same way. The four spellings cover
what the guide instructs; a consumer needing more can supply their own `MdyDraftStorage`.

## Verification

- `battle-tests/adversarial/security/a-secret-with-nowhere-to-hide.battle.test.mjs` — the attack that
  found it: all four spellings keep the number out, and the flat control still works.
- `packages/core/test/draft.test.mjs` — the same four, plus the two controls that make the assertion
  mean something: without an exclusion the number *is* written, and excluding one cell leaves the rest
  of the row and the rest of the form in the draft.

## Security and privacy

This is the repair of a control that reads as working. Sensitive values reached `localStorage` in plain
text — readable by every script on the origin, surviving logout — while the documented mechanism for
preventing it was being used correctly. It changes only what is written and what is restored; a value
already in storage from an earlier version stays there until the key is cleared, and is no longer
restored into the form.
