# ADR 0088: A draft is not replaced by one belonging to another form

Status: Accepted

## Context

`draft: { key, storage }` is the whole surface, and the key is a string a consumer writes. Two live
forms holding the same one is ordinary — a component rendered twice, a route mounting a form beside
another, a key copied along with the options it sits in.

The last save took the whole envelope:

```
form A   alpha = "the first person's answer"
form B   beta  = "the second person's answer"

stored     {"__mdyDraft":1,"savedAt":…,"value":{"beta":"the second person's answer"}}
said       nothing, at devWarnings' default
A reopened {"alpha": ""}
```

Not a merge and not a refusal. One person's typing is gone from the only place it was being kept,
and reopening their form restores nothing — the draft under their key describes a field they do not
have, so the shape gate correctly refuses it. Every layer behaved as designed and the work was lost
in silence.

## Decision

A form does not replace a stored draft it could not read back.

Before writing, the manager reads the stored envelope and asks the form's own shape gate about every
path in it. If any path is one this form does not declare, the draft belongs to a different form:
this form keeps no draft of its own, reports `MDY_DRAFT_KEY_IN_USE` once, and leaves the stored work
untouched. Restoring is unaffected — reading takes nothing away.

Shape, not lifetime, is what tells the two apart. A form reopened on its own draft, and a second tab
of the same form, store paths the form declares; replacing those is the intended behaviour and still
happens, still with the existing *saved more recently by something else* warning.

## Consequences

A consumer who deliberately shares one key between two differently-shaped forms loses the second
form's autosave. That is the case being repaired: it was never two drafts, it was one form's work
being deleted by another's.

The refusal is reported once per form rather than per keystroke, so a shared key is visible in a
console or a diagnostics sink without flooding it.

A form whose schema **shrank** — a field removed between releases, with no `version` bump — now sees
its own older draft as foreign and stops saving, where before it would have replaced it. `version`
is the declared way to retire a draft shape and remains the answer; the warning names the paths, so
the cause is legible rather than silent.

Each write pays one extra `storage.read`, on a debounced path that already reads the stamp.

A registry of live keys was implemented first and rejected during verification: it made a form that
is never destroyed hold its key forever, which silently disabled drafts for every later form under
that key — including inside a single test process. A rule that depends on disposal being perfect
fails exactly where drafts matter, in a page that reloads and re-mounts.

## Alternatives rejected

**Warn and overwrite anyway.** The warning arrives after the work is gone; nothing can restore it.

**Merge the two envelopes.** Two forms with different shapes produce a union no form declares, which
the shape gate then refuses at restore — the same loss, one step later.

**Refuse the second form's draft at construction.** It requires knowing which form is second, which
requires a live-key registry, which requires disposal to be perfect. See above.

**Take the key and let the first form deal with it.** Symmetrical loss, chosen by timing rather than
by anything a consumer can reason about.

## Verification

`battle-tests/adversarial/persistence/one-key-two-forms.battle.test.mjs` — *a draft is not replaced
by one belonging to another form* — asserts the first form's work survives two live forms sharing a
key, with a single form on its own key as the control. `draft-lifecycle.battle.test.mjs` holds the
other side: a form that reopens its own draft still replaces it.

## Security and privacy

The stored envelope is read once more per write, from the storage the consumer supplied; nothing new
is written and no value leaves the process. The diagnostic names paths — field names, not values —
so a shared key does not print what a person typed. Refusing to write is the conservative direction:
a form that cannot prove the draft is its own writes nothing at all.
