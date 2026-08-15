# What is red, and why

Nineteen battles fail on purpose. Each one is a claim the suite makes about published behaviour that
the engine does not currently keep, reduced to the smallest sequence that shows it, and each names
what would turn it green — usually two answers, because most of these have more than one defensible
repair and the battle asserts the property rather than the fix.

A twentieth, `generative/properties/history.property.test.mjs`, is a campaign rather than a pin: it
draws a fresh seed each run and reaches the whole-write undo defect about four times in five. Its
green is not evidence; the battle beside it is.

The list is grouped by cause. Twenty-two causes, one of them withdrawn.

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

## 22. Reported without a repair path

- `adversarial/submission/submit-contract.battle.test.mjs` — an action returning something that is
  not a list of errors puts `errors.filter is not a function` on the form-level error surface, the
  one an application renders to the person filling in the form. The smallest of these findings.
- `adversarial/reactivity/duplicated-core.battle.test.mjs` — a second copy of the package under a
  dependent's `node_modules` turns the cross-runtime guard off: the nested copy's registry knows
  nothing, so `observerFor` says nothing about a handle from the other copy.
- `generative/properties/keyed-nested.property.test.mjs` — `record.upsert` on an existing key keeps
  nested rows and nulls their cells, where a remove-then-upsert behaves as documented.
