# What is red, and why

Thirty battles fail on purpose, out of a suite of three hundred and three. Each is a claim the suite
makes about published behaviour that the engine does not currently keep, reduced to the smallest
sequence that shows it, and each names what would turn it green — usually two answers, because most
have more than one defensible repair and the battle asserts the property rather than the fix.

Two of the thirty are not pins. `generative/properties/history.property.test.mjs` and the positional
campaign beside it draw a fresh seed each run and reach their defect most times but not every time;
their green is not evidence, and the battles beside them are. `adversarial/studio/every-target` packs
seven packages and can fail on a loaded machine for that reason, which its first assertion says in
those words.

One cause below is **withdrawn**: it was the reference model rather than the engine, and it is left
in place rather than deleted so that anyone who read it finds out.

The list is grouped by cause. Twenty-four causes, one of them withdrawn. All but the last run under `npm run battle`; the last needs `npm run battle:browser`.

---

## 1. Five setters keep an argument they cannot use

`adversarial/reactivity/signal-shaped-arguments.battle.test.mjs`

`setDisabled`, `setReadonly`, `setInactive`, `addValidators` and `upsertValidators` accept a value
they cannot call and return normally. Every later read that composes it — `disabled()`, `readonly()`,
`state.valid()`, `submitValue()`, `errorsFor()` — throws a `TypeError` naming `disabledSignal`, an
internal the caller never wrote. `getValue()` keeps answering, so the form looks alive.

    form.setDisabled("rows.a.code", true)   // the documented shape is () => true

**Green when** the setter refuses the argument at the call, or holds something the reads survive.
`getField` already refuses everything that is not a path, at the call — the house style to copy.

## 2. A whole-value write that is not one empties the form

`adversarial/validation/a-whole-value-that-is-not-one.battle.test.mjs` — two battles.

`setValue` given a string, a number, `null`, nothing, an array or an object whose keys the schema
does not know leaves every field `null` and every collection empty. The engine's own
`explainValueMismatch` calls the result `text cannot hold null` while `state.valid()` reads true.
`setInitialValue` plants the same value where `reset()` returns for the rest of the form's life.

**Green when** the argument is refused or the form is left as it was. `patch`, `patchValue`,
`rows.upsert`, `rows.patch`, `rows.setAll` and `items.setAll` all take the same six values and damage
nothing.

## 3. Undoing a write that ended several rows returns a state that never existed

`adversarial/persistence/undo-of-a-whole-write.battle.test.mjs` — two battles.

Three rows, `reset`, one undo → one row. The rows come back one per undo in reverse declaration
order, so the first undo lands on a collection the form was never in. `rows.setAll({})` does the
same, and so does a restored draft: three rows restored are four undo steps.

**Green when** the write is one history entry. `form.patch` and `form.patchValue` write two rows and
undo as one step — the precedent inside the same engine.

## 4. A claim waiting for its row dies at a whole-value write

`adversarial/collections/claim-waiting-for-its-row.battle.test.mjs`

ADR 0044 names both things that keep a binding alive: a claim, or a claim waiting for its row. Claims
are counted correctly and a claim made after the row survives `setAll`; one made while the collection
was empty does not. The count is then one short, the next `removeField` releases a claim a mounted
control still holds, and a cell the consumer excluded is submitted.

The pair that locates it, same claim count and same whole-value write on both sides:

    mount (no row yet), push, mount, setAll [], unmount, push   → the claim is gone
    push, mount, mount, setAll [], unmount, push                → one claim is left, as it should be

Re-derived after cause 5 above turned out to be the model rather than the engine. This one is not:
the pair differs in nothing a claim count can see.

## 5. Withdrawn — it was the reference model

`regressions/disabled-across-insertion.battle.test.mjs` is **green** and no longer claims a defect.

It asserted that a binding waiting at an index wins over one a row carries into it. The engine's rule
is the opposite and it is consistent: without a carried binding the waiting one applies, and the same
holds in a keyed collection through a rename. Removing the *first* pending binding makes the second
apply — which a lost binding does not do.

Two campaigns had "confirmed" it, and both read the rule from the same reference model. Two campaigns
finding one divergence are not two pieces of evidence when they share a model.

What is open is the record rather than the code: ADR 0044 says what releases a binding and not which
of two competing ones wins. The file now asserts what holds either way — the two collection kinds
agree, and a binding is never simply lost.

## 6. A rebuilt collection holds nothing

