# ADR 0086: A derived form starts at an empty its own schema accepts

Status: Accepted

## Context

`createZodForm(z.object({ name: z.string() }))` seeded every leaf with `null` unless the piece
carried a default, because `null` is the engine's sentinel for "not filled in yet". A Zod piece is
not obliged to accept that sentinel, and the most ordinary one does not:

```
arrival   value null  valid false  required true   "Invalid input: expected string, received null"
typed     value "Ada" valid true   required true
cleared   value ""    valid TRUE   required true
```

One field, empty twice, refused once. The permissive state is the one a person reaches by using the
form, so a consumer reading `z.string()` as "must be answered" ships `""` in the payload, and one
reading the disabled Submit on a fresh form as "validation works" reads something that stops being
true after two keystrokes.

`required` made it a contradiction rather than an asymmetry. It was computed as *the piece refuses
`null`* — a statement about the form's sentinel — so the field drove `aria-required` while its own
validator accepted `""`. A screen reader and the payload disagreed about the same field in the same
state.

## Decision

The initial value of a derived leaf is an empty **its own piece accepts**, and `required` is the
statement that the piece refuses that empty.

The seed is chosen in the order the value contracts use:

1. what the piece parses `undefined` into — a default or an optional, unchanged;
2. `null`, when the piece accepts it: absence is one of that piece's values;
3. `""`, when the piece holds it — accepted, or refused only for being too short or too long, which
   is a constraint on a string the piece does take;
4. `false`, on the same rule;
5. `null` otherwise, for a piece with no representation for empty — a number, an enum — which then
   refuses it at the start and refuses it again when the control is cleared.

`required` is `true` exactly when the piece refuses the seed. `z.string()` asks for nothing and is
not required; `z.string().min(1)` starts at `""`, is invalid, and says *Too small* both at arrival
and after the user empties the box.

## Amendment: the rule is the kind's value contract, not the schema library

The decision above is stated over Zod pieces, which makes it checkable only against the installed
library — a handful of leaf shapes standing in for a vocabulary of seventeen kinds. The same rule
said over what the framework already publishes is stronger and covers all of them:

```
seed === null   if and only if   MDY_VALUE_CONTRACTS[kind].nullable
the seed's shape                 is MDY_VALUE_CONTRACTS[kind].shape
```

Measured across all seventeen kinds, through `parseDynamicForm` + `buildFlatFormSchema`: they agree.

```
text/textarea/email/password/colors  nullable false  string      ""
slider                               false           number      0
checkbox/toggle                      false           boolean     false
multiselect                          false           option[]    []
file                                 false           file[]      []
daterange                            false           dateRange   {start:null,end:null}
number/select/radio/segmented        true            —           null
datepicker/timepicker                true            string      null
```

Both halves carry weight. Without the second, `nullable: false` would be satisfied by *any*
non-null value — `0` in a text field, `""` in a checkbox — and a form would open showing an answer
nobody gave.

This settles the boolean by derivation rather than by exception. A checkbox's contract says absence
is not one of its values, so its empty is `false`; `expression.ts` saying `false` is not *empty*
speaks about a condition reading an answer a person gave, which is a different question from what a
field holds before anybody touches it.

The Zod-side reading — accept the empty when the piece refuses it for `too_small`, `too_big` or
`custom` rather than for its type — is the **translation** into this rule, not the rule. A
refinement is how an author writes a rule the library has no built-in for, and reading only the
library's own checks made the seed depend on how a rule was spelled: `z.string().min(2)` started at
`""` and `z.string().refine(…)` at `null`, where the author's own message never appeared because a
value of the wrong type never reaches the predicate carrying it.

`battle-tests/adversarial/schema-adapters/where-a-kind-starts.battle.test.mjs` holds it across the
vocabulary. Nothing else forces the two published facts to agree — the value contracts are a table,
the seeds are chosen where a schema is built — so a kind added to one and not the other is exactly
the silence it breaks.

## Consequences

A form built from a schema of plain `z.string()` fields is **valid on arrival and submittable**.
That is the honest reading of the schema — it demands nothing — but it removes a refusal consumers
could see, and a fresh form's enabled Submit is the visible change. A consumer who wanted the field
answered writes `.min(1)`, which now refuses both emptinesses in the same words.

`required` no longer marks a field whose validator would pass on empty, so `aria-required` follows
the rule rather than the sentinel.

A piece whose empty is a *format* — `z.email()`, `z.iso.date()` — keeps `null` and answers with a
type message at arrival and a format message once a control writes `""`. The verdict is the same at
both moments; only the sentence differs. Narrowing that would require this package to decide which
Modyra kind a Zod piece is rendered as, which it does not know and should not guess.

## Alternatives rejected

**Keep `null` and translate the message.** Saying *This field is required* instead of *expected
string, received null* repairs the vocabulary and leaves the defect: `""` is still accepted two
keystrokes later, so one emptiness still gets two answers.

**Refuse `""` for every `z.string()`.** That is a rule this package would be inventing. `z.string()`
accepts the empty string in `safeParse`, and a bridge whose form refuses what its schema accepts is
a second source of truth.

**Seed from the Modyra value contracts by kind.** The bridge has a piece, not a kind; mapping one to
the other would duplicate the renderer's decision in a package that never sees the renderer.

## Verification

`battle-tests/adversarial/schema-adapters/two-empties-one-schema.battle.test.mjs` — *a derived
form's own empty is one its schema accepts* — fails if a field is required, empty and valid in the
same state. `packages/zod/test/*.test.mjs` holds the seeds and the required marks per piece shape.

## Security and privacy

No trust boundary moves; the bridge reads a schema the consumer wrote and no external input. The one
security-adjacent effect is a form that submits earlier than it used to: a consumer relying on the
old accidental refusal as a validation gate loses it. Server-side validation is unaffected, and
ADR 0009 already states that client validation is defence in depth rather than the gate.
