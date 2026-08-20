# ADR 0107: A draft is read by the form that wrote it

Status: Accepted

## Context

A stored draft records `shape`, a short stable name for the form that wrote it. It exists so two
forms sharing a key can tell their work apart — a component rendered twice, a route mounting a form
beside another, a key copied along with the options it sits in.

The **write** side reads it: `_foreignPaths` compares the stored shape against this form's and
refuses to overwrite work that is not its own, so nobody's typing is silently replaced.

The **read** side did not. `_parse` checked `__mdyDraft` against the version and `savedAt` against
the TTL, returned `parsed.value`, and never looked at `shape`. So the draft the writer had declined
to replace was the one the reader restored:

    form B writes   {"shape":"1xxig97","value":{"email":"victim@example.test"}}
    form A opens  → { email: "victim@example.test", password: "", note: "" }

    form A writes   {"shape":"1gqrgtk","value":{"email":"a@…","note":"a private note"}}
    form B opens  → { email: "a@…" }

Nothing was tampered with. Both envelopes were written by this library, both shapes were recorded,
they differ, and both were available at the moment of the decision. What one person typed in one
form appeared filled in in another, and was submitted from there.

The guard was installed on one door of two, and survived the work that added the other.

## Decision

Both doors ask the same question. A form does not restore an envelope whose recorded `shape` is not
its own.

It does not **remove** it either. `_parse` answering `null` means the entry is unusable — corrupt,
superseded, expired — and the caller drops it; an envelope belonging to another form is perfectly
usable, by that form, and this one has no standing to delete it. So the shape check sits beside
`_parse` rather than inside it: the draft is left where it is, and the write side then refuses the
key and says so under `MDY_DRAFT_KEY_IN_USE`.

An envelope that records no shape is still restored. It is this form's own earlier work as far as
anything can tell — refusing it would discard what a person typed to close a hole that draft cannot
be on either side of — and the write side's path comparison is what covers those.

## Consequences

Two forms under one key now both keep their own work: neither restores the other's, neither deletes
the other's, and the second one to save says out loud that it is keeping no draft. That is three
different behaviours a host has to understand for a situation it should not be in, which is the cost
of not losing data in it.

A form whose shape changes between releases — a field added, a field renamed — no longer restores
the drafts it wrote before the change. That was already true of the write side, and `version` in the
draft options is the deliberate spelling of the same intent.

The shape is a hash of the form's baseline paths, so two genuinely different forms that declare the
same paths share a shape and neither guard separates them. Their drafts are interchangeable by
construction, which is why that is not the failure this closes.

## Alternatives rejected

**Drop the entry when the shape differs.** Deletes another form's work to protect this one, turning
a wrong restore into permanent data loss.

**Filter the restore per path instead of refusing the envelope.** The write side already compares
paths, and it is the weaker half: a form whose paths are a subset of another's passes it. The shape
is what tells them apart, and using it only for a partial filter would restore the overlap — which
is exactly the fields whose values are most likely to be someone else's.

**Leave it, and document that a draft key names one form.** It is documented. The defect is that the
library enforced it on one side and not the other, so the documentation was true of writing and
false of reading.

## Verification

- `battle-tests/adversarial/persistence/*` — a form does not restore a draft belonging to another
  form; the write-side refusal is asserted beside it, so a repair cannot pass by deleting the entry.
- `packages/core/test/published-tables.test.mjs` — the refusal reaches the console under
  `MDY_DRAFT_KEY_IN_USE`, which is the check that caught the first attempt at this fix removing the
  other form's draft instead of leaving it.

## Security and privacy

This is the whole finding. A draft holds what a person typed and has not sent: an email address, a
note, an answer they are still deciding about. Restoring it into another form put one person's
unsent text into another person's form, pre-filled, where the ordinary act of submitting sends it
onward — a confidentiality failure reached without touching storage, from two forms that merely
shared a key. Fields declared `sensitive` were never written to a draft and are not part of this;
everything else was.