`adversarial/dynamic-contract/flattened-and-put-back.battle.test.mjs`

`flattenDynamicForm` → `buildFlatFormSchema` keeps the collection's kind, which is what DYN-002
promises, and loses the row template: the flattened field list is empty because the cells live inside
the item. The rebuilt keyed collection then accepts `upsert("k", …)`, reports `keys()` as `["k"]` and
returns `{}` from `getValue()`; the positional one accepts `push` and stays empty.

**Green when** the row is refused or held. The two contradictory answers are the part that is wrong
under any reading.

## 7. The v2 tree parser drops field defects in silence

`adversarial/dynamic-contract/what-the-parser-says-it-did.battle.test.mjs` — three battles.

A kind nobody declared, a field with no kind, a select with no options, a select whose options are
not a list and a pattern that backtracks exponentially are each named by the flat parser and dropped
without a word by the v2 tree. `acceptedCount` and `rejectedCount` then disagree with the outcome —
three children in, none accepted, none reported rejected — and `strict` leaves `ok` true for a
document whose only field it emptied, because its rule is that any diagnostic makes `ok` false and
there is no diagnostic.

The parser has the machinery: rules, validations and layout defects are all reported, and a name the
contract forbids is refused in both shapes. The silence is only about fields.

## 8. An index that is not one names row zero

`adversarial/collections/an-index-that-is-not-one.battle.test.mjs`

`remove(-1)`, `remove(99)` and `remove(Infinity)` change nothing, which is right. `remove(NaN)`,
`remove(undefined)`, `remove(null)`, `remove({})` delete the first row — so a parse that failed or a
lookup that missed takes a row and its values. `insert` and `move` put the row at the front instead.
The keyed collection already answers correctly for every one of these values.

## 9. A destroyed form contradicts itself

`adversarial/lifecycle/answers-after-destroy.battle.test.mjs`

Keeping a destroyed form answering is deliberate and not in dispute. Whether the answers agree was
never decided: `getValue` holds the row, `keys()` lists it, `cell.value()` is null, `submitValue()`
is empty, `fieldNames()` is empty, and `canSubmit()` is true. `if (canSubmit()) send(submitValue())`
in a teardown sends an empty payload for a form that just called itself submittable.

## 10. `clearDraft` removes but does not re-baseline

`adversarial/persistence/discarding-does-not-rebaseline.battle.test.mjs`

The guide documents both halves in one sentence. After the discard, `getChanges()` still reports every
edited field, so a `PATCH` built from it sends what the consumer just decided to throw away.
`setInitialValue` moves the baseline and empties the change set — the mechanism exists.

## 11. An option that came back as a fresh object is shown twice

`adversarial/lifecycle/a-value-the-list-does-not-know.battle.test.mjs`

`oneOf` calls a structurally equal object an offered option and `defaultOptionKey` gives it the
option's key, both per ADR 0051. `sameChoice` does not: objects are the same choice only by
reference. So a draft restore, a refetch or an import turns two options into three rendered entries,
two sharing a key, one labelled with its own JSON. `optionsWithUnrecognizedValues` shares the cause,
so one repair covers both.

## 12. A server's answer rendered as `[object Object]`

`adversarial/validation/what-the-server-said.battle.test.mjs`

A `serverValidator` check that hands back the response instead of a message puts `[object Object]`
next to the field. `async (value) => (await response.json())` is the ordinary shape of this code and
its type is `any`, so the signature does not stop it. The package has already written down why that
is the worst answer, about option labels — *cleared is visibly empty, while that looks like a value
and gives nothing to act on* — and the rule has not reached here.

The four real endings all hold and are green beside it: nothing said, something said, a check that
threw, and a check that never answered.

## 13. Two Studio targets call a broken project compatible

`adversarial/studio/every-target.battle.test.mjs`

`studio-model` raises `SELECT_WITHOUT_OPTIONS` at severity error for a select declaring no options.
The json target reports it, answers `compatible: false` and emits no contract. React and Angular
answer `compatible: true`, report nothing and emit both files — so an author generates a form and is
told nothing, which is the half of STU-003 that fails: the field neither reaches usable output nor is
reported as dropped. The emitted document then holds a select `buildDynamicFormSchema` cannot build.

The json target is the control that the finding is reachable, and a project with nothing wrong is
compatible on all three.

## 14. The keyed bulk write does not scale

`adversarial/collections/a-list-that-does-not-scale.battle.test.mjs`

