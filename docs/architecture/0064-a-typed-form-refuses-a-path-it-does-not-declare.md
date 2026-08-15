# ADR 0064: A typed form refuses a path it does not declare

Status: Accepted

## Context

One transposed letter took a working form and made its Submit button do nothing:

```js
const form = createForm({ email: field("") });
form.f.email.set("someone@example.com");     // valid, submittable

form.addValidators("emial", [required()]);   // one letter

form.state.valid();       // false
form.state.canSubmit();   // false
await form.submit(send);  // send was never called
```

The rule is not satisfiable: nothing renders a control for a path the schema never declared, so no
value can ever reach it. The error exists, on a path nothing is bound to, which means a filled-in
form, a dead button, and no message anywhere — `devWarnings: true` included.

The way out is `removeField("emial")`, and finding it requires knowing the ghost is there. It is
findable — walking `fieldNames()` and asking each for its errors turns it up — but nothing points
that way, and the call that created it said nothing.

The same name reaches other doors and is quietly ignored there instead: `patch`, `patchValue`,
`rows.upsert`, `rows.patch`, `setInitialValue`. Two behaviours, one mistake, and neither says
anything.

## Decision

**A typed form refuses a path it does not describe, at the call, naming the path.** It covers the
doors that attach something durable to a name: `addValidators`, `upsertValidators`,
`upsertAsyncValidators` and `setInitialValue`.

**It is the typed form's check and not the engine's.** `MdyFormEngine` has no schema — a field coming
into being because something asked for it is how a declarative adapter builds a form at all, and
`getField` is documented as get-or-create. The check belongs exactly where a declaration exists to
check against.

**A collection's cells count as declared.** `rows.a.code` is described by the collection's prefix
before any row exists, because a control mounting ahead of its row is the ordinary case.

**Refused rather than reported.** A warning is stripped in production, and this failure is a button
that does nothing — the state a warning would have described is one the consumer cannot recover from
without first learning that the ghost exists.

## Consequences

`upsertValidators` on an undeclared path now throws where it used to attach a rule that could be
removed again by key. That undo was real, and it is withdrawn deliberately: the dead Submit is the
same through either door, and an escape hatch only helps someone who already knows what happened.

`setInitialValue` on an undeclared path throws instead of doing nothing. Nothing observable is lost —
it did nothing — but a caller who was making that call harmlessly now finds out.

A consumer attaching rules to paths computed at runtime — a name from a document, a key from a
response — gets a throw where it used to get silence. That is the intent, and it is the case where
the mistake is most likely.

The three interactivity setters — `setDisabled`, `setInactive`, `setReadonly` — are **not** in this
decision. They have a second defect of their own: given a *group* path, which the schema does
declare, they do nothing rather than reaching the fields inside it. Refusing an undeclared path there
without answering the group question would fix half a door, so both belong in one batch.

## Alternatives rejected

**Refuse in `addValidators` only.** It closes the battle that found this while leaving the keyed door
open to the same typo, and it makes the rule "some doors check the name", which is the state that
produced this finding.

**Report on the development channel and carry on.** Production is where a dead Submit is unexplained,
and the warning is stripped exactly there.

**Make the rule satisfiable by declaring the field.** It turns a typo into a form with a field nobody
asked for, which is the same silence one step later.

**Check in the engine.** It has no schema to check against, and adding one would break the
declarative adapters that build a form out of what mounts.

## Verification

- `battle-tests/adversarial/validation/a-rule-about-a-field-that-is-not-there.battle.test.mjs` — the
  call, the dead Submit, and the keyed pair that used to undo itself.
- `packages/core/test/` and `packages/angular/` — every internal and adapter caller of these four
  doors passes a declared path, which is what says the check does not narrow a legitimate use.

## Security and privacy

None directly. A refused call cannot register a field, which removes one way for an attacker-supplied
name — a key from a response used to attach a rule — to add a path to a form's own state. The message
names the path it refused and nothing else about the value.