Same three cells, same async validator, same row count, doubling each time: `items.setAll` costs
9 → 21 → 40 → 84 ms and `rows.setAll` costs 35 → 100 → 345 → 1289 ms. The positional bulk write is
linear and the keyed one is not. Declaring one at a time is worse again — `items.push` in a loop is
25 seconds for two thousand rows — but a loop has a bulk alternative to point at, and `rows.setAll`
is the alternative. Reads are fine: `getValue`, `submitValue`, a cell write, `keys()` and a single
`remove` all scale.

Nesting compounds it. Orders each holding lines, both levels written in bulk: 10×20 costs 25ms,
25×20 costs 185ms, 50×20 costs 1151ms and 100×20 costs 8044ms — a hundred orders of twenty lines is
eight seconds where reading them back is seven milliseconds, and four times the orders costs about
ten times as much per order.

Nothing is asserted in milliseconds; every assertion is a ratio, so a slower machine moves the
numbers together and no ratio moves.

## 15. A synchronous validator that throws makes the form unreadable

`adversarial/validation/a-validator-that-breaks.battle.test.mjs`

A validator is application code called on every write, so it can throw. `set()` returns normally and
the exception comes out of `state.valid()` instead — and out of `errorsFor` and `getValue`, and out
of every later read while the value stays one the validator chokes on. The form cannot be rendered
and the stack points at whatever read it last rather than at the write.

The engine answers this on the other side of the same feature: a `serverValidator` check that throws
becomes an error on the field carrying the message, and the form stays readable. That is the green
battle beside it. Either repair is admitted — throw at the write, or turn it into a verdict — and not
a form nobody can read.

`asyncWhen` is the same mistake one step earlier and with a larger blast radius: the predicate that
decides whether a server check runs is read while the form is being built, so one that throws makes
`createForm` throw and nothing exists to render.

## 16. A draft storage that refuses stops the form being built

`adversarial/persistence/storage-that-refuses.battle.test.mjs` — two battles.

Two of the three ways `localStorage` fails are already handled: a `write` that throws is swallowed
and the form keeps what was typed, and a `read` returning something that is not a draft is ignored. A
`read` that *throws* takes `createForm` with it — which is Safari in private browsing, a blocked
third-party context, an enterprise policy. A draft is an optional convenience; failing to read one
should mean there is no draft, not that there is no form.

`clearDraft` is the smaller version: a `remove` that throws comes out of the call, where the write
path swallows its own failure.

## 17. A skipped server check is silent where it matters

`adversarial/reactivity/a-check-nobody-runs.battle.test.mjs`

Async validation needs an effect-capable reactivity, and skipping the check rather than half-starting
it is the documented answer. What a consumer is told is not: in development a console line names the
field, and in production, with `devWarnings` off, there is nothing at all — no console, and nothing
in the `diagnostics` sink in either mode. The form reports `valid` and `canSubmit` for a value the
server never saw, and `MDY_ASYNC_FEATURE_DISABLED` is exported for this situation and never reaches
the sink.

## 18. A document nested past what the walk can carry

`adversarial/security/a-document-too-deep.battle.test.mjs`

A schema nested fifty thousand levels throws a `RangeError` out of `parseDynamicForm` in both modes,
and out of `buildDynamicFormSchema`. The layout half of the same document at the same depth comes
back as `MDY_DYNAMIC_INVALID_LAYOUT` with no exception, because `MDY_LAYOUT_MAX_DEPTH` is tested
before the walk goes further. The depth at which it gives way moves with whatever else is on the
stack; that there is one at all is what is asserted.

## 19. Activate persists only when it is a resume

`adversarial/lifecycle/paused-without-losing-anything.battle.test.mjs`

A form that was active, paused, written to and resumed writes its draft on resuming. One built with
`autoActivate: false` and then activated does not — it waits for an unrelated edit. React and Preact
construct that way, so a form hydrated from a payload in the tick it was built keeps nothing until
the user types.

## 20. getChanges never reports a row the user added

`adversarial/submission/a-row-nobody-sends.battle.test.mjs`

`reset()` throws a declared row away, so the baseline has no such row; `getChanges()` reports
nothing, so there is nothing new. Only what was written to a row *after* it was declared is
reported, so a form where a user added three lines and typed in none produces an empty patch.

## 21. A validator or a predicate that throws takes more than itself

`adversarial/validation/a-validator-that-breaks.battle.test.mjs` — two battles.

A synchronous validator that throws makes `state.valid()` throw, and every later read with it, so
the form cannot be rendered. `asyncWhen` that throws makes `createForm` throw. The async path turns
the same failure into a verdict on the field and keeps the form readable, which is the repair
pattern for both and the green battle beside them.

## 22. A refusal the server sent that reaches nobody

`adversarial/security/what-the-server-refused.battle.test.mjs`

`path: null` lands form-level, a path naming a field lands on it, and a path the form does not have
is surfaced form-level as the guide says. `path: ""` — the explicit way to say *this is about the
whole form* — is dropped entirely, not even into `lastSubmitErrors`. Omitting `path`, which is what
`{ message }` from a server response looks like, produces a form-level error reading `Cannot read
properties of undefined (reading 'length')` on the surface an application shows a person.

## 23. The Plain renderer paints a verdict nobody has earned

`browser/an-error-before-anyone-typed.spec.ts` — **runs under `npm run battle:browser`, not
`npm run battle`.**

`errorsVisible` is `touched && shownErrors(...)`, and its comment says why the second half is there.
Angular calls it, Lit calls it in five places, and Plain never does — its fields render
`shownErrorsOf`, which knows `disabled` and not `touched`. A freshly mounted Plain form paints "This
field is required" in a visible block eighteen pixels tall and marks the control `aria-invalid`, so a
screen reader announces every required field as invalid before the user has reached any of them.

Only a real DOM shows it: the handle is failing either way, and every check that reads the engine
agrees with the engine.

## 24. Reported without a repair path

- `adversarial/submission/submit-contract.battle.test.mjs` — an action returning something that is
  not a list of errors puts `errors.filter is not a function` on the form-level error surface, the
  one an application renders to the person filling in the form. The smallest of these findings.
- `adversarial/reactivity/duplicated-core.battle.test.mjs` — a second copy of the package under a
  dependent's `node_modules` turns the cross-runtime guard off: the nested copy's registry knows
  nothing, so `observerFor` says nothing about a handle from the other copy.
- `generative/properties/keyed-nested.property.test.mjs` — `record.upsert` on an existing key keeps
  nested rows and nulls their cells, where a remove-then-upsert behaves as documented.

## 25. Three artefacts disagree about which document versions exist

`adversarial/dynamic-contract/the-versions-nobody-published.battle.test.mjs`

The parser accepts envelope versions 1, 2 and 3, plus a bare field array. `spec/` publishes a schema
for 2 and 3. Neither of the remaining two shapes is described by anything an editor can read.

That would be a documentation gap and not much more, except for which version it is:
`docs/guides/ai-generated-forms.md` tells a model, in the prompt it publishes for copying, to respond
with `{ "version": 1, "fields": [ ... ] }`, and names the bare array as accepted. So the recommended
path is the underlined one. `scripts/audit-contract-schema.mjs` states in its own header why that
costs more than it looks: the schema is the only diagnostic an author writing JSON gets for free, and
one that rejects a valid document teaches them to distrust it.

The audit cannot see this. It walks `spec/fixtures/dynamic-form/*` and reports a corpus with no
schema; there is no `v1/` corpus, so there is nothing for it to walk.

Green when a v1 schema is published, or when the parser stops taking a version nothing describes.
Both sides are measured in the battle — the versions by probing the parser, the schemas by reading
the directory — so neither can drift away from it silently.

## 26. A refusal that names a cause the document does not have

`adversarial/dynamic-contract/refused-for-the-wrong-reason.battle.test.mjs`

`spec/fixtures/dynamic-form/v3/placement.json` with its version number moved to 2 is refused, which is
correct: the v2 schema's own description says a placement slot and a section's per-size placement are
"both of which the parser refuses below v3". It is refused as `MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE`,
twice. All five names the fixture references — `first`, `last`, `street`, `city`, `notes` — are
declared in the same document. An author reads that and goes looking for a typo that is not there.

`MDY_DYNAMIC_UNSUPPORTED_VERSION` is already in `MDY_DYNAMIC_DIAGNOSTICS` and already fires for a
version the parser does not know. It is not reached when the version is known and the construct is one
that version predates, which is the case where the author most needs to be told what is wrong.

The battle asserts the refusal as well as the cause, so accepting the document is not a way to turn it
green.

## Closed since this file was written

- **A document's pattern could stop the form answering** —
  `adversarial/security/document-patterns.battle.test.mjs` was red and is now green.
  `MDY_DYNAMIC_PATTERN_TOO_COSTLY` is published in `MDY_DYNAMIC_DIAGNOSTICS`, ADR 0050 records the
  decision, and all three catastrophic patterns now answer inside the 1s budget in a clean child
  process.

## Not a finding, but stale

`scripts/audit-contract-schema.mjs` says in its header that checking whether the schema accepts each
fixture "needs a JSON Schema validator, which is a dependency this repository does not carry". Line 28
imports `ajv/dist/2020.js` and line 125 does exactly that check. The comment describes the file before
`34a87f9e`.

## 27. A write that arrives after the end gives two answers

`adversarial/lifecycle/a-write-after-the-end.battle.test.mjs`

Three operations: fill a field, destroy the form, write to the field again.

```
handle.value()        ""                          the write landed
getValue().name       "typed"                     frozen at the end
handle.errors()       ["This field is required"]  a validator ran
handle.valid()        false
state.valid()         true
state.canSubmit()     true
```

That a destroyed form answers is deliberate — a renderer torn down in the other order keeps reading,
and throwing would turn an ordinary unmount race into a crash. The write is the case underneath it,
produced by the same race: a control's change handler firing as its host is disposed. A control still
on screen shows what the user typed and an error explaining why it is wrong, about a form that holds
neither and will submit neither.

Asserted as the two surfaces agreeing rather than which one wins, so refusing the write and landing it
everywhere both turn it green.

Bounded by the second battle in the same file, which is green: no async validator runs after destroy.
The work that reaches outside the process stays stopped.

## 28. A cross-field check that is kept and never runs

`adversarial/dynamic-contract/a-rule-that-never-fires.battle.test.mjs`

`validateExpression` states its own purpose: an expression from a document is checked at parse time
"rather than surfacing later as a rule that silently never fires". Every malformed path in a
`validations` condition is refused — `__proto__`, `a..b`, `.a`, `a.` as not being field paths, `ghost`
and `ghost.deep` as naming nothing the document declares. The empty string is not. It parses, is kept,
and becomes a dependency on a path no field has, so the check never runs against any value the form
can hold, including against `undefined`, which is what that path reads.

The same value as a rule's `when.field` is refused with `MDY_DYNAMIC_INVALID_RULE`. The two condition
surfaces disagree about exactly one input, and it is the one that fails silently.

A document here is written by a model as often as by a person — that is what the guide's published
prompt is for — and a generated `""` is a check that looks present in the document, parses `ok`, and
defends nothing.

## 26 has a second witness

Nesting sections one past `MDY_LAYOUT_MAX_DEPTH` reports `MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE` about a
field the same document declares — the same code the version boundary reports about five correct
references. Two routes to one message make it the walk's answer for stopping at all: whatever ends the
walk, the field it never reached is reported as one the document does not have. Both refusals are
correct and the battle asserts them; the depth limit itself holds exactly at 6 and terminates on 5000
sections in under a millisecond.

## 29. The author-time check is silent about a version it does not know

Measured, not battled — pinning it needs `@modyra/eslint-plugin` as a dependency of this package,
which is a decision rather than a test.

`modyra/valid-dynamic-form` decides a literal is a document by finding "a version the parser knows"
beside one of the two slots that carry a form. A `{ version: 4, fields: [...] }` literal is therefore
not a document to it, and it reports nothing — while the parser refuses that document at runtime with
`MDY_DYNAMIC_UNSUPPORTED_VERSION`. The rule is silent exactly where the parser is most certain, and
the signal the heuristic reads is the thing that is wrong.

Everything else about the rule holds and was checked: versions 1, 2 and 3 all reported, with and
without the parse call, duplicate names and unsafe names alike.

## Dismissed with evidence

- **Array inside an array.** The plan recorded it as refused by `assertNotNestedCollection`. The
  published `v3/positional-nesting.json` fills three positional levels and a list whose rows are
  lists, with no refusal. ADR 0043 landed; the matrix was stale.
- **A collection's `errors()` empty while a row is invalid.** It is the right scope: it carries what
  is attributed to the collection's own path — a form-level validator targeting `orders` does appear
  there — and `validOf(key)` is the surface that answers for a row.
- **Async validators after destroy.** They do not run. Measured with a counter, with the control that
  the validator was reachable while the form was alive.
- **The lint rule's blindness to assembled documents and to `parseDynamicFields`.** Both are stated
  limits with reasons: ADR 0024 for the first, and the rule's own comment for the second — a bare
  array is a valid v1 document, and detecting it would make every array literal a candidate.
